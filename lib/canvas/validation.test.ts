import { describe, expect, it } from "vitest"
import {
  canAcceptInput,
  validateConnection,
  validateConnectionStructure,
  wouldCreateCycle,
  type ConnectionCandidate,
} from "./validation"
import type { ConfigField, Edge } from "./types"

const stringOutput: ConfigField = { id: "out", name: "输出", dataType: "string" }
const stringInput: ConfigField = { id: "in", name: "输入", dataType: "string" }

function edge(
  id: string,
  source: string,
  target: string,
  sourcePort = "out",
  targetPort = "in"
): Edge {
  return { id, source, sourcePort, target, targetPort }
}

function connection(
  source: string,
  target: string,
  sourcePort = "out",
  targetPort = "in"
): ConnectionCandidate {
  return { source, sourcePort, target, targetPort }
}

describe("validateConnection", () => {
  it("相同类型返回 ok，并保持旧的两参数 API", () => {
    expect(validateConnection(stringOutput, stringInput)).toEqual({
      valid: true,
      level: "ok",
    })
  })

  it("string 和 number 兼容", () => {
    const target: ConfigField = { id: "t", name: "T", dataType: "number" }
    expect(validateConnection(stringOutput, target).valid).toBe(true)
  })

  it("不兼容类型返回稳定错误码和明确原因", () => {
    const target: ConfigField = { id: "t", name: "T", dataType: "bytes" }
    expect(validateConnection(stringOutput, target)).toMatchObject({
      valid: false,
      level: "error",
      code: "incompatible-types",
      message: "类型不兼容：string → bytes。",
    })
  })

  it("提供上下文时同时检查图结构", () => {
    const existing = [edge("e1", "a", "b")]
    const result = validateConnection(stringOutput, stringInput, {
      existingEdges: existing,
      connection: connection("c", "b"),
    })

    expect(result).toMatchObject({
      valid: false,
      code: "target-port-occupied",
      conflictingEdgeId: "e1",
    })
  })

  it("替换已占用输入前仍优先拒绝不兼容类型", () => {
    const bytesInput: ConfigField = { id: "in", name: "输入", dataType: "bytes" }
    const result = validateConnection(stringOutput, bytesInput, {
      existingEdges: [edge("e1", "a", "b")],
      connection: connection("c", "b"),
    })

    expect(result).toMatchObject({
      valid: false,
      code: "incompatible-types",
    })
  })
})

describe("validateConnectionStructure", () => {
  it("允许合法的新连接", () => {
    expect(validateConnectionStructure([], connection("a", "b"))).toEqual({
      valid: true,
      level: "ok",
    })
  })

  it("拒绝自环", () => {
    expect(validateConnectionStructure([], connection("a", "a"))).toMatchObject({
      valid: false,
      code: "self-connection",
      message: "节点不能连接到自身。",
    })
  })

  it("优先将完全相同的边识别为重复连接", () => {
    const existing = [edge("existing", "a", "b")]
    expect(
      validateConnectionStructure(existing, connection("a", "b"))
    ).toMatchObject({
      valid: false,
      code: "duplicate-connection",
      conflictingEdgeId: "existing",
    })
  })

  it("拒绝连接到已被其他边占用的输入端口", () => {
    const existing = [edge("occupying", "a", "b")]
    expect(
      validateConnectionStructure(existing, connection("c", "b"))
    ).toMatchObject({
      valid: false,
      code: "target-port-occupied",
      conflictingEdgeId: "occupying",
      message: "目标输入端口已被连接，请先删除原连接。",
    })
  })

  it("替换已占用输入时仍拒绝形成有向环", () => {
    const existing = [
      edge("a-b", "a", "b"),
      edge("b-c", "b", "c"),
    ]

    expect(
      validateConnectionStructure(existing, connection("c", "b"))
    ).toMatchObject({
      valid: false,
      code: "cycle",
    })
  })

  it("同一节点的另一个输入端口仍可连接", () => {
    const existing = [edge("e1", "a", "b", "out", "first")]
    expect(
      validateConnectionStructure(existing, connection("c", "b", "out", "second"))
    ).toEqual({ valid: true, level: "ok" })
  })

  it("拒绝形成两节点环的连接", () => {
    const existing = [edge("e1", "a", "b")]
    expect(
      validateConnectionStructure(existing, connection("b", "a"))
    ).toMatchObject({
      valid: false,
      code: "cycle",
      message: "该连接会形成循环依赖。",
    })
  })

  it("拒绝形成跨多个节点有向环的连接", () => {
    const existing = [edge("e1", "a", "b"), edge("e2", "b", "c")]
    expect(
      validateConnectionStructure(existing, connection("c", "a"))
    ).toMatchObject({ valid: false, code: "cycle" })
  })

  it("不会把无关分支或反方向路径误判为环", () => {
    const existing = [
      edge("e1", "a", "b"),
      edge("e2", "a", "c"),
      edge("e3", "d", "c"),
    ]
    expect(
      validateConnectionStructure(existing, connection("b", "d"))
    ).toEqual({ valid: true, level: "ok" })
  })
})

describe("wouldCreateCycle", () => {
  it("按有向可达性检测环", () => {
    const existing = [edge("e1", "a", "b"), edge("e2", "b", "c")]
    expect(wouldCreateCycle(existing, "c", "a")).toBe(true)
    expect(wouldCreateCycle(existing, "a", "c")).toBe(false)
  })

  it("自环始终会成环", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true)
  })
})

describe("canAcceptInput", () => {
  it("已有连线时返回 false", () => {
    const existing = [edge("e1", "a", "b")]
    expect(canAcceptInput(existing, "out", "b", "in")).toBe(false)
  })

  it("无连线时返回 true", () => {
    expect(canAcceptInput([], "out", "b", "in")).toBe(true)
  })
})
