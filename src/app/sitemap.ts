import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/config/seo";

/**
 * `/sitemap.xml`, built from the route table.
 *
 * `lastModified` is stamped at build time, which is the honest answer for a
 * statically prerendered site: the content of every one of these URLs is fixed
 * when the bundle is. Passing it in rather than reading the clock inside
 * `sitemapEntries` keeps that function pure and its test free of a frozen timer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(new Date());
}
