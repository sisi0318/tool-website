export function extractDomain(text: string): string {
  try {
    const url = new URL(text)
    return url.hostname
  } catch (e) {
    // Not a valid URL, return the original text
    return text
  }
}

export function extractTLD(domain: string): string {
  const parts = domain.split(".")
  return parts.length > 1 ? parts[parts.length - 1] : ""
}
