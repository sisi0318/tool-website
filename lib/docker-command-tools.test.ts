import { describe, expect, it } from "vitest"
import { getDockerInlineOptionValue, tokenizeDockerCommand } from "./docker-command-tools"

describe("Docker command tools", () => {
  it("removes grouping quotes without losing spaces in values", () => {
    expect(
      tokenizeDockerCommand('docker run -e MESSAGE="hello  world" --health-cmd="curl -f /health" image'),
    ).toEqual(["docker", "run", "-e", "MESSAGE=hello  world", "--health-cmd=curl -f /health", "image"])
  })

  it("preserves non-escape backslashes such as Windows paths", () => {
    expect(tokenizeDockerCommand(String.raw`docker run -v C:\data:/data image`))
      .toContain(String.raw`C:\data:/data`)
  })

  it("extracts inline values using the exact option prefix length", () => {
    expect(getDockerInlineOptionValue("--shm-size=256m", "--shm-size")).toBe("256m")
    expect(getDockerInlineOptionValue('--name="my-app"', "--name")).toBe("my-app")
  })
})
