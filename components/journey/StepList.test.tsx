import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearRegistry } from "@/lib/canvas/registry"
import { registerEncodingAdapter } from "@/lib/adapters/encoding"
import { registerHashAdapter } from "@/lib/adapters/hash"
import { appendNode, createJourney, selectNode } from "@/lib/journey/tree"
import type { Journey } from "@/lib/journey/types"
import { StepList } from "./StepList"

// 文案键原样返回；节点名取不到翻译时页面用适配器里的英文名
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

const BASE64_DECODE = { tool: "encoding", config: { encoding: "base64", mode: "decode" }, outputPort: "output" }
const SHA256 = { tool: "hash", config: { category: "sha2", algorithm: "sha2-256" }, outputPort: "hash" }

/** 输入 → Base64 解码 → 哈希(SHA-256)；选中的是末端 */
function threeSteps(): { journey: Journey; ids: { root: string; decode: string; hash: string } } {
  const base = createJourney("t", "eyJhIjoxfQ==", "Input")
  const decode = appendNode(base, base.rootId, BASE64_DECODE, '{"a":1}', "Encoding")
  const hash = appendNode(decode.journey, decode.nodeId, SHA256, "abc123", "Hash")
  return { journey: hash.journey, ids: { root: base.rootId, decode: decode.nodeId, hash: hash.nodeId } }
}

const steps = () => screen.getAllByRole("button").filter((button) => button.hasAttribute("data-journey-step"))

beforeEach(() => {
  clearRegistry()
  registerEncodingAdapter()
  registerHashAdapter()
})

describe("the list of steps", () => {
  it("names each step by what it did and says what came out", () => {
    const { journey } = threeSteps()
    render(<StepList journey={journey} onSelect={vi.fn()} onOpenBranches={vi.fn()} />)

    const [input, decode, hash] = steps()
    expect(input).toHaveTextContent("trailInput")
    // 对得上建议里的动作短语，而不是工具名 Encoding
    expect(decode).toHaveTextContent("base64Decode")
    expect(decode).toHaveTextContent("summaryChars")
    // 识别出来的类型接在摘要后面
    expect(decode).toHaveTextContent("JSON")
    // 没有现成的短语：工具名加上偏离默认的选项
    expect(hash).toHaveTextContent("Hash · SHA-2-256")
    expect(hash).toHaveAttribute("aria-current", "step")
    expect(decode).not.toHaveAttribute("aria-current")
  })

  it("keeps every step listed while an earlier one is selected", () => {
    const { journey, ids } = threeSteps()
    const onSelect = vi.fn()
    render(<StepList journey={selectNode(journey, ids.decode)} onSelect={onSelect} onOpenBranches={vi.fn()} />)

    expect(steps()).toHaveLength(3)
    expect(steps()[1]).toHaveAttribute("aria-current", "step")
    fireEvent.click(steps()[2])
    expect(onSelect).toHaveBeenCalledWith(ids.hash)
  })

  it("marks where another path leaves the trail, and opens the branches from there", () => {
    const { journey, ids } = threeSteps()
    const fork = appendNode(selectNode(journey, ids.decode), ids.decode, { ...BASE64_DECODE, config: { encoding: "base64", mode: "encode" } }, "x", "Encoding")
    const onOpenBranches = vi.fn()
    render(<StepList journey={fork.journey} onSelect={vi.fn()} onOpenBranches={onOpenBranches} />)

    // 屏幕上是新走的这条：输入 → 解码 → 编码
    expect(steps()).toHaveLength(3)
    expect(steps()[2]).toHaveTextContent("base64Encode")
    fireEvent.click(screen.getByRole("button", { name: "forkHere" }))
    expect(onOpenBranches).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "allBranches" })).toBeInTheDocument()
  })

  it("does not offer the branch view on a path without forks", () => {
    const { journey } = threeSteps()
    render(<StepList journey={journey} onSelect={vi.fn()} onOpenBranches={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "allBranches" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "forkHere" })).not.toBeInTheDocument()
  })

  it("says so when a step's value was not kept", () => {
    const { journey, ids } = threeSteps()
    const missing = { ...journey, nodes: { ...journey.nodes, [ids.hash]: { ...journey.nodes[ids.hash], value: null, valueMissing: true } } }
    render(<StepList journey={missing} onSelect={vi.fn()} onOpenBranches={vi.fn()} />)
    expect(steps()[2]).toHaveTextContent("summaryMissing")
  })

  it("opens the selected step's detail right under it on a narrow screen", () => {
    const { journey, ids } = threeSteps()
    render(<StepList journey={selectNode(journey, ids.decode)} onSelect={vi.fn()} onOpenBranches={vi.fn()} inlineDetail={<p>detail of the selected step</p>} />)

    const items = screen.getAllByRole("listitem")
    expect(within(items[1]).getByText("detail of the selected step")).toBeInTheDocument()
    expect(within(items[0]).queryByText("detail of the selected step")).not.toBeInTheDocument()
    expect(within(items[2]).queryByText("detail of the selected step")).not.toBeInTheDocument()
  })
})
