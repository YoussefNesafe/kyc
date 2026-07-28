import { ImageResponse } from "next/og";
import { AUTHOR_NAME, LANDING_TITLE, OG_IMAGE_ALT } from "@/config/seo";

/**
 * The Open Graph card, generated once at build time.
 *
 * ## Why generated rather than a committed PNG
 *
 * The headline below is `LANDING_TITLE`, the same constant the `<title>` is
 * built from. A committed image is a screenshot of a decision, and it goes stale
 * the first time the decision changes — silently, because nothing type-checks a
 * PNG. This one cannot disagree with the page it advertises.
 *
 * ## Why it does not use Inter Tight
 *
 * `next/og` cannot reach the font data `next/font` caches during the build, so
 * matching the site's typeface would mean committing a `.ttf` to the repo for
 * the sake of an image nobody sees next to the site. The default sans is used
 * instead. The palette is the site's, taken from `globals.css`.
 *
 * ## Why this does not break the no-egress promise
 *
 * This route has no request-time API and no uncached data, so Next prerenders it
 * at build time and serves a static asset. Nothing is fetched when a visitor
 * loads the page, and `e2e/no-data-egress.spec.ts` stays green.
 */

export const alt = OG_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** From `src/app/globals.css` — the light theme's background, foreground and single accent. */
const BACKGROUND = "#F6F7F7";
const FOREGROUND = "#12181A";
const ACCENT = "#0F5C5A";
const MUTED = "#5A6568";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BACKGROUND,
          color: FOREGROUND,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            Portfolio demonstration
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 76,
              lineHeight: 1.06,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            {LANDING_TITLE.split(" — ")[0]}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.35,
              color: MUTED,
              maxWidth: 860,
            }}
          >
            The questions change with where you are tax resident. Held as
            configuration, not written into components.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `4px solid ${ACCENT}`,
            paddingTop: 28,
            fontSize: 26,
          }}
        >
          <div style={{ display: "flex", fontWeight: 600 }}>{AUTHOR_NAME}</div>
          <div style={{ display: "flex", color: MUTED }}>
            Demo only — nothing is sent anywhere
          </div>
        </div>
      </div>
    ),
    size,
  );
}
