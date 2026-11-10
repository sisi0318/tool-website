"use client"

import { useRef } from "react"
import dynamic from "next/dynamic"

import { registerAllAdapters } from "@/lib/adapters"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { countDescendants } from "@/lib/journey/engine"
import { isJourneySaved } from "@/lib/journey/serialize"
import type { JourneyOverlay } from "@/lib/journey/session"
import { getTrail } from "@/lib/journey/tree"
import type { JourneyStep } from "@/lib/journey/types"
import { ConfirmDialog } from "@/components/canvas/workflow/ConfirmDialog"
import { InputStage } from "@/components/journey/InputStage"
import { JourneyHeader } from "@/components/journey/JourneyHeader"
import { RunStatus } from "@/components/journey/RunStatus"
import { StepDetail } from "@/components/journey/StepDetail"
import { StepList } from "@/components/journey/StepList"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { useJourneySession } from "./use-journey-session"

registerAllAdapters()

// 弹层和不常走到的几屏按需加载：打开旅程页时不必先把七个对话框、工具选择器、模板页的代码都下下来。
// （选项只能就地写成对象字面量，next/dynamic 的编译期转换不认变量）
const TemplateStage = dynamic(() => import("@/components/journey/TemplateStage").then((module) => module.TemplateStage), { ssr: false })
const TransferIntake = dynamic(() => import("@/components/journey/TransferIntake").then((module) => module.TransferIntake), { ssr: false })
const TemplatePicker = dynamic(() => import("@/components/journey/TemplatePicker").then((module) => module.TemplatePicker), { ssr: false })
const ToolPickerSheet = dynamic(() => import("@/components/journey/ToolPickerSheet").then((module) => module.ToolPickerSheet), { ssr: false })
const StepSheet = dynamic(() => import("@/components/journey/StepSheet").then((module) => module.StepSheet), { ssr: false })
const BranchDrawer = dynamic(() => import("@/components/journey/BranchDrawer").then((module) => module.BranchDrawer), { ssr: false })
const ShareDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.ShareDialog), { ssr: false })
const OpenJourneyDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.OpenJourneyDialog), { ssr: false })
const ReplayDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.ReplayDialog), { ssr: false })
const RestoreInputDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.RestoreInputDialog), { ssr: false })
const ConfirmOverwriteDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.ConfirmOverwriteDialog), { ssr: false })
const ConfirmNewDialog = dynamic(() => import("@/components/journey/JourneyDialogs").then((module) => module.ConfirmNewDialog), { ssr: false })

type OverlayKind = JourneyOverlay["kind"]

/**
 * 数据旅程页面：只负责把当前这一屏和开着的弹层摆出来。
 * 状态怎么变在 lib/journey/session，行为和副作用在 use-journey-session。
 */
export default function JourneyPage() {
  const t = useTranslations("journey", zhJourney)
  const controller = useJourneySession()
  const { session, journey, busy } = controller
  const { screen, overlay, run } = session
  // 宽屏左边步骤、右边详情；窄屏详情就地展开在选中的那一步下面
  const wide = useMediaQuery("(min-width: 1024px)")

  // 弹层打开过才挂载（那时才去取它的代码），之后留着，关闭时的退场动画才播得完
  const opened = useRef(new Set<OverlayKind>())
  if (overlay) opened.current.add(overlay.kind)
  const isOpen = (...kinds: OverlayKind[]) => overlay !== null && kinds.includes(overlay.kind)
  const wasOpened = (...kinds: OverlayKind[]) => kinds.some((kind) => opened.current.has(kind))
  const toggle = (kind: Exclude<OverlayKind, "newStep" | "canvasConflict">) => (open: boolean) =>
    open ? controller.openOverlay({ kind }) : controller.closeOverlay()
  const closeOnly = (open: boolean) => { if (!open) controller.closeOverlay() }

  // 面板退场时弹层已经清空了，留住最后那一步，免得表单在动画里先变空
  const lastNewStep = useRef<JourneyStep | null>(null)
  if (overlay?.kind === "newStep") lastNewStep.current = overlay.step

  const templatePicker = wasOpened("templates") && (
    <TemplatePicker open={isOpen("templates")} onOpenChange={toggle("templates")} onChoose={controller.chooseTemplate} />
  )

  if (screen.kind === "transfer") {
    return <TransferIntake transfer={screen.transfer} onStart={() => controller.startTransfer(screen.transfer)} onRestore={controller.restoreParked} />
  }

  if (screen.kind !== "journey" || !journey) {
    const importing = screen.kind === "import" ? screen : null
    const hasParked = session.parked !== null && !busy
    return (
      <>
        {importing?.template ? (
          <TemplateStage
            key={importing.template.id}
            template={importing.template}
            starting={busy}
            progress={run}
            hasDraft={hasParked}
            onStart={controller.start}
            onCancel={controller.cancelRun}
            onExit={controller.restoreParked}
            onOpenTemplates={() => controller.openOverlay({ kind: "templates" })}
          />
        ) : (
          <InputStage
            pendingSteps={importing?.review ?? null}
            pendingText={importing?.shared.rootText}
            starting={busy}
            progress={run}
            onCancel={controller.cancelRun}
            onStart={controller.start}
            draftBehindImport={hasParked}
            onRestoreDraft={controller.restoreParked}
            onOpenTemplates={() => controller.openOverlay({ kind: "templates" })}
          />
        )}
        {templatePicker}
      </>
    )
  }

  const root = journey.nodes[journey.rootId]
  const selected = journey.nodes[journey.activeId] ?? root
  // “编辑输入”预填当前输入；文件没法预填
  const rootText = typeof root?.value === "string" ? root.value : root?.value == null || root.value instanceof Blob ? "" : formatCanvasValue(root.value, true)
  const fileInput = root?.valueType === "bytes"
  const usedTools = getTrail(journey).flatMap((node) => (node.via ? [node.via.tool] : []))

  const detail = (
    <StepDetail
      journey={journey}
      busy={busy}
      onChangeStep={controller.changeStep}
      onDeleteStep={controller.deleteStep}
      onEditInput={() => controller.openOverlay({ kind: "editInput" })}
      onRerunFromRoot={() => void controller.rerunFromRoot()}
      onApplySuggestion={(suggestion) => void controller.applyTool(suggestion.tool, suggestion.config, suggestion.outputPort ?? "")}
      onMoreTools={() => controller.openOverlay({ kind: "picker" })}
    />
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 pb-24 pt-6">
      <h1 className="sr-only">{t("title")}</h1>

      <JourneyHeader
        name={journey.name}
        disabled={busy}
        onRename={controller.rename}
        onReplay={() => controller.openOverlay({ kind: "replay" })}
        onShare={() => controller.openOverlay({ kind: "share" })}
        onSave={controller.save}
        onOpen={() => controller.openOverlay({ kind: "open" })}
        onNew={controller.requestNew}
        onOpenInCanvas={() => controller.openInCanvas()}
        onTemplates={() => controller.openOverlay({ kind: "templates" })}
      />

      {busy && run && <RunStatus progress={run} onCancel={controller.cancelRun} />}

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          <StepList
            journey={journey}
            onSelect={controller.select}
            onOpenBranches={() => controller.openOverlay({ kind: "branches" })}
            inlineDetail={wide ? undefined : detail}
          />
        </div>
        {wide && detail}
      </div>

      {templatePicker}
      {wasOpened("picker") && selected && (
        <ToolPickerSheet
          open={isOpen("picker")}
          onOpenChange={toggle("picker")}
          value={selected.value}
          valueType={selected.valueType}
          usedTools={usedTools}
          running={busy}
          onPick={controller.pickTool}
        />
      )}
      {wasOpened("newStep") && (
        <StepSheet
          open={isOpen("newStep")}
          onOpenChange={closeOnly}
          step={lastNewStep.current}
          running={busy}
          progress={run}
          onCancel={controller.cancelRun}
          onRun={(config, outputPort) => void controller.runNewStep(config, outputPort)}
        />
      )}
      {wasOpened("branches") && (
        <BranchDrawer
          open={isOpen("branches")}
          onOpenChange={toggle("branches")}
          journey={journey}
          onSelect={(nodeId) => {
            controller.select(nodeId)
            controller.closeOverlay()
          }}
          onDelete={controller.deleteStep}
        />
      )}
      {wasOpened("share") && <ShareDialog open={isOpen("share")} onOpenChange={toggle("share")} journey={journey} />}
      {wasOpened("open") && (
        <OpenJourneyDialog open={isOpen("open")} onOpenChange={toggle("open")} onLoad={controller.load} isCurrentSaved={() => isJourneySaved(journey)} />
      )}
      {wasOpened("replay", "editInput") && (
        <ReplayDialog
          open={isOpen("replay", "editInput")}
          onOpenChange={closeOnly}
          editing={isOpen("editInput")}
          initialText={rootText}
          stepCount={countDescendants(journey, journey.rootId)}
          running={busy}
          progress={run}
          onCancel={controller.cancelRun}
          fileInput={fileInput}
          onRun={(value) => void controller.replaceInput(value, "replace")}
        />
      )}
      {wasOpened("restoreInput") && (
        <RestoreInputDialog
          open={isOpen("restoreInput")}
          onOpenChange={toggle("restoreInput")}
          fileInput={fileInput}
          running={busy}
          progress={run}
          onCancel={controller.cancelRun}
          onRun={(value) => void controller.replaceInput(value, "restore")}
        />
      )}
      {wasOpened("confirmOverwrite") && (
        <ConfirmOverwriteDialog open={isOpen("confirmOverwrite")} onOpenChange={toggle("confirmOverwrite")} name={journey.name} onConfirm={controller.commitSave} />
      )}
      {wasOpened("confirmNew") && <ConfirmNewDialog open={isOpen("confirmNew")} onOpenChange={toggle("confirmNew")} onConfirm={controller.startNew} />}
      {overlay?.kind === "canvasConflict" && (
        <ConfirmDialog
          title={t("canvasReplaceTitle")}
          message={t("canvasReplaceDescription")}
          confirmLabel={t("canvasReplaceConfirm")}
          onCancel={controller.closeOverlay}
          onConfirm={() => controller.openInCanvas(overlay.snapshot)}
        />
      )}
    </div>
  )
}
