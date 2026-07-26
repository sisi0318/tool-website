/**
 * localStorage helpers that never throw.
 *
 * Direct localStorage access can throw in several real environments:
 * SSR (no window), Safari private mode / blocked storage (SecurityError),
 * and full quotas (QuotaExceededError). Reads degrade to null and writes
 * report success via the boolean return value.
 */

export function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeLocalStorage(key: string): boolean {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
