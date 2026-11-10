import { beforeEach, describe, expect, it } from "vitest"

import { appendNode, createJourney, getTipId, getTrail, removeSubtree, selectNode } from "./tree"
import { isJourneySaved, loadDraft, persistJourney, saveDraft, saveJourney } from "./serialize"
import type { Journey, JourneyStep } from "./types"

const step = (tool: string): JourneyStep => ({ tool, config: {}, outputPort: "output" })

/** createdAt 用毫秒时间戳,同一毫秒里建的节点分不出先后;测试里手动排开 */
function stamp(journey: Journey, nodeId: string, createdAt: number): Journey {
  return { ...journey, nodes: { ...journey.nodes, [nodeId]: { ...journey.nodes[nodeId], createdAt } } }
}

/**
 * 输入 → A → B → C,另有一条从 A 分出去的 A → D(D 比 B 新)。
 * 返回时选中的是 C,也就是 A → B → C 这条路的末端。
 */
function forked() {
  const base = createJourney("t", "in", "Input")
  const a = appendNode(base, base.rootId, step("a"), "a", "A")
  const b = appendNode(a.journey, a.nodeId, step("b"), "b", "B")
  const c = appendNode(b.journey, b.nodeId, step("c"), "c", "C")
  const d = appendNode(c.journey, a.nodeId, step("d"), "d", "D")
  let journey = d.journey
  ;[a.nodeId, b.nodeId, c.nodeId, d.nodeId].forEach((id, index) => { journey = stamp(journey, id, 1000 + index) })
  return { journey: selectNode(journey, c.nodeId), ids: { root: base.rootId, a: a.nodeId, b: b.nodeId, c: c.nodeId, d: d.nodeId } }
}

const trailIds = (journey: Journey) => getTrail(journey).map((node) => node.id)

beforeEach(() => window.localStorage.clear())

describe("the trail keeps its tail when you look back", () => {
  it("shows the whole path while an earlier step is selected", () => {
    const { journey, ids } = forked()
    expect(trailIds(journey)).toEqual([ids.root, ids.a, ids.b, ids.c])

    const lookingBack = selectNode(journey, ids.a)
    expect(lookingBack.activeId).toBe(ids.a)
    // 以前这里只剩 输入 → A:后面的步骤要去分支抽屉里才找得回来
    expect(trailIds(lookingBack)).toEqual([ids.root, ids.a, ids.b, ids.c])
    // 不记末端的话,从 A 往下会走到更新的 D,显示成另一条路
    expect(getTipId({ ...lookingBack, tipId: undefined })).toBe(ids.d)
  })

  it("stores nothing extra while the selected step is the end of the path", () => {
    const { journey, ids } = forked()
    expect(journey.tipId).toBeUndefined()
    const back = selectNode(journey, ids.b)
    expect(back.tipId).toBe(ids.c)
    expect(selectNode(back, ids.c).tipId).toBeUndefined()
  })

  it("switches to another branch when a step outside the trail is selected", () => {
    const { journey, ids } = forked()
    const other = selectNode(journey, ids.d)
    expect(other.tipId).toBeUndefined()
    expect(trailIds(other)).toEqual([ids.root, ids.a, ids.d])
  })

  it("forks from the selected step and leaves the old tail in the tree", () => {
    const { journey, ids } = forked()
    const fork = appendNode(selectNode(journey, ids.b), ids.b, step("e"), "e", "E")
    expect(fork.journey.tipId).toBeUndefined()
    expect(trailIds(fork.journey)).toEqual([ids.root, ids.a, ids.b, fork.nodeId])
    expect(fork.journey.nodes[ids.c]).toBeDefined()
  })

  it("falls back to the newest remaining branch when the tail is deleted", () => {
    const { journey, ids } = forked()
    const lookingBack = selectNode(journey, ids.a)
    const pruned = removeSubtree(lookingBack, ids.b)
    expect(pruned.activeId).toBe(ids.a)
    expect(trailIds(pruned)).toEqual([ids.root, ids.a, ids.d])
  })

  it("ignores a stored tip that no longer leads through the selected step", () => {
    const { journey, ids } = forked()
    expect(getTipId({ ...journey, activeId: ids.d, tipId: ids.c })).toBe(ids.d)
    expect(getTipId({ ...journey, activeId: ids.a, tipId: "gone" })).toBe(ids.d)
    expect(selectNode(journey, "gone")).toBe(journey)
  })

  it("reads journeys saved before the tip existed, extending the trail below the selected step", () => {
    const { journey, ids } = forked()
    const legacy: Journey = { ...journey, activeId: ids.b }
    delete legacy.tipId
    expect(trailIds(legacy)).toEqual([ids.root, ids.a, ids.b, ids.c])
  })
})

describe("the tip and saving", () => {
  it("survives the draft round trip", () => {
    const { journey, ids } = forked()
    saveDraft(selectNode(journey, ids.a))
    const restored = loadDraft()!
    expect(restored.activeId).toBe(ids.a)
    expect(trailIds(restored)).toEqual([ids.root, ids.a, ids.b, ids.c])
  })

  it("does not change what a journey at the end of its path looks like on disk", () => {
    const { journey } = forked()
    expect("tipId" in persistJourney(journey)).toBe(false)
    saveJourney(journey)
    expect(isJourneySaved(journey)).toBe(true)
  })
})
