import type { MetadataRoute } from "next";
import { robotsPolicy } from "@/config/seo";

/**
 * `/robots.txt`.
 *
 * The policy itself lives in `@/config/seo` so it can be tested at both of its
 * branches; this file's only job is to read the one piece of environment it
 * depends on. `VERCEL_ENV` is `"production"` only on a production deployment —
 * it is `"preview"` on every preview URL and absent locally, both of which get
 * `Disallow: /`. See `robotsPolicy` for why that matters more here than it
 * usually would.
 */
export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(process.env.VERCEL_ENV);
}
