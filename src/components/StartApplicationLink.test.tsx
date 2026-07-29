import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StartApplicationLink } from "./StartApplicationLink";
import { APPLICATION_ENTRY_PATH } from "@/config/routes";

const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

/**
 * The contract is a negative one, and negatives rot quietly: someone swaps this
 * back to a plain `<Link>` a year from now, everything still works, and the
 * landing page silently starts paying 291 KiB for a route most of its visitors
 * never open again. Nothing about that shows up in a browser or a build.
 *
 * So the assertion that matters most here is the first: nothing is prefetched
 * until the visitor shows intent.
 */
describe("StartApplicationLink", () => {
  afterEach(cleanup);

  beforeEach(() => {
    prefetch.mockClear();
  });

  it("prefetches nothing on mount", () => {
    render(<StartApplicationLink>Start the application</StartApplicationLink>);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("still points at step one", () => {
    render(<StartApplicationLink>Start the application</StartApplicationLink>);
    expect(
      screen.getByRole("link", { name: "Start the application" }).getAttribute("href"),
    ).toBe(APPLICATION_ENTRY_PATH);
  });

  it.each([
    ["hover", (element: HTMLElement) => fireEvent.mouseEnter(element)],
    ["focus", (element: HTMLElement) => fireEvent.focus(element)],
    ["touch", (element: HTMLElement) => fireEvent.touchStart(element)],
  ])("warms the route on %s, so the click is not cold", (_label, act) => {
    render(<StartApplicationLink>Start the application</StartApplicationLink>);
    const link = screen.getByRole("link", { name: "Start the application" });

    act(link);

    expect(prefetch).toHaveBeenCalledWith(APPLICATION_ENTRY_PATH);
  });

  it("warms once, however many times intent is shown", () => {
    render(<StartApplicationLink>Start the application</StartApplicationLink>);
    const link = screen.getByRole("link", { name: "Start the application" });

    fireEvent.mouseEnter(link);
    fireEvent.focus(link);
    fireEvent.mouseEnter(link);

    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
