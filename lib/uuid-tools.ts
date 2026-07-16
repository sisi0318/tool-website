import { v1 as uuidV1, v4 as uuidV4 } from "uuid"

export function generateUuidV1(): string {
  return uuidV1()
}

export function generateUuidV4(): string {
  return uuidV4()
}
