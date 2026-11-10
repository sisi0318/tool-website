"use client"

import { useCallback } from "react"
import type { Connection } from "@xyflow/react"
import { useCanvasStore } from "@/lib/canvas/store"
import { getNodeDefinition } from "@/lib/canvas/registry"
import {
  validateConnection,
  type ConnectionValidationResult,
} from "@/lib/canvas/validation"
import type { CanvasNotify } from "./use-canvas-clipboard"

function describeRejection(
  result: ConnectionValidationResult,
  t: (key: string) => string,
  sourceType?: string,
  targetType?: string
): string {
  switch (result.code) {
    case "self-connection":
      return t("connectionSelf")
    case "duplicate-connection":
      return t("connectionDuplicate")
    case "target-port-occupied":
      return t("connectionOccupied")
    case "cycle":
      return t("connectionCycle")
    case "incompatible-types":
      return t("connectionIncompatible")
        .replace("{source}", sourceType ?? "?")
        .replace("{target}", targetType ?? "?")
    default:
      return result.message ?? t("connectionIncomplete")
  }
}

/**
 * 拖出一条连线并松在某个端口上时：校验类型、环和重复，通过了才写进 store；
 * 不通过就说明原因。目标端口已有连线时算“替换”，照样连上。
 */
export function useCanvasConnect(notify: CanvasNotify, t: (key: string) => string) {
  return useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        !connection.sourceHandle ||
        !connection.targetHandle
      ) {
        notify(t("connectionIncomplete"))
        return
      }

      const { nodes, edges, addEdge } = useCanvasStore.getState()
      const sourceNode = nodes.find((n) => n.id === connection.source)
      const targetNode = nodes.find((n) => n.id === connection.target)
      if (!sourceNode || !targetNode) {
        notify(t("connectionMissingNode"))
        return
      }

      const sourceDef = getNodeDefinition(sourceNode.type)
      const targetDef = getNodeDefinition(targetNode.type)
      if (!sourceDef || !targetDef) {
        notify(t("connectionMissingNode"))
        return
      }

      // Find source config field (has hasOutput=true) or derived output
      const sourceField = sourceDef.config.find(
        (f) => f.id === connection.sourceHandle && f.hasOutput
      )
      const sourceOutput = sourceDef.outputs.find(
        (o) => o.id === connection.sourceHandle
      )
      const targetField = targetDef.config.find(
        (f) => f.id === connection.targetHandle && f.hasInput
      )

      if ((!sourceField && !sourceOutput) || !targetField) {
        notify(t("connectionMissingPort"))
        return
      }

      // Create the source field-like object for validation
      const sourceForValidation = sourceField ?? {
        id: sourceOutput!.id,
        name: sourceOutput!.name,
        dataType: sourceOutput!.dataType,
      }

      const result = validateConnection(sourceForValidation, targetField, {
        existingEdges: edges,
        connection: {
          source: connection.source,
          sourcePort: connection.sourceHandle,
          target: connection.target,
          targetPort: connection.targetHandle,
        },
      })
      const replacesExistingInput = result.code === "target-port-occupied"
      if (!result.valid && !replacesExistingInput) {
        notify(describeRejection(result, t, sourceForValidation.dataType, targetField.dataType))
        return
      }

      addEdge({
        id: `edge-${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`,
        source: connection.source,
        sourcePort: connection.sourceHandle,
        target: connection.target,
        targetPort: connection.targetHandle,
      })
      if (replacesExistingInput) {
        notify(t("connectionReplaced"), "success")
      }
    },
    [notify, t]
  )
}
