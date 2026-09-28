"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2, FolderOpen, LayoutTemplate, Repeat2, Save, Share2, Workflow } from "lucide-react"

import { registerAllAdapters } from "@/lib/adapters"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { withDefaultConfig } from "@/lib/canvas/node-factory"
import type { NodeDefinition } from "@/lib/canvas/types"
import { applyStep, countDescendants, getMainInputPort, replayDescendants, replaySteps, resolveOutputPort } from "@/lib/journey/engine"
import { isTypeCompatible } from "@/lib/canvas/validation"
import { receiveTransfer as fetchTransfer, toolTransferIdFromHash, toolTransfers, type ToolTransfer } from "@/lib/tool-transfer"
import { decodeSharedPath, deleteDraft, hasSavedConflict, isJourneySaved, loadDraft, loadJourney, reviewSharedPath, saveDraft, saveJourney, type SharedStepIssue, type SharedStepReview, listSavedJourneys, takeSavedJourney } from "@/lib/journey/serialize"
import { exportPathToCanvas } from "@/lib/journey/to-canvas"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { getJourneyTemplate, journeyTemplatePath, templateIdFromHash, validateTemplateImage, type JourneyTemplate } from "@/lib/journey/templates"
import {
  appendNode,
  createJourney,
  getChildren,
  getPath,
  getPathSteps,
  removeSubtree,
  restoreSubtree,
  replaceNodeValue,
} from "@/lib/journey/tree"
import type {
  Journey,
  JourneyStep,
  ReplayResult,
  ReplayStepOutcome,
  SharedJourneyPath,
} from "@/lib/journey/types"

import { BranchDrawer } from "@/components/journey/BranchDrawer"
import { InputStage } from "@/components/journey/InputStage"
import {
  ConfirmNewDialog,
  ConfirmOverwriteDialog,
  OpenJourneyDialog,
  ReplayDialog,
  RestoreInputDialog,
  ShareDialog,
} from "@/components/journey/JourneyDialogs"
import { JourneyTrail } from "@/components/journey/JourneyTrail"
import { StepSheet } from "@/components/journey/StepSheet"
import { SuggestionChips } from "@/components/journey/SuggestionChips"
import { ToolPickerSheet } from "@/components/journey/ToolPickerSheet"
import { ValueCard } from "@/components/journey/ValueCard"
import { TransferIntake } from "@/components/journey/TransferIntake"
import { TemplatePicker } from "@/components/journey/TemplatePicker"
import { ConfirmDialog } from "@/components/canvas/workflow/ConfirmDialog"
import { TemplateStage, type TemplateRunProgress } from "@/components/journey/TemplateStage"
import { RunStatus } from "@/components/journey/RunStatus"
import { Input } from "@/components/ui/input"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhWorkflowTemplates } from "@/lib/translations/zh-namespaces/workflowTemplates"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useUndoToast } from "@/hooks/use-undo-toast"
import { MISSING_FILE_ERROR } from "@/lib/canvas/node-errors"

registerAllAdapters()

const ICON_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"

const ISSUE_KEYS: Record<SharedStepIssue, string> = {
  "unknown-tool": "issueUnknownTool",
  "network-tool": "issueNetworkTool",
  "manual-tool": "issueManualTool",
}

/** 首步是这些工具时，换成文件前先按模板的限制检查图片 */
const IMAGE_STEP_TOOLS = ["ocr", "image-convert"]

function toolLabel(tool: string): string {
  return getNodeDefinition(tool)?.label ?? tool
}

/** Build a fresh journey from replay outcomes, keeping only the successful prefix. */
function buildJourneyFromOutcomes(
  name: string,
  rootValue: unknown,
  rootLabel: string,
  outcomes: ReplayStepOutcome[],
): Journey {
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

type DialogKind = "share" | "open" | "replay" | "editInput" | "confirmNew" | "confirmOverwrite" | "restoreInput"

export default function JourneyPage() {
  const t = useTranslations("journey", zhJourney)
  const wt = useTranslations("workflowTemplates", zhWorkflowTemplates)
  const nodeLabel = useNodeLabel()
  const showUndo = useUndoToast()
  // 提示里的工具名用当前语言；写进节点的 label 仍是英文名，显示时按 type 再查
  const toolName = (tool: string) => {
    const definition = getNodeDefinition(tool)
    return definition ? nodeLabel(definition) : tool
  }
  // 适配器的错误码按当前语言显示（例如没有选文件），其余是原文
  const errorText = (message: string) => (message === MISSING_FILE_ERROR ? t("missingFile") : message)
  const { toast } = useToast()
  const router = useRouter()

  const [journey, setJourney] = useState<Journey | null>(null)
  const [pendingSharedPath, setPendingSharedPath] = useState<SharedJourneyPath | null>(null)
  const [pendingReview, setPendingReview] = useState<SharedStepReview[] | null>(null)
  // 分享链接待导入期间被挡在后面的本地草稿:导入一开始,自动保存就会覆盖它
  const [draftBehindImport, setDraftBehindImport] = useState<Journey | null>(null)
  const [running, setRunning] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [canvasConflict, setCanvasConflict] = useState<string | null>(null)
  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [branchesOpen, setBranchesOpen] = useState(false)
  const [toolPickerOpen, setToolPickerOpen] = useState(false)
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransfer | null>(null)
  const [pendingStep, setPendingStep] = useState<JourneyStep | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<JourneyTemplate | null>(null)
  const [runProgress, setRunProgress] = useState<TemplateRunProgress | null>(null)
  const runController = useRef<AbortController | null>(null), runVersion = useRef(0)
  const bootedRef = useRef(false)
  // 自动保存失败只提示一次,避免每次编辑都弹。
  const autosaveWarnedRef = useRef(false)

  const active = journey ? journey.nodes[journey.activeId] ?? journey.nodes[journey.rootId] : null
  useEffect(() => () => { runVersion.current++; runController.current?.abort() }, [])

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

  /** 开始一次可取消的运行；页面、步骤面板和对话框里的“取消运行”都作用于当前这一次 */
  const beginRun = () => {
    const ticket = ++runVersion.current, controller = new AbortController()
    runController.current = controller
    setRunning(true)
    return {
      signal: controller.signal,
      live: () => ticket === runVersion.current,
      progress: (current: number, total: number, tool: string) => { if (ticket === runVersion.current) setRunProgress({ current, total, tool }) },
      finish: () => { if (ticket === runVersion.current) { setRunning(false); setRunProgress(null); runController.current = null } },
    }
  }
  const cancelRun = () => runController.current?.abort()

  const runSharedPath = async (value: unknown, shared: SharedJourneyPath) => {
    const run = beginRun()
    try {
      const result = await replaySteps(value, shared.steps, { signal: run.signal, onStep: (index, total, step) => run.progress(index + 1, total, step.tool) })
      if (!run.live()) return
      setJourney(
        buildJourneyFromOutcomes(shared.name || t("namePlaceholder"), value, t("trailInput"), result.outcomes),
      )
      setPendingTemplate(null)
      if (run.signal.aborted) toast({ title: wt("cancelled") })
      else notifyReplayFailure(result)
    } finally {
      run.finish()
    }
  }

  /**
   * 审查分享路径并进入待导入状态,返回是否接受。
   * 被挡在后面的当前旅程(或本地草稿)留在 draftBehindImport 里,输入页可以恢复它。
   */
  const importSharedPath = (shared: SharedJourneyPath, current: Journey | null): boolean => {
    const review = reviewSharedPath(shared)
    if (review.blocked) {
      // A link is untrusted input: refuse paths that could run side-effecting tools.
      const offenders = review.steps
        .filter((entry) => entry.issue)
        .map((entry) => `${toolName(entry.step.tool)}（${t(ISSUE_KEYS[entry.issue!])}）`)
        .join("、")
      toast({
        title: t("importBlockedTitle"),
        description: t("importBlockedDescription").replace("{tools}", offenders),
        variant: "destructive",
      })
      return false
    }
    // Never auto-run: the user reviews the steps and starts explicitly.
    setPendingSharedPath(shared)
    setPendingTemplate(null)
    setIncomingTransfer(null)
    setPendingStep(null)
    setPendingReview(review.steps)
    setDraftBehindImport(current ?? loadDraft())
    setJourney(null)
    setDialog(null)
    setStepSheetOpen(false)
    setBranchesOpen(false)
    setToolPickerOpen(false)
    return true
  }

  const chooseTemplate = (template: JourneyTemplate, current: Journey | null = journey ?? draftBehindImport) => {
    if (running) return
    if (importSharedPath(journeyTemplatePath(template, wt(`${template.id}_title`)), current)) setPendingTemplate(template)
    setTemplatePickerOpen(false)
  }

  const startTransfer = (transfer: ToolTransfer) => {
    setPendingTemplate(null)
    setPendingSharedPath(null)
    setPendingReview(null)
    setDraftBehindImport(null)
    setIncomingTransfer(null)
    setDialog(null)
    setBranchesOpen(false)
    setToolPickerOpen(false)
    setJourney(createJourney(t("namePlaceholder"), transfer.value, transfer.source || t("trailInput")))
    const definition = transfer.targetTool ? getNodeDefinition(transfer.targetTool) : undefined
    const input = definition ? getMainInputPort(definition) : null
    const canUseTool = definition && input && isTypeCompatible(transfer.valueType, input.dataType)
    setPendingStep(canUseTool ? { tool: definition.type, config: withDefaultConfig(definition.type, {}), outputPort: resolveOutputPort(definition) } : null)
    setStepSheetOpen(Boolean(canUseTool))
  }

  // 同一标签页内发来的数据直接从内存取；取不到时可能是工作台在新标签打开了旅程，数据还在工作台那边，向它要
  const receiveTransfer = (id: string, current: Journey | null) => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
    const local = toolTransfers.take(id)
    if (local) acceptTransfer(local, current)
    else void fetchTransfer(id).then((transfer) => acceptTransfer(transfer, current))
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
      if (!current) setJourney(loadDraft())
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
          setStepSheetOpen(false)
          setPendingStep(null)
          setJourney(prior)
        })
        return
      }
      // 存储写不进去时仍让用户自己选
      setIncomingTransfer(transfer)
      setDraftBehindImport(prior)
      setPendingSharedPath(null)
      setPendingReview(null)
      setStepSheetOpen(false)
      setPendingStep(null)
      setJourney(null)
      return
    }
    startTransfer(transfer)
  }

  // Mount: import a shared path from the URL hash, otherwise restore the local draft.
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    const hash = window.location.hash
    const templateId = templateIdFromHash(hash)
    if (templateId) { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`); chooseTemplate(getJourneyTemplate(templateId)!, null); return }
    const transferId = toolTransferIdFromHash(hash)
    if (transferId) { receiveTransfer(transferId, null); return }
    const shared = hash.includes("j=") ? decodeSharedPath(hash) : null
    if (shared) {
      // Only drop the hash once it decoded, so a failed import stays retryable/bookmarkable.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      if (importSharedPath(shared, null)) return
    }
    const draft = loadDraft()
    if (draft) setJourney(draft)
  // 挂载引导，由 bootedRef 保证只跑一次；加入 t/toast 会在切换语言时重放导入流程
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 已经停在 /journey 上时粘贴分享链接只会改 hash(片段导航),页面不会重新挂载。
  // 不带依赖数组:每次渲染重新订阅,回调里读到的 journey / running 永远是最新的。
  useEffect(() => {
    const handleHashChange = () => {
      if (running) return
      const hash = window.location.hash
      const templateId = templateIdFromHash(hash)
      if (templateId) { window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`); chooseTemplate(getJourneyTemplate(templateId)!); return }
      const transferId = toolTransferIdFromHash(hash)
      if (transferId) { receiveTransfer(transferId, journey ?? draftBehindImport); return }
      if (!hash.includes("j=")) return
      const shared = decodeSharedPath(hash)
      if (!shared) return
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
      importSharedPath(shared, journey)
    }
    if (toolTransferIdFromHash(window.location.hash)) handleHashChange()
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  })

  // Autosave the draft (debounced) whenever the journey changes.
  useEffect(() => {
    if (!journey) return
    const timer = window.setTimeout(() => {
      // 配额满 / 隐私模式下写入会失败,静默丢弃会让用户以为探索已被保存。
      if (!saveDraft(journey) && !autosaveWarnedRef.current) {
        autosaveWarnedRef.current = true
        toast({ title: t("autosaveFailed"), variant: "destructive" })
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [journey, t, toast])

  const handleStart = (value: unknown) => {
    if (running) return
    if (pendingSharedPath) {
      const shared = pendingSharedPath
      setPendingSharedPath(null)
      setPendingReview(null)
      setDraftBehindImport(null)
      void runSharedPath(value, shared)
      return
    }
    setJourney(createJourney(t("namePlaceholder"), value, t("trailInput")))
  }

  const handleRestoreDraft = () => {
    if (running) return
    setPendingSharedPath(null)
    setPendingReview(null)
    setPendingTemplate(null)
    setIncomingTransfer(null)
    setJourney(draftBehindImport)
    setDraftBehindImport(null)
  }

  const applyTool = async (tool: string, config: Record<string, unknown>, outputPort: string) => {
    if (!journey || running) return false
    const parentId = journey.activeId
    const parentValue = journey.nodes[parentId]?.value
    // 建议与工具选择器给的配置只含它们关心的字段;落成完整配置,步骤面板与分享才有据可依
    const step: JourneyStep = { tool, config: withDefaultConfig(tool, config), outputPort }
    const run = beginRun()
    run.progress(1, 1, tool)
    try {
      const result = await applyStep(parentValue, step, { signal: run.signal })
      setJourney((prev) =>
        prev && prev.nodes[parentId]
          ? appendNode(prev, parentId, step, result.value, toolLabel(tool)).journey
          : prev,
      )
      return true
    } catch (error) {
      if (run.signal.aborted) toast({ title: t("runCancelled") })
      else toast({
        title: t("stepFailed"),
        description: error instanceof Error ? errorText(error.message) : t("unknownError"),
        variant: "destructive",
      })
      return false
    } finally {
      run.finish()
    }
  }

  const handlePickTool = (definition: NodeDefinition) => {
    setToolPickerOpen(false)
    setPendingStep({ tool: definition.type, config: withDefaultConfig(definition.type, {}), outputPort: resolveOutputPort(definition) })
    setStepSheetOpen(true)
  }

  const selectNode = (nodeId: string) => {
    setJourney((prev) => (prev && prev.nodes[nodeId] ? { ...prev, activeId: nodeId } : prev))
  }

  const rerunFromRoot = async () => {
    if (!journey || running) return
    const root = journey.nodes[journey.rootId]
    if (!root) return
    // 输入本身没有保存下来：以前这里提示“从根节点重新执行”，而根节点正是缺值的那个，点多少次都一样
    if (root.valueMissing || root.value === undefined) {
      setDialog("restoreInput")
      return
    }
    const path = getPath(journey, journey.activeId)
    const steps = getPathSteps(journey, journey.activeId)
    const run = beginRun()
    try {
      const result = await replaySteps(root.value, steps, { signal: run.signal, onStep: (index, total, step) => run.progress(index + 1, total, step.tool) })
      // 输入没变，取消前已经算完的步骤仍然有效，照样写回
      setJourney((prev) => {
        if (!prev) return prev
        let next = prev
        result.outcomes.forEach((outcome, index) => {
          const nodeId = path[index + 1]?.id
          if (outcome.status !== "success" || !nodeId || !next.nodes[nodeId]) return
          next = replaceNodeValue(next, nodeId, outcome.value)
          // replaceNodeValue keeps the persisted valueMissing flag; clear it now that the value is live again.
          next = { ...next, nodes: { ...next.nodes, [nodeId]: { ...next.nodes[nodeId], valueMissing: false } } }
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
   * restore 是输入没随保存恢复时重新提供同一份；replace 是“应用到新数据”和“编辑输入”，
   * 以前只回放当前路径并另建单链，其他分支全部丢失，现在原地重算，提示里可以撤销。
   */
  const replaceInput = async (provided: string | File, kind: "restore" | "replace") => {
    if (!journey || running) return
    const prior = journey
    const rootId = journey.rootId
    const root = journey.nodes[rootId]
    let value: unknown = provided
    if (typeof provided === "string" && root?.valueType === "json") {
      try { value = JSON.parse(provided) } catch { value = provided }
    }
    const run = beginRun()
    try {
      if (value instanceof File && getChildren(journey, rootId).some((child) => IMAGE_STEP_TOOLS.includes(child.via?.tool ?? ""))) {
        await validateTemplateImage(value)
      }
      const base = replaceNodeValue(journey, rootId, value)
      const descendants = await replayDescendants(base, rootId, value, { signal: run.signal, onStep: (index, total, step) => run.progress(index + 1, total, step.tool) })
      setJourney((prev) => {
        if (!prev || !prev.nodes[rootId]) return prev
        const next = replaceNodeValue(prev, rootId, value)
        const nodes = { ...next.nodes }
        for (const [nodeId, update] of Object.entries(descendants.nodeUpdates)) {
          if (nodes[nodeId]) nodes[nodeId] = update
        }
        return { ...next, nodes }
      })
      setDialog(null)
      const firstFailure = descendants.failures[0]
      const failure = firstFailure
        ? t("dependentReplayFailedDescription")
          .replace("{count}", String(descendants.failures.length))
          .replace("{error}", `${toolName(firstFailure.tool)}: ${errorText(firstFailure.error)}`)
        : undefined
      if (kind === "replace") showUndo(t("inputReplaced"), () => setJourney(prior), failure)
      else if (failure) toast({ title: t("dependentReplayFailedTitle"), description: failure, variant: "destructive" })
    } catch (error) {
      // 取消时旅程保持原样，对话框和选好的输入都还在，可以直接再运行
      if (run.signal.aborted) toast({ title: t("runCancelled") })
      else toast({ title: t("stepFailed"), description: error instanceof Error ? errorText(error.message) : t("unknownError"), variant: "destructive" })
    } finally {
      run.finish()
    }
  }

  const rerunActiveStep = async (config: Record<string, unknown>, outputPort: string) => {
    if (!journey || running) return
    const activeNode = journey.nodes[journey.activeId]
    const parent = activeNode?.parentId ? journey.nodes[activeNode.parentId] : null
    if (!activeNode?.via || !parent) return
    if (parent.valueMissing) {
      const root = journey.nodes[journey.rootId]
      if (root?.valueMissing) setDialog("restoreInput")
      else toast({ title: t("stepFailed"), description: t("valueMissingDescription"), variant: "destructive" })
      return
    }
    const step: JourneyStep = { tool: activeNode.via.tool, config, outputPort }
    const nodeId = activeNode.id
    const run = beginRun()
    // 这一步加上它之后的所有分支；取消时一个都不写回，否则后代会混着新旧两种参数的结果
    const total = 1 + countDescendants(journey, nodeId)
    run.progress(1, total, step.tool)
    try {
      const result = await applyStep(parent.value, step, { signal: run.signal })
      const replayBase = replaceNodeValue(journey, nodeId, result.value)
      const updatedActive = {
        ...replayBase.nodes[nodeId],
        via: step,
      }
      const descendants = await replayDescendants(
        {
          ...replayBase,
          nodes: { ...replayBase.nodes, [nodeId]: updatedActive },
        },
        nodeId,
        result.value,
        { signal: run.signal, onStep: (index, _total, next) => run.progress(index + 2, total, next.tool) },
      )

      setJourney((prev) => {
        if (!prev || !prev.nodes[nodeId]) return prev
        const next = replaceNodeValue(prev, nodeId, result.value)
        const nodes = {
          ...next.nodes,
          [nodeId]: { ...next.nodes[nodeId], via: step },
        }
        for (const [descendantId, update] of Object.entries(descendants.nodeUpdates)) {
          // Do not resurrect a branch that the user deleted while recomputation was running.
          if (nodes[descendantId]) nodes[descendantId] = update
        }
        return {
          ...next,
          nodes,
        }
      })
      setStepSheetOpen(false)
      if (!descendants.ok) {
        const firstFailure = descendants.failures[0]
        toast({
          title: t("dependentReplayFailedTitle"),
          description: t("dependentReplayFailedDescription")
            .replace("{count}", String(descendants.failures.length))
            .replace("{error}", `${toolName(firstFailure.tool)}: ${errorText(firstFailure.error)}`),
          variant: "destructive",
        })
      }
    } catch (error) {
      if (run.signal.aborted) toast({ title: t("runCancelled") })
      else toast({
        title: t("stepFailed"),
        description: error instanceof Error ? errorText(error.message) : t("unknownError"),
        variant: "destructive",
      })
    } finally {
      run.finish()
    }
  }

  // 删除一步会连同它之后的整棵子树一起删掉;删后在提示里可以撤销
  const deleteStep = (nodeId: string) => {
    if (!journey) return
    const after = removeSubtree(journey, nodeId)
    if (after === journey) return
    const removed = Object.fromEntries(Object.entries(journey.nodes).filter(([id]) => !after.nodes[id]))
    const previousActiveId = journey.activeId
    setJourney(after)
    toast({
      title: t("stepsDeleted").replace("{count}", String(Object.keys(removed).length)),
      duration: 8000,
      action: (
        <ToastAction altText={t("undo")} onClick={() => setJourney((current) => (current ? restoreSubtree(current, removed, previousActiveId) : current))}>
          {t("undo")}
        </ToastAction>
      ),
    })
  }

  const deleteActiveStep = () => {
    setStepSheetOpen(false)
    if (journey) deleteStep(journey.activeId)
  }

  const commitSave = () => {
    if (!journey) return
    setDialog(null)
    toast(saveJourney(journey) ? { title: t("saved") } : { title: t("saveFailed"), variant: "destructive" })
  }

  const handleSave = () => {
    if (!journey) return
    // 同名但不是同一份旅程:先问,不然默认名「未命名旅程」会让第二份静默吃掉第一份
    if (hasSavedConflict(journey)) {
      setDialog("confirmOverwrite")
      return
    }
    commitSave()
  }

  const handleLoad = (name: string) => {
    const loaded = loadJourney(name)
    if (!loaded) return
    setDialog(null)
    setJourney(loaded)
  }

  const handleOpenInCanvas = (overwriteSnapshot?: string) => {
    if (!journey) return
    const { ok, skipped, conflict } = exportPathToCanvas(getPath(journey, journey.activeId), overwriteSnapshot)
    if (conflict !== undefined) { setCanvasConflict(conflict); return }
    setCanvasConflict(null)
    if (skipped.length > 0) {
      toast({ title: t("canvasSkippedTools").replace("{tools}", skipped.join(", ")) })
    }
    if (!ok) {
      toast({ title: t("canvasExportFailed"), variant: "destructive" })
      return
    }
    toast({ title: t("canvasExported") })
    router.push("/canvas")
  }

  const handleNewJourney = () => {
    setDialog(null)
    setStepSheetOpen(false)
    setBranchesOpen(false)
    setToolPickerOpen(false)
    setPendingSharedPath(null)
    setPendingTemplate(null)
    setIncomingTransfer(null)
    setPendingStep(null)
    setJourney(null)
    // 清掉草稿,避免下次挂载把刚被放弃的旅程复活
    deleteDraft()
  }

  if (incomingTransfer) {
    return <TransferIntake transfer={incomingTransfer} onStart={() => startTransfer(incomingTransfer)} onRestore={handleRestoreDraft} />
  }

  if (!journey || !active) {
    return (
      <>
      {pendingTemplate ? <TemplateStage key={pendingTemplate.id} template={pendingTemplate} starting={running} progress={runProgress} hasDraft={draftBehindImport !== null} onStart={handleStart} onCancel={cancelRun} onExit={handleRestoreDraft} onOpenTemplates={() => setTemplatePickerOpen(true)} /> : <InputStage
        pendingSteps={pendingReview}
        pendingText={pendingSharedPath?.rootText}
        starting={running}
        progress={runProgress}
        onCancel={cancelRun}
        onStart={handleStart}
        draftBehindImport={draftBehindImport !== null}
        onRestoreDraft={handleRestoreDraft}
        onOpenTemplates={() => setTemplatePickerOpen(true)}
      />}
      <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onChoose={chooseTemplate} />
      </>
    )
  }

  // “编辑输入”预填当前输入；文件没法预填
  const rootValue = journey.nodes[journey.rootId]?.value
  const rootText = typeof rootValue === "string" ? rootValue : rootValue == null || rootValue instanceof Blob ? "" : formatCanvasValue(rootValue, true)

  const headerActions: Array<{ key: string; label: string; icon: typeof Repeat2; onClick: () => void }> = [
    { key: "templates", label: wt("title"), icon: LayoutTemplate, onClick: () => setTemplatePickerOpen(true) },
    { key: "replay", label: t("replayTitle"), icon: Repeat2, onClick: () => setDialog("replay") },
    { key: "share", label: t("shareJourney"), icon: Share2, onClick: () => setDialog("share") },
    { key: "canvas", label: t("openInCanvas"), icon: Workflow, onClick: () => handleOpenInCanvas() },
    { key: "save", label: t("saveJourney"), icon: Save, onClick: handleSave },
    { key: "open", label: t("loadJourneyTitle"), icon: FolderOpen, onClick: () => setDialog("open") },
    {
      key: "new",
      label: t("newJourney"),
      icon: FilePlus2,
      // 与存档完全一致时没有可丢失的内容,直接新建;否则先确认
      onClick: () => (isJourneySaved(journey) ? handleNewJourney() : setDialog("confirmNew")),
    },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6">
      <h1 className="sr-only">{t("title")}</h1>

      <header className="flex flex-wrap items-center gap-1">
        <Input
          value={journey.name}
          disabled={running}
          onChange={(event) => setJourney((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
          aria-label={t("journeyName")}
          placeholder={t("namePlaceholder")}
          className="h-10 w-full min-w-0 flex-1 basis-full rounded-full bg-transparent px-3 text-base font-semibold text-[var(--md-sys-color-on-surface)] sm:basis-0"
        />
        <div className="flex items-center">
          {headerActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.onClick}
                disabled={running}
                aria-label={action.label}
                title={action.label}
                className={ICON_BUTTON}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </header>

      {running && runProgress && <RunStatus progress={runProgress} onCancel={cancelRun} />}
      <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onChoose={chooseTemplate} />

      <JourneyTrail
        journey={journey}
        onSelect={selectNode}
        onOpenActiveStep={() => {
          if (active.via) { setPendingStep(null); setStepSheetOpen(true) }
        }}
        onOpenBranches={() => setBranchesOpen(true)}
      />

      <ValueCard
        node={active}
        running={running}
        onOpenStepSheet={() => { setPendingStep(null); setStepSheetOpen(true) }}
        onRerunFromRoot={() => void rerunFromRoot()}
        onEditInput={() => setDialog("editInput")}
        inputMissing={Boolean(journey.nodes[journey.rootId]?.valueMissing)}
      />

      {!active.valueMissing && (
        <SuggestionChips
          node={active}
          running={running}
          onApply={(suggestion) => void applyTool(suggestion.tool, suggestion.config, suggestion.outputPort ?? "")}
          onMoreTools={() => setToolPickerOpen(true)}
        />
      )}

      <ToolPickerSheet
        open={toolPickerOpen}
        onOpenChange={setToolPickerOpen}
        valueType={active.valueType}
        running={running}
        onPick={handlePickTool}
      />
      <StepSheet
        open={stepSheetOpen && Boolean(pendingStep || active.via)}
        onOpenChange={(open) => { setStepSheetOpen(open); if (!open) setPendingStep(null) }}
        node={pendingStep ? { ...active, via: pendingStep } : active.via ? active : null}
        creating={Boolean(pendingStep)}
        running={running}
        progress={runProgress}
        onCancel={cancelRun}
        onRerun={(config, outputPort) => {
          if (!pendingStep) { void rerunActiveStep(config, outputPort); return }
          void applyTool(pendingStep.tool, config, outputPort).then((success) => { if (success) { setPendingStep(null); setStepSheetOpen(false) } })
        }}
        onDelete={deleteActiveStep}
      />
      <BranchDrawer
        open={branchesOpen}
        onOpenChange={setBranchesOpen}
        journey={journey}
        onSelect={(nodeId) => {
          selectNode(nodeId)
          setBranchesOpen(false)
        }}
        onDelete={deleteStep}
      />
      <ShareDialog open={dialog === "share"} onOpenChange={(open) => setDialog(open ? "share" : null)} journey={journey} />
      <OpenJourneyDialog
        open={dialog === "open"}
        onOpenChange={(open) => setDialog(open ? "open" : null)}
        onLoad={handleLoad}
        isCurrentSaved={() => isJourneySaved(journey)}
      />
      <ReplayDialog
        open={dialog === "replay" || dialog === "editInput"}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        editing={dialog === "editInput"}
        initialText={rootText}
        stepCount={countDescendants(journey, journey.rootId)}
        running={running}
        progress={runProgress}
        onCancel={cancelRun}
        fileInput={journey.nodes[journey.rootId]?.valueType === "bytes"}
        onRun={(value) => void replaceInput(value, "replace")}
      />
      <RestoreInputDialog
        open={dialog === "restoreInput"}
        onOpenChange={(open) => setDialog(open ? "restoreInput" : null)}
        fileInput={journey.nodes[journey.rootId]?.valueType === "bytes"}
        running={running}
        progress={runProgress}
        onCancel={cancelRun}
        onRun={(value) => void replaceInput(value, "restore")}
      />
      <ConfirmOverwriteDialog
        open={dialog === "confirmOverwrite"}
        onOpenChange={(open) => setDialog(open ? "confirmOverwrite" : null)}
        name={journey.name}
        onConfirm={commitSave}
      />
      <ConfirmNewDialog
        open={dialog === "confirmNew"}
        onOpenChange={(open) => setDialog(open ? "confirmNew" : null)}
        onConfirm={handleNewJourney}
      />
      {canvasConflict !== null && <ConfirmDialog
        title={t("canvasReplaceTitle")}
        message={t("canvasReplaceDescription")}
        confirmLabel={t("canvasReplaceConfirm")}
        onCancel={() => setCanvasConflict(null)}
        onConfirm={() => handleOpenInCanvas(canvasConflict)}
      />}
    </div>
  )
}
