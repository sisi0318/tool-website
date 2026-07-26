import type { MetadataRoute } from "next"
import { TOOL_IDS } from "@/lib/tool-metadata"
import { getSiteUrl } from "@/lib/site-url"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/tools`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/canvas`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/journey`, changeFrequency: "monthly", priority: 0.7 },
  ]

  const toolRoutes: MetadataRoute.Sitemap = TOOL_IDS.map((toolId) => ({
    url: `${base}/tools/${toolId}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }))

  return [...staticRoutes, ...toolRoutes]
}
