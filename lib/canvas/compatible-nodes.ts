import { getAllNodes } from "./registry"
import type { ConfigField, DataType, NodeDefinition } from "./types"
import { validateConnection } from "./validation"

export interface CompatibleNodeOption {
  definition: NodeDefinition
  compatibleInputs: ConfigField[]
  defaultTargetPortId: string
}

type CategoryLabelResolver = (category: NodeDefinition["category"]) => string

function normalizeSearchValue(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
}

/**
 * Finds registered nodes with at least one input accepted by the central
 * connection validator. Exact input types are preferred for the default port;
 * adapter config order breaks ties because adapters put their primary input
 * first.
 */
export function getCompatibleNodeOptions(
  sourceDataType: DataType,
  definitions: readonly NodeDefinition[] = getAllNodes()
): CompatibleNodeOption[] {
  const sourceField: ConfigField = {
    id: "__compatible_node_picker_source__",
    name: "Source",
    dataType: sourceDataType,
  }

  const options = definitions.flatMap((definition) => {
    const compatibleInputs = definition.config.filter(
      (field) => field.hasInput && validateConnection(sourceField, field).valid
    )

    if (compatibleInputs.length === 0) return []

    const defaultInput =
      compatibleInputs.find((field) => field.dataType === sourceDataType) ??
      compatibleInputs[0]

    return [{
      definition,
      compatibleInputs,
      defaultTargetPortId: defaultInput.id,
    }]
  })

  return options.sort((a, b) => {
    const aHasExactInput = a.compatibleInputs.some(
      (field) => field.dataType === sourceDataType
    )
    const bHasExactInput = b.compatibleInputs.some(
      (field) => field.dataType === sourceDataType
    )
    return Number(bHasExactInput) - Number(aHasExactInput)
  })
}

/** Filters compatible options without changing their exact-type-first order. */
export function filterCompatibleNodeOptions(
  options: readonly CompatibleNodeOption[],
  query: string,
  getCategoryLabel?: CategoryLabelResolver
): CompatibleNodeOption[] {
  const normalizedQuery = normalizeSearchValue(query.trim())
  if (!normalizedQuery) return [...options]

  return options.filter(({ definition }) => {
    const searchableValues = [
      definition.label,
      definition.description,
      definition.type,
      definition.category,
      getCategoryLabel?.(definition.category),
    ]

    return searchableValues.some(
      (value) => value && normalizeSearchValue(value).includes(normalizedQuery)
    )
  })
}
