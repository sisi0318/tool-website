import { base64ToBytes } from "./binary"

const BIGINT_MARKER = "\u0000JCE_BIGINT:"
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER)

export function decodeJceBase64(value: string): Uint8Array {
  return base64ToBytes(value.replace(/\s/g, ""))
}

function preserveUnsafeIntegerTokens(json: string): string {
  let output = ""
  let inString = false
  let escaping = false

  for (let index = 0; index < json.length;) {
    const character = json[index]

    if (inString) {
      output += character
      if (escaping) {
        escaping = false
      } else if (character === "\\") {
        escaping = true
      } else if (character === '"') {
        inString = false
      }
      index += 1
      continue
    }

    if (character === '"') {
      inString = true
      output += character
      index += 1
      continue
    }

    if (character === "-" || /\d/.test(character)) {
      const match = json.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (match) {
        const token = match[0]
        if (!/[.eE]/.test(token)) {
          const integer = BigInt(token)
          if (integer > MAX_SAFE_BIGINT || integer < MIN_SAFE_BIGINT) {
            output += JSON.stringify(`${BIGINT_MARKER}${token}`)
            index += token.length
            continue
          }
        }
        output += token
        index += token.length
        continue
      }
    }

    output += character
    index += 1
  }

  return output
}

export function parseJceJson(value: string): unknown {
  return JSON.parse(preserveUnsafeIntegerTokens(value), (_key, parsedValue) => {
    if (typeof parsedValue === "string" && parsedValue.startsWith(BIGINT_MARKER)) {
      return BigInt(parsedValue.slice(BIGINT_MARKER.length))
    }
    return parsedValue
  })
}
