"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, type ReactNode } from "react";
import { APPLICATION_ENTRY_PATH } from "@/config/routes";

/**
 * The landing page's one call to action, with its prefetch moved off the load.
 *
 * ## The problem this exists to solve
 *
 * A plain `<Link href="/apply/account-type">` sits in the hero, so it is in the
 * viewport immediately, so Next prefetches the route it points at as soon as the
 * page loads. That route is the whole form engine. Measured against the
 * deployed origin, the landing page pulled **291 KiB of JavaScript that it
 * reported as 100% unused** — a chunk the HTML never references, requested at
 * 2.3 s, still inside the window that decides LCP on a throttled connection.
 *
 * The visitor pays for the entire application before deciding whether to open
 * it, and on the one page whose job is to be read quickly.
 *
 * ## Why not simply `prefetch={false}`
 *
 * Because it means what it says: *"Prefetching will never happen both on
 * entering the viewport and on hover"*
 * (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md:304`).
 * That trades 291 KiB of waste for a cold click on the primary action, which is
 * a worse deal than the one it replaces.
 *
 * So the prefetch is kept and merely moved to the first sign of intent. A mouse
 * user warms it on hover, a keyboard user on focus, a touch user on `touchstart`
 * — each of which precedes the actual click by enough to have the chunk in cache
 * by the time it is needed. What is removed is only the case that never pays
 * off: fetching the form for someone who reads the page and leaves.
 *
 * `warmed` is a ref rather than state because nothing renders differently once
 * it flips; re-rendering the button on hover would be a worse trade than the
 * duplicate `prefetch` call it avoids. The router deduplicates repeat prefetches
 * itself, so the guard is about not queueing work, not about correctness.
 */
export function StartApplicationLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const warmed = useRef(false);

  const warm = useCallback(() => {
    if (warmed.current) return;
    warmed.current = true;
    router.prefetch(APPLICATION_ENTRY_PATH);
  }, [router]);

  return (
    <Link
      href={APPLICATION_ENTRY_PATH}
      prefetch={false}
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className={className}
    >
      {children}
    </Link>
  );
}
