"use client"

import { useEffect, useReducer, useRef } from "react"
import { useRouter } from "next/navigation"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { withDefaultConfig } from "@/lib/canvas/node-factory"
import { MISSING_FILE_ERROR } from "@/lib/canvas/node-errors"
import type { NodeDefinition } from "@/lib/canvas/types"
import { isTypeCompatible } from "@/lib/canvas/validation"
import { applyStep, countDescendants, getMainInputPort, getOutputPorts, replayDescendants, replaySteps, resolveOutputPort } from "@/lib/journey/engine"
import {
  decodeSharedPath,
  deleteDraft,
  hasSavedConflict,
  isJourneySaved,
  listSavedJourneys,
  loadDraft,
  loadJourney,
  reviewSharedPath,
  saveDraft,
  saveJourney,
  takeSavedJourney,
  type SharedStepIssue,
} from "@/lib/journey/serialize"
import { INITIAL_SESSION, currentJourney, journeySessionReducer, type JourneyOverlay, type RunProgress } from "@/lib/journey/session"
import { getJourneyTemplate, journeyTemplatePath, templateIdFromHash, validateTemplateImage, type JourneyTemplate } from "@/lib/journey/templates"
import { exportPathToCanvas } from "@/lib/journey/to-canvas"
import {
  appendNode,
  createJourney,
  getChildren,
  getTrail,
  removeSubtree,
  replaceNodeValue,
  restoreSubtree,
  selectNode,
} from "@/lib/journey/tree"
import type { ApplyStepResult, Journey, JourneyStep, ReplayResult, ReplayStepOutcome, SharedJourneyPath } from "@/lib/journey/types"
import { receiveTransfer as fetchTransfer, toolTransferIdFromHash, toolTransfers, type ToolTransfer } from "@/lib/tool-transfer"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhWorkflowTemplates } from "@/lib/translations/zh-namespaces/workflowTemplates"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { useUndoToast } from "@/hooks/use-undo-toast"

const ISSUE_KEYS: Record<SharedStepIssue, string> = {
  "unknown-tool": "issueUnknownTool",
  "network-tool": "issueNetworkTool",
  "manual-tool": "issueManualTool",
}

/** 首步是这些工具时，换成文件前先按模板的限制检查图片 */
const IMAGE_STEP_TOOLS = ["ocr", "image-convert"]

/** 改一步参数的结果。失败的原因交回给参数面板就地显示，不弹提示盖住正在改的东西 */
export type StepChangeResult =
  | { status: "applied" }
  | { status: "failed"; message: string }
  /** 用户点了取消，或被更新的一次改动顶掉，或上游缺值没法算 */
  | { status: "skipped" }

function toolLabel(tool: string): string {
  return getNodeDefinition(tool)?.label ?? tool
}

/** Build a fresh journey from replay outcomes, keeping only the successful prefix. */
function buildJourneyFromOutcomes(name: string, rootValue: unknown, rootLabel: string, outcomes: ReplayStepOutcome[]): Journey {
  let journey = createJourney(name, rootValue, rootLabel)
  let parentId = journey.rootId
  for (const outcome of outcomes) {
    if (outcome.status !== "success") break
    const appended = appendNode(journey, parentId, outcome.step, outcome.value, toolLabel(outcome.step.tool))
    journey = appended.journey
    parentId = appended.nodeId
  }
  return journey
}

function clearHash(keepState: boolean) {
  window.history.replaceState(keepState ? window.history.state : null, "", `${window.location.pathname}${window.location.search}`)
}

/**
 * 数据旅程页面的全部行为：读地址栏、自动保存、运行与取消、对旅程的每一种改动。
 * 屏幕与弹层的切换交给 lib/journey/session 的 reducer，这里只管“什么时候发哪个动作”和副作用。
 */
export function useJourneySession() {
  const t = useTranslations("journey", zhJourney)
  const wt = useTranslations("workflowTemplates", zhWorkflowTemplates)
  const nodeLabel = useNodeLabel()
  const showUndo = useUndoToast()
  const { toast } = useToast()
  const router = useRouter()

  const [session, dispatch] = useReducer(journeySessionReducer, INITIAL_SESSION)
  const journey = currentJourney(session)
  /** 有一次会锁住界面的运行在进行；改参数时的即时重算不算 */
  const busy = session.run !== null && !session.run.live

  // 提示里的工具名用当前语言；写进节点的 label 仍是英文名，显示时按 type 再查
  const toolName = (tool: string) => {
    const definition = getNodeDefinition(tool)
    return definition ? nodeLabel(definition) : tool
  }
  // 适配器的错误码按当前语言显示（例如没有选文件），其余是原文
  const errorText = (message: string) => (message === MISSING_FILE_ERROR ? t("missingFile") : message)
  const errorMessage = (error: unknown) => (error instanceof Error ? errorText(error.message) : t("unknownError"))

  const openOverlay = (overlay: JourneyOverlay) => dispatch({ type: "overlayOpened", overlay })
  const closeOverlay = () => dispatch({ type: "overlayClosed" })
  const change = (update: (current: Journey) => Journey) => dispatch({ type: "changed", update })

  // ---------- 运行与取消 ----------

  const runController = useRef<AbortController | null>(null)
  const runVersion = useRef(0)
  /** 被用户点“取消”中止的那一次运行；被新的运行顶掉的不算，也不提示 */
  const cancelledRun = useRef(0)
  useEffect(() => () => { runVersion.current++; runController.current?.abort() }, [])

  /**
   * 开始一次运行。同一时刻只有一次：新的运行会中止上一次（只可能是即时重算，
   * 锁界面的运行期间入口都禁用了）。页面、对话框里的“取消”都作用于当前这一次。
   */
  const beginRun = (initial: RunProgress) => {
    runController.current?.abort()
    const ticket = ++runVersion.current
    const controller = new AbortController()
    runController.current = controller
    dispatch({ type: "runStarted", progress: initial })
    return {
      signal: controller.signal,
      /** 还是当前这一次：结果可以写回 */
      current: () => ticket === runVersion.current,
      cancelledByUser: () => cancelledRun.current === ticket,
      progress: (current: number, total: number, tool: string) => {
        if (ticket === runVersion.current) dispatch({ type: "runProgressed", progress: { ...initial, current, total, tool } })
      },
      finish: () => {
        if (ticket !== runVersion.current) return
        runController.current = null
        dispatch({ type: "runFinished" })
      },
    }
  }

  const cancelRun = () => {
    cancelledRun.current = runVersion.current
    runController.current?.abort()
  }

  const notifyReplayFailure = (result: ReplayResult) => {
    if (result.ok) return
    const failedIndex = result.outcomes.findIndex((outcome) => outcome.status === "error")
    const failed = failedIndex >= 0 ? result.outcomes[failedIndex] : undefined
    toast({
      title: t("replayFailedAt")
        .replace("{index}", String(failedIndex + 1))
        .replace("{error}", failed?.error ? errorText(failed.error) : t("unknownError")),
      variant: "destructive",
    })
  }

  const notifyStepFailure = (error: unknown) =>
    toast({ title: t("stepFailed"), description: errorMessage(error), variant: "destructive" })

  const dependentFailureText = (failures: Array<{ tool: string; error: string }>) =>
    t("dependentReplayFailedDescription")
      .replace("{count}", String(failures.length))
      .replace("{error}", `${toolName(failures[0].tool)}: ${errorText(failures[0].error)}`)

  // ---------- 进入旅程：输入、分享链接、模板、别的工具传来的数据 ----------

  const runSharedPath = async (value: unknown, shared: SharedJourneyPath) => {
    const run = beginRun({ current: 1, total: Math.max(shared.steps.length, 1), tool: shared.steps[0]?.tool ?? "" })
    try {
      const result = await replaySteps(value, shared.steps, { signal: run.signal, onStep: (index, total, step) => run.progress(index + 1, total, step.tool) })
      if (!run.current()) return
      dispatch({ type: "opened", journey: buildJourneyFromOutcomes(shared.name || t("namePlaceholder"), value, t("trailInput"), result.outcomes) })
      if (run.signal.aborted) toast({ title: wt("cancelled") })
      else notifyReplayFailure(result)
    } finally {
      run.finish()
    }
  }

  /** 审查分享路径并进入待导入的那一屏，返回是否接受。手上的旅程（或本地草稿）留在后面，可以放弃导入回去 */
  const importSharedPath = (shared: SharedJourneyPath, template: JourneyTemplate | null = null): boolean => {
    const review = reviewSharedPath(shared)
    if (review.blocked) {
      // A link is untrusted input: refuse paths that could run side-effecting tools.
      const offenders = review.steps
        .filter((entry) => entry.issue)
        .map((entry) => `${toolName(entry.step.tool)}（${t(ISSUE_KEYS[entry.issue!])}）`)
        .join("、")
      toast({ title: t("importBlockedTitle"), description: t("importBlockedDescription").replace("{tools}", offenders), variant: "destructive" })
      return false
    }
    // Never auto-run: the user reviews the steps and starts explicitly.
    dispatch({ type: "importRequested", shared, review: review.steps, template, stored: loadDraft() })
    return true
  }

  const chooseTemplate = (template: JourneyTemplate) => {
    if (busy) return
    if (!importSharedPath(journeyTemplatePath(template, wt(`${template.id}_title`)), template)) closeOverlay()
  }

  const startTransfer = (transfer: ToolTransfer) => {
    const definition = transfer.targetTool ? getNodeDefinition(transfer.targetTool) : undefined
    const input = definition ? getMainInputPort(definition) : null
    const canUseTool = definition && input && isTypeCompatible(transfer.valueType, input.dataType)
    dispatch({
      type: "opened",
      journey: createJourney(t("namePlaceholder"), transfer.value, transfer.source || t("trailInput")),
      // 指定了目标工具时直接打开它的参数，但不替用户按“运行”
      overlay: canUseTool
        ? { kind: "newStep", step: { tool: definition.type, config: withDefaultConfig(definition.type, {}), outputPort: resolveOutputPort(definition) } }
        : undefined,
    })
  }

  /** 把没保存的旅程存成“草稿 MM-DD HH:mm”（重名时加序号），返回存档名；存不下时返回 null */
  const archiveUnsaved = (prior: Journey): string | null => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, "0")
    const base = t("draftArchiveName").replace("{time}", `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`)
    const taken = new Set(listSavedJourneys())
    let name = base
    for (let index = 2; taken.has(name); index += 1) name = `${base} (${index})`
    return saveJourney({ ...prior, name }) ? name : null
  }

  const acceptTransfer = (transfer: ToolTransfer | null, current: Journey | null) => {
    if (!transfer) {
      toast({ title: t("transferExpired"), variant: "destructive" })
      const draft = current ? null : loadDraft()
      if (draft) dispatch({ type: "opened", journey: draft })
      return
    }
    const prior = current ?? loadDraft()
    if (prior && !isJourneySaved(prior)) {
      // 以前停在二选一的拦截页：返回原旅程会丢掉传入的数据，开始新旅程会覆盖草稿。
      // 现在先把原来的旅程存档，再用传入的数据开始，提示里可以撤销（回到原旅程）
      const archivedName = archiveUnsaved(prior)
      if (archivedName) {
        startTransfer(transfer)
        showUndo(t("draftArchived").replace("{name}", archivedName), () => {
          takeSavedJourney(archivedName)
          dispatch({ type: "opened", journey: prior })
        })
        return
      }
      // 存储写不进去时仍让用户自己选
      dispatch({ type: "transferHeld", transfer, parked: prior })
      return
    }
    startTransfer(transfer)
  }

  // 同一标签页内发来的数据直接从内存取；取不到时可能是工作台在新标签打开了旅程，数据还在工作台那边，向它要
  const receiveTransfer = (id: string, current: Journey | null) => {
    clearHash(true)
    const local = toolTransfers.take(id)
    if (local) acceptTransfer(local, current)
    else void fetchTransfer(id).then((transfer) => acceptTransfer(transfer, current))
  }

  /** 地址栏的片段可能是模板、别的工具传来的数据、或分享链接；返回是否处理了 */
  const consumeHash = (current: Journey | null, onMount: boolean): boolean => {
    const hash = window.location.hash
    const templateId = templateIdFromHash(hash)
    if (templateId) {
      clearHash(!onMount)
      importSharedPath(journeyTemplatePath(getJourneyTemplate(templateId)!, wt(`${templateId}_title`)), getJourneyTemplate(templateId)!)
      return true
    }
    const transferId = toolTransferIdFromHash(hash)
    if (transferId) {
      receiveTransfer(transferId, current)
      return true
    }
    const shared = hash.includes("j=") ? decodeSharedPath(hash) : null
    if (!shared) return false
    // Only drop the hash once it decoded, so a failed import stays retryable/bookmarkable.
    clearHash(false)
    return importSharedPath(shared)
  }

  // Mount: import from the URL hash, otherwise restore the local draft.
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    if (consumeHash(null, true)) return
    const draft = loadDraft()
    if (draft) dispatch({ type: "opened", journey: draft })
    // 挂载引导，由 booted 保证只跑一次；加入 t / toast 会在切换语言时重放导入流程
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 已经停在 /journey 上时粘贴链接只会改 hash（片段导航），页面不会重新挂载。
  // 监听只挂一次，回调经 ref 取最新的那份，读到的旅程和运行状态才不会过期。
  const onHashChange = useRef(() => {})
  onHashChange.current = () => {
    if (busy) return
    consumeHash(journey ?? session.parked, false)
  }
  useEffect(() => {
    const handler = () => onHashChange.current()
    if (toolTransferIdFromHash(window.location.hash)) handler()
    window.addEventListener("hashchange", handler)
    return () => window.removeEventListener("hashchange", handler)
  }, [])

  // Autosave the draft (debounced) whenever the journey changes.
  const autosaveWarned = useRef(false)
  useEffect(() => {
    if (!journey) return
    const timer = window.setTimeout(() => {
      // 配额满 / 隐私模式下写入会失败，静默丢弃会让用户以为探索已被保存；只提示一次，避免每次编辑都弹
      if (!saveDraft(journey) && !autosaveWarned.current) {
        autosaveWarned.current = true
        toast({ title: t("autosaveFailed"), variant: "destructive" })
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [journey, t, toast])

  /** 输入页的“开始”：有待导入的路径就按它跑，否则以这份数据开一段新旅程 */
  const start = (value: unknown) => {
    if (busy) return
    if (session.screen.kind === "import") void runSharedPath(value, session.screen.shared)
    else dispatch({ type: "opened", journey: createJourney(t("namePlaceholder"), value, t("trailInput")) })
  }

  const restoreParked = () => {
    if (!busy) dispatch({ type: "parkedRestored" })
  }

  // ---------- 旅程中 ----------

  /** 在选中的节点后面加一步。选中的不是这条路的末端时，就是从这里另走一条路 */
  const applyTool = async (tool: string, config: Record<string, unknown>, outputPort: string): Promise<boolean> => {
    if (!journey || busy) return false
    const parentId = journey.activeId
    const parentValue = journey.nodes[parentId]?.value
    // 建议与工具选择器给的配置只含它们关心的字段；落成完整配置，参数面板与分享才有据可依
    const step: JourneyStep = { tool, config: withDefaultConfig(tool, config), outputPort }
    const run = beginRun({ current: 1, total: 1, tool })
    try {
      const result = await applyStep(parentValue, step, { signal: run.signal })
      change((current) => (current.nodes[parentId] ? appendNode(current, parentId, step, result.value, toolLabel(tool)).journey : current))
      return true
    } catch (error) {
      if (run.signal.aborted) toast({ title: t("runCancelled") })
      else notifyStepFailure(error)
      return false
    } finally {
      run.finish()
    }
  }

  const pickTool = (definition: NodeDefinition) => {
    const defaultConfig = withDefaultConfig(definition.type, {})
    const mainPortId = getMainInputPort(definition)?.id
    const fields = definition.config.filter((field) => field.id !== mainPortId && (!field.visible || field.visible(defaultConfig)))
    const outputPort = resolveOutputPort(definition)
    // 没有参数可填、也没有副作用的工具直接跑；跑完还能在参数区就地改
    if (fields.length === 0 && getOutputPorts(definition).length <= 1 && !definition.network && definition.executionMode !== "manual") {
      closeOverlay()
      void applyTool(definition.type, defaultConfig, outputPort)
      return
    }
    openOverlay({ kind: "newStep", step: { tool: definition.type, config: defaultConfig, outputPort } })
  }

  /** 参数确认后运行新的一步；成功才关掉面板，失败时填好的参数还在 */
  const runNewStep = async (config: Record<string, unknown>, outputPort: string) => {
    if (session.overlay?.kind !== "newStep") return
    if (await applyTool(session.overlay.step.tool, config, outputPort)) closeOverlay()
  }

  const select = (nodeId: string) => change((current) => selectNode(current, nodeId))

  const rename = (name: string) => change((current) => ({ ...current, name }))

  /** 把这条路上没随存档留下的值重新算出来 */
  const rerunFromRoot = async () => {
    if (!journey || busy) return
    const root = journey.nodes[journey.rootId]
    if (!root) return
    // 输入本身没有保存下来：以前这里提示“从根节点重新执行”，而根节点正是缺值的那个，点多少次都一样
    if (root.valueMissing || root.value === undefined) {
      openOverlay({ kind: "restoreInput" })
      return
    }
    const trail = getTrail(journey)
    const steps = trail.map((node) => node.via).filter((via): via is JourneyStep => via !== null)
    const run = beginRun({ current: 1, total: Math.max(steps.length, 1), tool: steps[0]?.tool ?? "" })
    try {
      const result = await replaySteps(root.value, steps, { signal: run.signal, onStep: (index, total, step) => run.progress(index + 1, total, step.tool) })
      // 输入没变，取消前已经算完的步骤仍然有效，照样写回
      change((current) => {
        let next = current
        result.outcomes.forEach((outcome, index) => {
          const nodeId = trail[index + 1]?.id
          if (outcome.status === "success" && nodeId && next.nodes[nodeId]) next = replaceNodeValue(next, nodeId, outcome.value)
        })
        return next
      })
      if (run.signal.aborted) toast({ title: wt("cancelled") })
      else notifyReplayFailure(result)
    } finally {
      run.finish()
    }
  }

  /**
   * 换输入：写回根节点，按原节点 id 重算所有分支（不另建旅程，不丢分支）。
   * restore 是输入没随保存恢复时重新提供同一份；replace 是“套用到新数据”和“编辑输入”，提示里可以撤销。
   */
  const replaceInput = async (provided: string | File, kind: "restore" | "replace") => {
    if (!journey || busy) return
    const prior = journey
    const rootId = journey.rootId
    const root = journey.nodes[rootId]
    let value: unknown = provided
    if (typeof provided === "string" && root?.valueType === "json") {
      try { value = JSON.parse(provided) } catch { value = provided }
    }
    const total = Math.max(countDescendants(journey, rootId), 1)
    const run = beginRun({ current: 1, total, tool: getChildren(journey, rootId)[0]?.via?.tool ?? "" })
    try {
      if (value instanceof File && getChildren(journey, rootId).some((child) => IMAGE_STEP_TOOLS.includes(child.via?.tool ?? ""))) {
        await validateTemplateImage(value)
      }
      const descendants = await replayDescendants(replaceNodeValue(journey, rootId, value), rootId, value, {
        signal: run.signal,
        onStep: (index, stepTotal, step) => run.progress(index + 1, stepTotal, step.tool),
      })
      change((current) => {
        if (!current.nodes[rootId]) return current
        const next = replaceNodeValue(current, rootId, value)
        const nodes = { ...next.nodes }
        for (const [nodeId, update] of Object.entries(descendants.nodeUpdates)) {
          if (nodes[nodeId]) nodes[nodeId] = update
        }
        return { ...next, nodes }
      })
      closeOverlay()
      const failure = descendants.failures.length > 0 ? dependentFailureText(descendants.failures) : undefined
      if (kind === "replace") showUndo(t("inputReplaced"), () => change(() => prior), failure)
      else if (failure) toast({ title: t("dependentReplayFailedTitle"), description: failure, variant: "destructive" })
    } catch (error) {
      // 取消时旅程保持原样，对话框和选好的输入都还在，可以直接再运行
      if (run.signal.aborted) toast({ title: t("runCancelled") })
      else notifyStepFailure(error)
    } finally {
      run.finish()
    }
  }

  /**
   * 改一步的参数并重算它和它之后的所有分支。
   * live 是边改边算：不锁界面、不弹提示，新的改动会顶掉还没算完的那一次。
   */
  const changeStep = async (nodeId: string, config: Record<string, unknown>, outputPort: string, options: { live?: boolean } = {}): Promise<StepChangeResult> => {
    if (!journey || busy) return { status: "skipped" }
    const node = journey.nodes[nodeId]
    const parent = node?.parentId ? journey.nodes[node.parentId] : null
    if (!node?.via || !parent) return { status: "skipped" }
    if (parent.valueMissing) {
      if (journey.nodes[journey.rootId]?.valueMissing) openOverlay({ kind: "restoreInput" })
      else if (!options.live) toast({ title: t("stepFailed"), description: t("valueMissingDescription"), variant: "destructive" })
      return { status: "skipped" }
    }
    const step: JourneyStep = { tool: node.via.tool, config, outputPort }
    // 这一步加上它之后的所有分支；取消时一个都不写回，否则后代会混着新旧两种参数的结果
    const total = 1 + countDescendants(journey, nodeId)
    const run = beginRun({ current: 1, total, tool: step.tool, live: options.live })
    try {
      let result: ApplyStepResult
      try {
        result = await applyStep(parent.value, step, { signal: run.signal })
      } catch (error) {
        if (run.signal.aborted) throw error
        return { status: "failed", message: errorMessage(error) }
      }
      const base = replaceNodeValue(journey, nodeId, result.value)
      const descendants = await replayDescendants(
        { ...base, nodes: { ...base.nodes, [nodeId]: { ...base.nodes[nodeId], via: step } } },
        nodeId,
        result.value,
        { signal: run.signal, onStep: (index, _total, next) => run.progress(index + 2, total, next.tool) },
      )
      if (!run.current()) return { status: "skipped" }
      change((current) => {
        if (!current.nodes[nodeId]) return current
        const next = replaceNodeValue(current, nodeId, result.value)
        const nodes = { ...next.nodes, [nodeId]: { ...next.nodes[nodeId], via: step } }
        for (const [descendantId, update] of Object.entries(descendants.nodeUpdates)) {
          // Do not resurrect a branch that the user deleted while recomputation was running.
          if (nodes[descendantId]) nodes[descendantId] = update
        }
        return { ...next, nodes }
      })
      // 边改边算时下游失败不弹提示：步骤列表上那几步会标成“需要重算”，改对了就自己恢复
      if (!descendants.ok && !options.live) {
        toast({ title: t("dependentReplayFailedTitle"), description: dependentFailureText(descendants.failures), variant: "destructive" })
      }
      return { status: "applied" }
    } catch (error) {
      if (!run.signal.aborted) return { status: "failed", message: errorMessage(error) }
      if (run.cancelledByUser()) toast({ title: t("runCancelled") })
      return { status: "skipped" }
    } finally {
      run.finish()
    }
  }

  // 删除一步会连同它之后的整棵子树一起删掉；删后在提示里可以撤销
  const deleteStep = (nodeId: string) => {
    if (!journey) return
    const after = removeSubtree(journey, nodeId)
    if (after === journey) return
    const removed = Object.fromEntries(Object.entries(journey.nodes).filter(([id]) => !after.nodes[id]))
    const previousActiveId = journey.activeId
    change(() => after)
    showUndo(t("stepsDeleted").replace("{count}", String(Object.keys(removed).length)), () =>
      change((current) => restoreSubtree(current, removed, previousActiveId)),
    )
  }

  const commitSave = () => {
    if (!journey) return
    closeOverlay()
    toast(saveJourney(journey) ? { title: t("saved") } : { title: t("saveFailed"), variant: "destructive" })
  }

  const save = () => {
    if (!journey) return
    // 同名但不是同一份旅程：先问，不然默认名「未命名旅程」会让第二份静默吃掉第一份
    if (hasSavedConflict(journey)) openOverlay({ kind: "confirmOverwrite" })
    else commitSave()
  }

  const load = (name: string) => {
    const loaded = loadJourney(name)
    if (loaded) dispatch({ type: "opened", journey: loaded })
  }

  /** 把屏幕上这条路（根 → 末端）交给画布；画布里已有内容时先确认替换 */
  const openInCanvas = (overwriteSnapshot?: string) => {
    if (!journey) return
    const { ok, skipped, conflict } = exportPathToCanvas(getTrail(journey), overwriteSnapshot)
    if (conflict !== undefined) {
      openOverlay({ kind: "canvasConflict", snapshot: conflict })
      return
    }
    closeOverlay()
    if (skipped.length > 0) toast({ title: t("canvasSkippedTools").replace("{tools}", skipped.join(", ")) })
    if (!ok) {
      toast({ title: t("canvasExportFailed"), variant: "destructive" })
      return
    }
    toast({ title: t("canvasExported") })
    router.push("/canvas")
  }

  const startNew = () => {
    dispatch({ type: "reset" })
    // 清掉草稿，避免下次挂载把刚被放弃的旅程复活
    deleteDraft()
  }

  /** 与存档完全一致时没有可丢失的内容，直接新建；否则先确认 */
  const requestNew = () => {
    if (!journey || isJourneySaved(journey)) startNew()
    else openOverlay({ kind: "confirmNew" })
  }

  return {
    session,
    journey,
    busy,
    openOverlay,
    closeOverlay,
    cancelRun,
    start,
    restoreParked,
    chooseTemplate,
    startTransfer,
    applyTool,
    pickTool,
    runNewStep,
    select,
    rename,
    rerunFromRoot,
    replaceInput,
    changeStep,
    deleteStep,
    save,
    commitSave,
    load,
    openInCanvas,
    startNew,
    requestNew,
  }
}

export type JourneyController = ReturnType<typeof useJourneySession>
