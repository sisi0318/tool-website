import type { ToolTransfer } from "../tool-transfer"
import type { SharedStepReview } from "./serialize"
import type { JourneyTemplate } from "./templates"
import type { Journey, JourneyStep, SharedJourneyPath } from "./types"

/**
 * 数据旅程页面的状态:现在在哪一屏、盖着哪个弹层、有没有在运行。
 *
 * 以前这些散在页面组件的 16 个 useState 里,换屏时靠每个处理函数手动把相关的五到十个
 * 逐一清掉,漏清一个就会出现“导入流程里还开着上一份旅程的对话框”这类状态。
 * 现在一屏一种形状,旅程只存在于“旅程中”这一屏里,换屏由下面的 reducer 一处负责。
 */
export type JourneyScreen =
  /** 什么都没有:等用户粘贴或上传 */
  | { kind: "input" }
  /** 分享链接或模板带来了一条路径:先给用户看步骤,提供数据后才运行 */
  | { kind: "import"; shared: SharedJourneyPath; review: SharedStepReview[]; template: JourneyTemplate | null }
  /** 别的工具传来了数据,而手上未保存的旅程存不进存档:让用户自己选 */
  | { kind: "transfer"; transfer: ToolTransfer }
  | { kind: "journey"; journey: Journey }

export type JourneyOverlay =
  | { kind: "templates" }
  | { kind: "picker" }
  | { kind: "branches" }
  /** 选了一个要先填参数(或有副作用)的工具:确认后才运行 */
  | { kind: "newStep"; step: JourneyStep }
  | { kind: "share" }
  | { kind: "open" }
  | { kind: "replay" }
  | { kind: "editInput" }
  | { kind: "restoreInput" }
  | { kind: "confirmNew" }
  | { kind: "confirmOverwrite" }
  /** 画布里已有内容:snapshot 是用户确认要替换的那一份,期间画布又变了就得重新确认 */
  | { kind: "canvasConflict"; snapshot: string }

export interface RunProgress {
  current: number
  total: number
  tool: string
  /** 改参数时的即时重算:不锁住界面,新的改动会顶掉它 */
  live?: boolean
}

export interface JourneySession {
  screen: JourneyScreen
  /** 被导入流程或传入的数据挡在后面的旅程;放弃导入时原样回来 */
  parked: Journey | null
  overlay: JourneyOverlay | null
  run: RunProgress | null
}

export type JourneyAction =
  /** 开始或换成一份旅程;可以同时带一个弹层(传入数据时直接打开目标工具的参数) */
  | { type: "opened"; journey: Journey; overlay?: JourneyOverlay }
  | { type: "changed"; update: (journey: Journey) => Journey }
  /** stored 是本地存着的草稿:页面刚打开、手上还没有旅程时,要保住的是它 */
  | { type: "importRequested"; shared: SharedJourneyPath; review: SharedStepReview[]; template: JourneyTemplate | null; stored: Journey | null }
  | { type: "transferHeld"; transfer: ToolTransfer; parked: Journey }
  | { type: "parkedRestored" }
  | { type: "reset" }
  | { type: "overlayOpened"; overlay: JourneyOverlay }
  | { type: "overlayClosed" }
  | { type: "runStarted"; progress: RunProgress }
  | { type: "runProgressed"; progress: RunProgress }
  | { type: "runFinished" }

export const INITIAL_SESSION: JourneySession = { screen: { kind: "input" }, parked: null, overlay: null, run: null }

export function currentJourney(session: JourneySession): Journey | null {
  return session.screen.kind === "journey" ? session.screen.journey : null
}

/** 模板选择器在任何一屏都能开;其余弹层都是针对手上这份旅程的 */
function overlayAllowed(screen: JourneyScreen, overlay: JourneyOverlay): boolean {
  if (overlay.kind === "templates") return screen.kind !== "transfer"
  return screen.kind === "journey"
}

export function journeySessionReducer(session: JourneySession, action: JourneyAction): JourneySession {
  switch (action.type) {
    case "opened":
      return { ...session, screen: { kind: "journey", journey: action.journey }, parked: null, overlay: action.overlay ?? null }

    case "changed": {
      if (session.screen.kind !== "journey") return session
      const journey = action.update(session.screen.journey)
      return journey === session.screen.journey ? session : { ...session, screen: { kind: "journey", journey } }
    }

    case "importRequested":
      return {
        ...session,
        screen: { kind: "import", shared: action.shared, review: action.review, template: action.template },
        // 换一个模板、或在导入页上又粘了一条链接时,挡在后面的仍是最初那份
        parked: currentJourney(session) ?? session.parked ?? action.stored,
        overlay: null,
      }

    case "transferHeld":
      return { ...session, screen: { kind: "transfer", transfer: action.transfer }, parked: action.parked, overlay: null }

    case "parkedRestored":
      return {
        ...session,
        screen: session.parked ? { kind: "journey", journey: session.parked } : { kind: "input" },
        parked: null,
        overlay: null,
      }

    case "reset":
      return { ...session, screen: { kind: "input" }, parked: null, overlay: null }

    case "overlayOpened":
      return overlayAllowed(session.screen, action.overlay) ? { ...session, overlay: action.overlay } : session

    case "overlayClosed":
      return session.overlay ? { ...session, overlay: null } : session

    case "runStarted":
    case "runProgressed":
      return { ...session, run: action.progress }

    case "runFinished":
      return session.run ? { ...session, run: null } : session
  }
}
