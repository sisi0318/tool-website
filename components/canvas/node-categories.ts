import {
  Braces,
  Eye,
  ImageIcon,
  LockKeyhole,
  Shapes,
  SquareTerminal,
  Type,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import type { NodeDefinition } from "@/lib/canvas/types"

export type NodeCategory = NodeDefinition["category"]

/** 节点库里分类的顺序 */
export const CATEGORY_IDS: readonly NodeCategory[] = [
  "basic",
  "crypto",
  "data",
  "image",
  "text",
  "dev",
  "utility",
  "viewer",
]

/** canvas 命名空间里各分类名称的键 */
export const CATEGORY_KEYS: Record<NodeCategory, string> = {
  basic: "categoryBasic",
  crypto: "categoryCrypto",
  data: "categoryData",
  image: "categoryImage",
  text: "categoryText",
  dev: "categoryDev",
  utility: "categoryUtility",
  viewer: "categoryViewer",
}

export const CATEGORY_ICONS: Record<NodeCategory, LucideIcon> = {
  basic: Shapes,
  crypto: LockKeyhole,
  data: Braces,
  image: ImageIcon,
  text: Type,
  dev: SquareTerminal,
  utility: Wrench,
  viewer: Eye,
}
