"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2, FolderOpen, LayoutTemplate, Repeat2, Save, Share2, Workflow } from "lucide-react"

import { registerAllAdapters } from "@/lib/adapters"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { withDefaultConfig } from "@/lib/canvas/node-factory"
import type { NodeDefinition } from "@/lib/canvas/types"
import { applyStep, getMainInputPort, replayDescendants, replaySteps, resolveOutputPort } from "@/lib/journey/engine"
import { isTypeCompatible } from "@/lib/canvas/validation"
import { toolTransferIdFromHash, toolTransfers, type ToolTransfer } from "@/lib/tool-transfer"
import {
  decodeSharedPath,
  deleteDraft,
  hasSavedConflict,
  isJourneySaved,
  loadDraft,
  loadJourney,
  reviewSharedPath,
  saveDraft,
  saveJourney,
  type SharedStepIssue,
  type SharedStepReview,
} from "@/lib/journey/serialize"
import { exportPathToCanvas } from "@/lib/journey/to-canvas"
import { getJourneyTemplate, journeyTemplatePath, templateIdFromHash, validateTemplateImage, type JourneyTemplate } from "@/lib/journey/templates"
import {
  appendNode,
  createJourney,
  getPath,
  getPathSteps,
  removeSubtree,
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
  ShareDialog,
} from "@/components/journey/JourneyDialogs"
import { JourneyTrail } from "@/components/journey/JourneyTrail"
import { StepSheet } from "@/components/journey/StepSheet"
import { SuggestionChips } from "@/components/journey/SuggestionChips"
import { ToolPickerSheet } from "@/components/journey/ToolPickerSheet"
import { ValueCard } from "@/components/journey/ValueCard"
import { TransferIntake } from "@/components/journey/TransferIntake"
import { TemplatePicker } from "@/components/journey/TemplatePicker"
import { TemplateStage, type TemplateRunProgress } from "@/components/journey/TemplateStage"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"

registerAllAdapters()

const ICON_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"

const ISSUE_KEYS: Record<SharedStepIssue, string> = {
  "unknown-tool": "issueUnknownTool",
  "network-tool": "issueNetworkTool",
  "manual-tool": "issueManualTool",
}

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

type DialogKind = "share" | "open" | "replay" | "confirmNew" | "confirmOverwrite"

export default function JourneyPage() {
  const t = useTranslations("journey")
  const wt = useTranslations("workflowTemplates")
  const { toast } = useToast()
  const router = useRouter()

  const [journey, setJourney] = useState<Journey | null>(null)
  const [pendingSharedPath, setPendingSharedPath] = useState<SharedJourneyPath | null>(null)
  const [pendingReview, setPendingReview] = useState<SharedStepReview[] | null>(null)
  // 分享链接待导入期间被挡在后面的本地草稿:导入一开始,自动保存就会覆盖它
  const [draftBehindImport, setDraftBehindImport] = useState<Journey | null>(null)
  const [running, setRunning] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
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
        .replace("{error}", failed?.error ?? t("unknownError")),
      variant: "destructive",
    })
  }

  const runSharedPath = async (value: unknown, shared: SharedJourneyPath) => {
    const ticket = ++runVersion.current, controller = new AbortController()
    runController.current = controller
    setRunning(true)
    try {
      const result = await replaySteps(value, shared.steps, { signal: controller.signal, onStep: (index, total, step) => { if (ticket === runVersion.current) setRunProgress({ current: index + 1, total, tool: step.tool }) } })
      if (ticket !== runVersion.current) return
      setJourney(
        buildJourneyFromOutcomes(shared.name || t("namePlaceholder"), value, t("trailInput"), result.outcomes),
      )
      setPendingTemplate(null)
      if (controller.signal.aborted) toast({ title: wt("cancelled") })
      else notifyReplayFailure(result)
    } finally {
      if (ticket === runVersion.current) { setRunning(false); setRunProgress(null); runController.current = null }
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
        .map((entry) => `${entry.label}（${t(ISSUE_KEYS[entry.issue!])}）`)
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

  const receiveTransfer = (id: string, current: Journey | null) => {
    const transfer = toolTransfers.take(id)
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
    if (!transfer) {
      toast({ title: t("transferExpired"), variant: "destructive" })
      if (!current) setJourney(loadDraft())
      return
    }
    const prior = current ?? loadDraft()
    if (prior && !isJourneySaved(prior)) {
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
    setRunning(true)
    try {
      const result = await applyStep(parentValue, step)
      setJourney((prev) =>
        prev && prev.nodes[parentId]
          ? appendNode(prev, parentId, step, result.value, toolLabel(tool)).journey
          : prev,
      )
      return true
    } catch (error) {
      toast({
        title: t("stepFailed"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "destructive",
      })
      return false
    } finally {
      setRunning(false)
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
    if (!root || root.valueMissing || root.value === undefined) {
      toast({ title: t("stepFailed"), description: t("valueMissingDescription"), variant: "destructive" })
      return
    }
    const path = getPath(journey, journey.activeId)
    const steps = getPathSteps(journey, journey.activeId)
    setRunning(true)
    try {
      const result = await replaySteps(root.value, steps)
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
      notifyReplayFailure(result)
    } finally {
      setRunning(false)
    }
  }

  const rerunActiveStep = async (config: Record<string, unknown>, outputPort: string) => {
    if (!journey || running) return
    const activeNode = journey.nodes[journey.activeId]
    const parent = activeNode?.parentId ? journey.nodes[activeNode.parentId] : null
    if (!activeNode?.via || !parent) return
    if (parent.valueMissing) {
      toast({ title: t("stepFailed"), description: t("valueMissingDescription"), variant: "destructive" })
      return
    }
    const step: JourneyStep = { tool: activeNode.via.tool, config, outputPort }
    const nodeId = activeNode.id
    setRunning(true)
    try {
      const result = await applyStep(parent.value, step)
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
            .replace("{error}", `${toolLabel(firstFailure.tool)}: ${firstFailure.error}`),
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t("stepFailed"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "destructive",
      })
    } finally {
      setRunning(false)
    }
  }

  const deleteActiveStep = () => {
    setStepSheetOpen(false)
    setJourney((prev) => (prev ? removeSubtree(prev, prev.activeId) : prev))
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

  const handleOpenInCanvas = () => {
    if (!journey) return
    const { ok, skipped } = exportPathToCanvas(getPath(journey, journey.activeId))
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

  const handleReplayRun = async (value: unknown) => {
    if (!journey || running) return
    const steps = getPathSteps(journey, journey.activeId)
    const name = journey.name
    const ticket = ++runVersion.current
    setRunning(true)
    try {
      if (value instanceof File && ["ocr", "image-convert"].includes(steps[0]?.tool)) await validateTemplateImage(value)
      if (ticket !== runVersion.current) return
      setDialog(null)
      await runSharedPath(value, { v: 1, name, steps })
    } catch (error) { if (ticket === runVersion.current) toast({ title: t("stepFailed"), description: error instanceof Error ? error.message : t("unknownError"), variant: "destructive" }) }
    finally { if (ticket === runVersion.current) setRunning(false) }
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
      {pendingTemplate ? <TemplateStage key={pendingTemplate.id} template={pendingTemplate} starting={running} progress={runProgress} hasDraft={draftBehindImport !== null} onStart={handleStart} onCancel={() => runController.current?.abort()} onExit={handleRestoreDraft} onOpenTemplates={() => setTemplatePickerOpen(true)} /> : <InputStage
        pendingSteps={pendingReview}
        pendingText={pendingSharedPath?.rootText}
        starting={running}
        onStart={handleStart}
        draftBehindImport={draftBehindImport !== null}
        onRestoreDraft={handleRestoreDraft}
        onOpenTemplates={() => setTemplatePickerOpen(true)}
      />}
      <TemplatePicker open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onChoose={chooseTemplate} />
      </>
    )
  }

  const headerActions: Array<{ key: string; label: string; icon: typeof Repeat2; onClick: () => void }> = [
    { key: "templates", label: wt("title"), icon: LayoutTemplate, onClick: () => setTemplatePickerOpen(true) },
    { key: "replay", label: t("replayTitle"), icon: Repeat2, onClick: () => setDialog("replay") },
    { key: "share", label: t("shareJourney"), icon: Share2, onClick: () => setDialog("share") },
    { key: "canvas", label: t("openInCanvas"), icon: Workflow, onClick: handleOpenInCanvas },
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

      {running && runProgress && <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-md-primary-container p-3 text-sm text-md-on-primary-container"><span>{wt("progress").replace("{current}", String(runProgress.current)).replace("{total}", String(runProgress.total))} · {toolLabel(runProgress.tool)}</span><Button variant="outline" size="sm" onClick={() => runController.current?.abort()}>{wt("cancel")}</Button></div>}
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
        onDelete={(nodeId) => setJourney((prev) => (prev ? removeSubtree(prev, nodeId) : prev))}
      />
      <ShareDialog open={dialog === "share"} onOpenChange={(open) => setDialog(open ? "share" : null)} journey={journey} />
      <OpenJourneyDialog
        open={dialog === "open"}
        onOpenChange={(open) => setDialog(open ? "open" : null)}
        onLoad={handleLoad}
        isCurrentSaved={() => isJourneySaved(journey)}
      />
      <ReplayDialog
        open={dialog === "replay"}
        onOpenChange={(open) => setDialog(open ? "replay" : null)}
        stepCount={getPathSteps(journey, journey.activeId).length}
        running={running}
        fileInput={journey.nodes[journey.rootId]?.valueType === "bytes"}
        onRun={(value) => void handleReplayRun(value)}
        isCurrentSaved={() => isJourneySaved(journey)}
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
    </div>
  )
}
