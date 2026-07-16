export function tokenizeDockerCommand(command: string): string[] {
  const args: string[] = []
  let current = ""
  let quote: "'" | '"' | null = null

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index]
    const next = command[index + 1]

    if (quote) {
      if (character === quote) {
        quote = null
      } else if (character === "\\" && quote === '"' && (next === '"' || next === "\\")) {
        current += next
        index += 1
      } else {
        current += character
      }
      continue
    }

    if (character === "'" || character === '"') {
      quote = character
    } else if (character === "\\" && (next === "'" || next === '"' || next === "\\" || /\s/.test(next ?? ""))) {
      current += next
      index += 1
    } else if (/\s/.test(character)) {
      if (current) {
        args.push(current)
        current = ""
      }
    } else {
      current += character
    }
  }

  if (quote) throw new Error("命令中存在未闭合的引号")
  if (current) args.push(current)
  return args
}

export function stripDockerArgumentQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed.at(-1)
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

export function getDockerInlineOptionValue(argument: string, option: string): string | null {
  const prefix = `${option}=`
  if (!argument.startsWith(prefix)) return null
  return stripDockerArgumentQuotes(argument.slice(prefix.length))
}
