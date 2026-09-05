import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  CANVAS_SCHEMA_VERSION,
  decodeWorkflowData,
  encodeWorkflowData,
  getWorkflowList,
  saveWorkflow,
  loadWorkflow,
  deleteWorkflow,
  workflowExists,
  parseWorkflowFile,
  serializeWorkflow,
} from "./workflow"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, "localStorage", { value: localStorageMock })

describe("workflow", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe("getWorkflowList", () => {
    it("returns empty array initially", () => {
      expect(getWorkflowList()).toEqual([])
    })

    it("returns saved list", () => {
      localStorageMock.setItem("canvas-workflow-list", '["test1","test2"]')
      expect(getWorkflowList()).toEqual(["test1", "test2"])
    })

    it("recovers from corrupted storage", () => {
      localStorageMock.setItem("canvas-workflow-list", "not-json")
      expect(getWorkflowList()).toEqual([])
    })
  })

  describe("schema version", () => {
    const sample = {
      nodes: [{ id: "a", type: "string", position: { x: 1, y: 2 }, config: { value: "x" } }],
      edges: [],
    }

    it("落盘数据带版本号,读回后与原数据一致", () => {
      const encoded = JSON.parse(encodeWorkflowData(sample))
      expect(encoded.version).toBe(CANVAS_SCHEMA_VERSION)
      expect(decodeWorkflowData(encoded)).toEqual(sample)
    })

    it("没有版本号的历史数据按 v1 读取", () => {
      expect(decodeWorkflowData({ nodes: sample.nodes, edges: [] })).toEqual(sample)
    })

    it("比当前代码更新的版本拒绝读取,而不是当成损坏数据", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
      expect(decodeWorkflowData({ version: CANVAS_SCHEMA_VERSION + 1, ...sample })).toBeNull()
      expect(warn).toHaveBeenCalledOnce()
      warn.mockRestore()
    })

    it("导出文件版本高于当前时 parseWorkflowFile 报 UNSUPPORTED_VERSION", () => {
      const file = JSON.parse(serializeWorkflow("x", sample))
      expect(file.version).toBe(CANVAS_SCHEMA_VERSION)
      file.version = CANVAS_SCHEMA_VERSION + 1
      expect(() => parseWorkflowFile(JSON.stringify(file))).toThrow("UNSUPPORTED_VERSION")
    })

    it("保存的工作流带版本号并能读回", () => {
      expect(saveWorkflow("versioned", sample)).toBe("created")
      expect(JSON.parse(localStorageMock.getItem("WORKFLOW_versioned")!).version).toBe(CANVAS_SCHEMA_VERSION)
      expect(loadWorkflow("versioned")).toEqual(sample)
    })
  })

  describe("saveWorkflow", () => {
    it("saves workflow and updates list", () => {
      const data = { nodes: [], edges: [] }
      const result = saveWorkflow("test", data)
      expect(result).toBe("created")
      expect(getWorkflowList()).toEqual(["test"])
      expect(JSON.parse(localStorageMock.getItem("WORKFLOW_test")!)).toEqual({ version: CANVAS_SCHEMA_VERSION, ...data })
    })

    it("reports an overwrite of an existing name", () => {
      saveWorkflow("test", { nodes: [], edges: [] })
      const result = saveWorkflow("test", { nodes: [{ id: "1", type: "string", position: { x: 0, y: 0 }, config: {} }], edges: [] })
      expect(result).toBe("overwritten")
    })

    it("不在写入失败时登记名字(避免加载不出内容的幽灵条目)", () => {
      const setItem = localStorageMock.setItem
      localStorageMock.setItem = () => {
        throw new Error("QuotaExceededError")
      }
      try {
        expect(saveWorkflow("doomed", { nodes: [], edges: [] })).toBe("failed")
      } finally {
        localStorageMock.setItem = setItem
      }
      expect(getWorkflowList()).toEqual([])
    })

    it("剥掉 File 配置,避免重载后得到 `{}` 这种坏值", () => {
      const file = new File(["x"], "x.bin")
      saveWorkflow("with-file", {
        nodes: [{ id: "1", type: "file", position: { x: 0, y: 0 }, config: { file, keep: "yes" } }],
        edges: [],
      })
      const stored = JSON.parse(localStorageMock.getItem("WORKFLOW_with-file")!)
      expect(stored.nodes[0].config).toEqual({ keep: "yes" })
    })

    it("does not duplicate names in list", () => {
      saveWorkflow("test", { nodes: [], edges: [] })
      saveWorkflow("test", { nodes: [], edges: [] })
      expect(getWorkflowList()).toEqual(["test"])
    })
  })

  describe("loadWorkflow", () => {
    it("loads saved workflow", () => {
      const data = { nodes: [{ id: "1", type: "string", position: { x: 0, y: 0 }, config: {} }], edges: [] }
      saveWorkflow("test", data)
      expect(loadWorkflow("test")).toEqual(data)
    })

    it("filters out invalid nodes on load", () => {
      const data = { nodes: [{ id: "bad" }], edges: [] }
      saveWorkflow("test", data as any)
      const loaded = loadWorkflow("test")
      expect(loaded!.nodes).toEqual([])
    })

    it("normalizes missing node config", () => {
      const data = { nodes: [{ id: "1", type: "string", position: { x: 0, y: 0 } }], edges: [] }
      saveWorkflow("test", data as any)
      expect(loadWorkflow("test")!.nodes[0].config).toEqual({})
    })

    it("preserves the disabled state while ignoring non-boolean values", () => {
      const data = {
        nodes: [
          { id: "1", type: "string", position: { x: 0, y: 0 }, config: {}, disabled: true },
          { id: "2", type: "string", position: { x: 20, y: 0 }, config: {}, disabled: "yes" },
        ],
        edges: [],
      }
      saveWorkflow("test", data as any)

      expect(loadWorkflow("test")!.nodes).toEqual([
        { id: "1", type: "string", position: { x: 0, y: 0 }, config: {}, disabled: true },
        { id: "2", type: "string", position: { x: 20, y: 0 }, config: {} },
      ])
    })

    it("filters out edges referencing missing nodes", () => {
      const data = {
        nodes: [{ id: "1", type: "string", position: { x: 0, y: 0 }, config: {} }],
        edges: [{ id: "e1", source: "1", sourcePort: "out", target: "missing", targetPort: "in" }],
      }
      saveWorkflow("test", data as any)
      const loaded = loadWorkflow("test")
      expect(loaded!.edges).toEqual([])
    })

    it("returns null for non-existent workflow", () => {
      expect(loadWorkflow("nonexistent")).toBeNull()
    })
  })

  describe("deleteWorkflow", () => {
    it("removes workflow from list and storage", () => {
      saveWorkflow("test", { nodes: [], edges: [] })
      deleteWorkflow("test")
      expect(getWorkflowList()).toEqual([])
      expect(localStorageMock.getItem("WORKFLOW_test")).toBeNull()
    })

    it("does not affect other workflows", () => {
      saveWorkflow("test1", { nodes: [], edges: [] })
      saveWorkflow("test2", { nodes: [], edges: [] })
      deleteWorkflow("test1")
      expect(getWorkflowList()).toEqual(["test2"])
    })
  })

  describe("workflowExists", () => {
    it("returns true for existing workflow", () => {
      saveWorkflow("test", { nodes: [], edges: [] })
      expect(workflowExists("test")).toBe(true)
    })

    it("returns false for non-existent workflow", () => {
      expect(workflowExists("test")).toBe(false)
    })
  })

  describe("portable workflow files", () => {
    it("serializes and parses a versioned workflow", () => {
      const data = {
        nodes: [{ id: "1", type: "string", position: { x: 10, y: 20 }, config: { value: "hello" } }],
        edges: [],
      }
      const parsed = parseWorkflowFile(serializeWorkflow("demo", data))
      expect(parsed.name).toBe("demo")
      expect(parsed.data).toEqual(data)
    })

    it("accepts legacy workflow JSON", () => {
      expect(parseWorkflowFile('{"nodes":[],"edges":[]}').data).toEqual({ nodes: [], edges: [] })
    })

    it("rejects unsupported workflow versions", () => {
      const value = JSON.stringify({
        kind: "tool-website-workflow",
        version: 2,
        name: "future",
        workflow: { nodes: [], edges: [] },
      })
      expect(() => parseWorkflowFile(value)).toThrow("UNSUPPORTED_VERSION")
    })
  })
})
