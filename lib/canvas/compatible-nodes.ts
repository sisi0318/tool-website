import { getAllNodes } from "./registry"
import type { ConfigField, DataType, NodeDefinition } from "./types"
import { validateConnection } from "./validation"

/** 往哪边接：downstream 是接在一个输出后面，upstream 是接在一个输入前面 */
export type ConnectDirection = "downstream" | "upstream"

export interface CompatibleNodeOption {
  definition: NodeDefinition
  /**
   * 这个节点上能和手上那个端口接起来的端口：
   * 往后接时是它的输入，往前接时是它的输出。
   */
  ports: ConfigField[]
  defaultPortId: string
}

type CategoryLabelResolver = (category: NodeDefinition["category"]) => string

function normalizeSearchValue(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
}

/** 类型完全一致的排在前面，其余保持注册顺序 */
function rankExactFirst(options: CompatibleNodeOption[], dataType: DataType): CompatibleNodeOption[] {
  const hasExact = (option: CompatibleNodeOption) => option.ports.some((port) => port.dataType === dataType)
  return options.sort((a, b) => Number(hasExact(b)) - Number(hasExact(a)))
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
    const ports = definition.config.filter(
      (field) => field.hasInput && validateConnection(sourceField, field).valid
    )

    if (ports.length === 0) return []

    const defaultPort = ports.find((field) => field.dataType === sourceDataType) ?? ports[0]
    return [{ definition, ports, defaultPortId: defaultPort.id }]
  })

  return rankExactFirst(options, sourceDataType)
}

/**
 * 反过来：哪些节点能把数据送进一个 targetDataType 的输入。
 * 节点的运算结果排在它“能往外连的参数”前面（编码解码的结果在前，“编码方式”“模式”在后），
 * 和自动连线是同一个原则；默认用类型完全一致的那个输出。
 */
export function getCompatibleSourceOptions(
  targetDataType: DataType,
  definitions: readonly NodeDefinition[] = getAllNodes()
): CompatibleNodeOption[] {
  const targetField: ConfigField = {
    id: "__compatible_node_picker_target__",
    name: "Target",
    dataType: targetDataType,
    hasInput: true,
  }

  const options = definitions.flatMap((definition) => {
    const outputs: ConfigField[] = [
      ...definition.outputs,
      ...definition.config.filter((field) => field.hasOutput),
    ]
    const ports = outputs.filter((port) => validateConnection(port, targetField).valid)

    if (ports.length === 0) return []

    const defaultPort = ports.find((port) => port.dataType === targetDataType) ?? ports[0]
    return [{ definition, ports, defaultPortId: defaultPort.id }]
  })

  return rankExactFirst(options, targetDataType)
}

/** Filters compatible options without changing their exact-type-first order. */
export function filterCompatibleNodeOptions(
  options: readonly CompatibleNodeOption[],
  query: string,
  getCategoryLabel?: CategoryLabelResolver,
  getLabel?: (definition: CompatibleNodeOption["definition"]) => string
): CompatibleNodeOption[] {
  const normalizedQuery = normalizeSearchValue(query.trim())
  if (!normalizedQuery) return [...options]

  return options.filter(({ definition }) => {
    const searchableValues = [
      getLabel?.(definition),
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
