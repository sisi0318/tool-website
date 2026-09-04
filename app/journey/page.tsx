"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FilePlus2, FolderOpen, Repeat2, Save, Share2, Workflow } from "lucide-react"

import { registerAllAdapters } from "@/lib/adapters"
import { getNodeDefinition } from "@/lib/canvas/registry"
import type { NodeDefinition } from "@/lib/canvas/types"
import { applyStep, replayDescendants, replaySteps, resolveOutputPort } from "@/lib/journey/engine"
import {
  decodeSharedPath,
  deleteDraft,
  loadDraft,
  loadJourney,
  reviewSharedPath,
  saveDraft,
  saveJourney,
  type SharedStepIssue,
  type SharedStepReview,
} from "@/lib/journey/serialize"
import { exportPathToCanvas } from "@/lib/journey/to-canvas"
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
  OpenJourneyDialog,
  ReplayDialog,
  ShareDialog,
} from "@/components/journey/JourneyDialogs"
import { JourneyTrail } from "@/components/journey/JourneyTrail"
import { StepSheet } from "@/components/journey/StepSheet"
import { SuggestionChips } from "@/components/journey/SuggestionChips"
import { ToolPickerSheet } from "@/components/journey/ToolPickerSheet"
import { ValueCard } from "@/components/journey/ValueCard"
import { Input } from "@/components/ui/input"
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

type DialogKind = "share" | "open" | "replay" | "confirmNew"

export default function JourneyPage() {
  const t = useTranslations("journey")
  const { toast } = useToast()
  const router = useRouter()

  const [journey, setJourney] = useState<Journey | null>(null)
  const [pendingSharedPath, setPendingSharedPath] = useState<SharedJourneyPath | null>(null)
  const [pendingReview, setPendingReview] = useState<SharedStepReview[] | null>(null)
  const [running, setRunning] = useState(false)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [stepSheetOpen, setStepSheetOpen] = useState(false)
  const [branchesOpen, setBranchesOpen] = useState(false)
  const [toolPickerOpen, setToolPickerOpen] = useState(false)
  const bootedRef = useRef(false)
  // 自动保存失败只提示一次,避免每次编辑都弹。
  const autosaveWarnedRef = useRef(false)

  const active = journey ? journey.nodes[journey.activeId] ?? journey.nodes[journey.rootId] : null

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
    setRunning(true)
    try {
      const result = await replaySteps(value, shared.steps)
      setJourney(
        buildJourneyFromOutcomes(shared.name || t("namePlaceholder"), value, t("trailInput"), result.outcomes),
      )
      notifyReplayFailure(result)
    } finally {
      setRunning(false)
    }
  }

  // Mount: import a shared path from the URL hash, otherwise restore the local draft.
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    const hash = window.location.hash
    const shared = hash.includes("j=") ? decodeSharedPath(hash) : null
    if (shared) {
      // Only drop the hash once it decoded, so a failed import stays retryable/bookmarkable.
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`)
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
      } else {
        // Never auto-run: the user reviews the steps and starts explicitly.
        setPendingSharedPath(shared)
        setPendingReview(review.steps)
        return
      }
    }
    const draft = loadDraft()
    if (draft) setJourney(draft)
  }, [])

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
      void runSharedPath(value, shared)
      return
    }
    setJourney(createJourney(t("namePlaceholder"), value, t("trailInput")))
  }

  const applyTool = async (tool: string, config: Record<string, unknown>, outputPort: string) => {
    if (!journey || running) return
    const parentId = journey.activeId
    const parentValue = journey.nodes[parentId]?.value
    const step: JourneyStep = { tool, config, outputPort }
    setRunning(true)
    try {
      const result = await applyStep(parentValue, step)
      setJourney((prev) =>
        prev && prev.nodes[parentId]
          ? appendNode(prev, parentId, step, result.value, toolLabel(tool)).journey
          : prev,
      )
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

  const handlePickTool = (definition: NodeDefinition) => {
    setToolPickerOpen(false)
    void applyTool(definition.type, {}, resolveOutputPort(definition))
  }

  const selectNode = (nodeId: string) => {
    setJourney((prev) => (prev && prev.nodes[nodeId] ? { ...prev, activeId: nodeId } : prev))
  }

  const rerunFromRoot = async () => {
    if (!journey || running) return
    const root = journey.nodes[journey.rootId]
    if (!root || root.valueMissing || root.value === null || root.value === undefined) {
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

  const handleSave = () => {
    if (!journey) return
    toast(saveJourney(journey) ? { title: t("saved") } : { title: t("saveFailed"), variant: "destructive" })
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

  const handleReplayRun = async (text: string) => {
    if (!journey || running) return
    const steps = getPathSteps(journey, journey.activeId)
    const name = journey.name
    setRunning(true)
    try {
      const result = await replaySteps(text, steps)
      setDialog(null)
      setJourney(buildJourneyFromOutcomes(name, text, t("trailInput"), result.outcomes))
      notifyReplayFailure(result)
    } finally {
      setRunning(false)
    }
  }

  const handleNewJourney = () => {
    setDialog(null)
    setStepSheetOpen(false)
    setBranchesOpen(false)
    setToolPickerOpen(false)
    setPendingSharedPath(null)
    setJourney(null)
    // 清掉草稿,避免下次挂载把刚被放弃的旅程复活
    deleteDraft()
  }

  if (!journey || !active) {
    return (
      <InputStage
        pendingSteps={pendingReview}
        pendingText={pendingSharedPath?.rootText}
        starting={running}
        onStart={handleStart}
      />
    )
  }

  const headerActions: Array<{ key: string; label: string; icon: typeof Repeat2; onClick: () => void }> = [
    { key: "replay", label: t("replayTitle"), icon: Repeat2, onClick: () => setDialog("replay") },
    { key: "share", label: t("shareJourney"), icon: Share2, onClick: () => setDialog("share") },
    { key: "canvas", label: t("openInCanvas"), icon: Workflow, onClick: handleOpenInCanvas },
    { key: "save", label: t("saveJourney"), icon: Save, onClick: handleSave },
    { key: "open", label: t("loadJourneyTitle"), icon: FolderOpen, onClick: () => setDialog("open") },
    { key: "new", label: t("newJourney"), icon: FilePlus2, onClick: () => setDialog("confirmNew") },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-24 pt-6">
      <h1 className="sr-only">{t("title")}</h1>

      <header className="flex flex-wrap items-center gap-1">
        <Input
          value={journey.name}
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

      <JourneyTrail
        journey={journey}
        onSelect={selectNode}
        onOpenActiveStep={() => {
          if (active.via) setStepSheetOpen(true)
        }}
        onOpenBranches={() => setBranchesOpen(true)}
      />

      <ValueCard
        node={active}
        running={running}
        onOpenStepSheet={() => setStepSheetOpen(true)}
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
        open={stepSheetOpen && Boolean(active.via)}
        onOpenChange={setStepSheetOpen}
        node={active.via ? active : null}
        running={running}
        onRerun={(config, outputPort) => void rerunActiveStep(config, outputPort)}
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
      />
      <ReplayDialog
        open={dialog === "replay"}
        onOpenChange={(open) => setDialog(open ? "replay" : null)}
        stepCount={getPathSteps(journey, journey.activeId).length}
        running={running}
        onRun={(text) => void handleReplayRun(text)}
      />
      <ConfirmNewDialog
        open={dialog === "confirmNew"}
        onOpenChange={(open) => setDialog(open ? "confirmNew" : null)}
        onConfirm={handleNewJourney}
      />
    </div>
  )
}
