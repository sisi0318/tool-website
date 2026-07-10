import { describe, expect, it } from "vitest"
import { inferJsonSchema, validateJsonSchema } from "./json-schema-tools"

describe("JSON Schema tools", () => {
  it("validates JSON and reports useful paths", () => {
    const schema = { type: "object", properties: { age: { type: "integer", minimum: 0 } }, required: ["age"] }
    expect(validateJsonSchema({ age: 12 }, schema).valid).toBe(true)
    const invalid = validateJsonSchema({ age: -1 }, schema)
    expect(invalid.valid).toBe(false)
    expect(invalid.errors[0].path).toBe("/age")
  })

  it("infers nested object, array and string formats", () => {
    const schema = inferJsonSchema({ id: 1, email: "dev@example.com", tags: ["one", "two"] })
    expect(schema.type).toBe("object")
    expect(schema.properties).toMatchObject({
      id: { type: "integer" }, email: { type: "string", format: "email" }, tags: { type: "array", items: { type: "string" } },
    })
  })

  it("rejects invalid JSON strings", () => {
    expect(() => validateJsonSchema("{", {})).toThrow(/Data/)
  })

  it("validates standard string formats", () => {
    const result = validateJsonSchema('"not-an-email"', { type: "string", format: "email" })
    expect(result.valid).toBe(false)
    expect(result.errors[0].keyword).toBe("format")
  })

  it("keeps distinct schemas for heterogeneous array items", () => {
    const schema = inferJsonSchema([{ value: 1 }, { value: "one" }])
    expect(schema).toMatchObject({
      items: { anyOf: [{ properties: { value: { type: "integer" } } }, { properties: { value: { type: "string" } } }] },
    })
  })
})
