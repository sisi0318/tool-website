"use client"

import { useCallback, useReducer, type KeyboardEvent } from "react"

/** 最多保留的快照数；内容可能有几 MB，不能无限累积 */
export const MAX_TEXT_HISTORY = 30

interface TextHistoryState {
  text: string
  past: string[]
  future: string[]
  /** 最近一次程序赋值（替换、撤销、重做）后的内容；用户键入不改它 */
  applied: string | null
}

type TextHistoryAction =
  | { type: "type"; text: string }
  | { type: "replace"; text: string }
  | { type: "undo" }
  | { type: "redo" }

function reduceTextHistory(state: TextHistoryState, action: TextHistoryAction): TextHistoryState {
  switch (action.type) {
    case "type":
      return action.text === state.text ? state : { ...state, text: action.text, future: [] }
    case "replace":
      if (action.text === state.text) return state
      return {
        text: action.text,
        past: [...state.past, state.text].slice(-MAX_TEXT_HISTORY),
        future: [],
        applied: action.text,
      }
    case "undo": {
      if (!state.past.length) return state
      const text = state.past[state.past.length - 1]
      return { text, past: state.past.slice(0, -1), future: [...state.future, state.text], applied: text }
    }
    case "redo": {
      if (!state.future.length) return state
      const text = state.future[state.future.length - 1]
      return { text, past: [...state.past, state.text], future: state.future.slice(0, -1), applied: text }
    }
  }
}

/**
 * 可撤销的编辑框内容。按钮触发的整段替换（格式化、转换、清空、导入）用 replace，
 * 替换前的内容进快照栈，可以撤销、重做；用户键入用 setText。
 *
 * 受控 textarea 被程序赋值后，浏览器自带的撤销就失效了。所以把 onKeyDown 挂到编辑框上：
 * 内容还停在上次程序赋值的结果时，Ctrl/⌘+Z、Ctrl/⌘+Shift+Z、Ctrl+Y 由这里处理；
 * 用户键入之后仍交给浏览器，把键入撤销完、回到那次结果后再继续往前撤。
 */
export function useTextHistory(initial: string) {
  const [state, dispatch] = useReducer(reduceTextHistory, initial, (text): TextHistoryState => ({ text, past: [], future: [], applied: null }))

  const setText = useCallback((text: string) => dispatch({ type: "type", text }), [])
  const replace = useCallback((text: string) => dispatch({ type: "replace", text }), [])
  const undo = useCallback(() => dispatch({ type: "undo" }), [])
  const redo = useCallback(() => dispatch({ type: "redo" }), [])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || state.text !== state.applied) return
    const key = event.key.toLowerCase()
    if (key === "z" && !event.shiftKey) {
      event.preventDefault()
      undo()
    } else if ((key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey)) {
      event.preventDefault()
      redo()
    }
  }

  return {
    text: state.text,
    setText,
    replace,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    onKeyDown,
  }
}
