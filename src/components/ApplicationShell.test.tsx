import { useEffect, useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { APPLICATION_FORM, APPLICATION_FORM_ID } from "@/config/applicationForm";
import { sampleValues } from "@/config/sampleData";
import { draftConfigHash, draftStorageKey } from "@/form-builder/core/autosave";
import { ApplicationShell } from "./ApplicationShell";

/**
 * The shell's job is the URL, and everything here is about the URL: which one a
 * step change asks for, which one an unavailable step is turned into, and what
 * survives one. The engine's own behaviour — validation gating, the step list,
 * the fields themselves — is covered by the engine's suite and is not re-tested
 * here. Nothing below asserts a class name.
 */

/**
 * A stand-in router that actually routes.
 *
 * A `push` that only records its argument would test half the loop: the shell
 * asks for a URL, and the step it renders next comes back from that URL. So the
 * mock moves the slug and wakes the tree, which is what the real router does,
 * and every assertion below is then about the whole cycle rather than about a
 * spy having been called.
 */
let slug = "account-type";
const listeners = new Set<() => void>();

function setSlug(path: string): void {
  slug = path.replace("/apply/", "");
  for (const listener of listeners) listener();
}

const push = vi.fn(setSlug);
const replace = vi.fn(setSlug);
const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, prefetch, back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ step: slug }),
}));

function Harness() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  return <ApplicationShell />;
}

function seedDraft(values: Record<string, unknown>, step?: number): void {
  window.sessionStorage.setItem(
    draftStorageKey(APPLICATION_FORM_ID),
    JSON.stringify({ hash: draftConfigHash(APPLICATION_FORM.fields), values, step }),
  );
}

function liveRegionText(): string {
  return document.querySelector("[aria-live='polite']")?.textContent ?? "";
}

// `globals` is off in vitest.config.ts, so Testing Library's automatic teardown
// never registers and every render would stack in the same document.
afterEach(cleanup);

beforeEach(() => {
  slug = "account-type";
  push.mockClear();
  replace.mockClear();
  prefetch.mockClear();
  window.sessionStorage.clear();
});

describe("ApplicationShell", () => {
  it("renders the step the slug names", async () => {
    render(<Harness />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Open an account");
    expect(await screen.findByText(/who is this account for/i)).toBeDefined();
  });

  it("prefetches every step route, so a push is a client transition", () => {
    render(<Harness />);
    expect(prefetch.mock.calls.map(([path]) => path)).toEqual([
      "/apply/account-type",
      "/apply/personal-details",
      "/apply/tax-residency",
      "/apply/documents",
      "/apply/review",
    ]);
  });

  it("pushes the next step's route when the wizard advances", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /fill this step with sample data/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/apply/personal-details"));
  });

  /**
   * The guard, from the direction a stranger meets it: a URL typed with nothing
   * answered. `replace`, not `push` — the rejected URL must not become a Back
   * destination that bounces them a second time.
   */
  it("redirects a deep link that runs ahead of the answers, and says so", async () => {
    slug = "review";
    render(<Harness />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/apply/account-type"));
    expect((await screen.findByRole("status")).textContent).toMatch(/is not open yet/i);
    // And it settles there: the engine reports the step it had already reached,
    // which the shell clamps to the same landing rather than pushing back.
    expect(push.mock.calls.flat()).not.toContain("/apply/review");
    expect(slug).toBe("account-type");
  });

  it("lets a deep link through to the furthest step the answers allow", async () => {
    seedDraft(sampleValues({ country: "DE", accountType: "individual" }));
    slug = "documents";
    render(<Harness />);

    await waitFor(() => expect(screen.queryByText(/is not open yet/i)).toBeNull());
    expect(replace).not.toHaveBeenCalled();
  });

  /**
   * The select in the second assertion is not decoration. A `select` that is on
   * screen when the draft lands does not keep its restored value — traced in
   * Chrome to the engine's Radix-backed `SelectField`, whose options are not
   * mounted while it is closed — and the shell re-applies the draft in
   * `onDraftRestore` to put it back. Without that, a resumed visitor pressed
   * Continue and nothing happened, because the wizard was gating on a field
   * they could not see they had lost.
   */
  it("restores a draft left in the tab, every field of it, and says so", async () => {
    seedDraft({ accountType: "individual", accountPurpose: "long-term" });
    render(<Harness />);

    expect(await screen.findByText(/your answers are back/i)).toBeDefined();
    await waitFor(() => {
      const individual = screen.getByRole("radio", { name: /an individual account/i });
      expect(individual.getAttribute("data-state") ?? individual.getAttribute("aria-checked")).toMatch(
        /checked|true/,
      );
    });
    await waitFor(() =>
      expect(screen.getByRole("combobox").textContent).toContain("Long-term investing"),
    );
  });

  /**
   * Files are never written to the draft, so a visitor resuming from the
   * documents step onward has to choose them again. Saying so is the difference
   * between a considered restore and an empty dropzone.
   */
  it("warns that files need re-choosing when the draft resumed past them", async () => {
    seedDraft(sampleValues({ country: "DE", accountType: "individual" }), 3);
    slug = "documents";
    render(<Harness />);

    expect(await screen.findByText(/files are never kept/i)).toBeDefined();
  });

  /**
   * And it retires when they carry on. Deliberately keyed on moving *past* the
   * restored step rather than on any step change: the restore itself causes a
   * navigation, and clearing on that would wipe the notice before it was read.
   */
  it("drops the resumed notice once the visitor moves past where the draft left them", async () => {
    seedDraft({ accountType: "individual", accountPurpose: "long-term" }, 0);
    render(<Harness />);

    expect(await screen.findByText(/your answers are back/i)).toBeDefined();
    // And says nothing about files: this draft was left on the first step, where
    // none had been chosen. The claim is keyed to the documents step's index,
    // which used to fall back to `-1` when the slug could not be found — a
    // comparison every draft satisfies, so every restore claimed files had been
    // cleared. `Number.MAX_SAFE_INTEGER` fails the other way.
    expect(screen.queryByText(/files are never kept/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(slug).toBe("personal-details"));
    await waitFor(() => expect(screen.queryByText(/your answers are back/i)).toBeNull());
  });

  /**
   * The regression test for a bug only a browser found. The engine's
   * `SubmitField` disables itself on `!formState.isValid`, and react-hook-form's
   * `formState` is a lazy proxy: nothing subscribes to `isValid` until that
   * button mounts, so the verdict published while the visitor was still on the
   * documents step re-rendered nobody, and the snapshot the button read on its
   * own first render was the initial `false`. A visitor who answered everything
   * correctly reached the review step with a dead Submit and nothing to explain
   * it. The shell re-publishes the verdict on arrival — after the subscriber
   * exists — and this asserts the button is live. The full mechanism, and the
   * upstream fix that is not available from here, are on the guard effect.
   */
  it("leaves Submit usable on a review step reached with a complete application", async () => {
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    seedDraft(sampleValues({ country: "DE", accountType: "individual" }));
    slug = "documents";

    render(<Harness />);

    // Files are never in a draft, so they are attached the way a visitor would:
    // through the inputs the documents step renders.
    const inputs = await waitFor(() => {
      const found = document.querySelectorAll<HTMLInputElement>("input[type=file]");
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    for (const input of inputs) {
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      fireEvent.change(input);
    }

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(slug).toBe("review"));

    await waitFor(() => {
      const submit = screen.getByRole("button", { name: /submit application/i }) as HTMLButtonElement;
      expect(submit.disabled).toBe(false);
    });
  });

  /**
   * The engine ships no live region on purpose — it moves focus to the step list
   * and leaves the wording to the host, because "Step 2 of 5, Your details"
   * needs interpolation its message bundle has no slot for. This is that copy.
   *
   * The region carries the current step from the first paint, which is what
   * keeps arrival silent: a live region's initial content is not announced, only
   * a change to it. That is a property of the platform rather than of this
   * markup, so what is asserted here is the thing the assertion can see — that
   * the text is present on arrival and that it moves with the step.
   */
  it("announces each step it moves to", async () => {
    render(<Harness />);
    expect(liveRegionText()).toBe("Step 1 of 5, Account type");

    fireEvent.click(screen.getByRole("button", { name: /fill this step with sample data/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(liveRegionText()).toBe("Step 2 of 5, Your details"));
  });

  /**
   * The guard's notice belongs to the step it sent the visitor to, and to that
   * visit of it. Before this it was only *hidden* when they moved on, so
   * arriving back on the same step re-raised a correction about a URL typed two
   * navigations ago — a notice appearing for no reason the visitor could
   * connect to anything they had just done.
   */
  it("does not re-raise the progress notice on a later visit to the same step", async () => {
    slug = "review";
    render(<Harness />);

    await waitFor(() => expect(slug).toBe("account-type"));
    expect((await screen.findByRole("status")).textContent).toMatch(/is not open yet/i);

    fireEvent.click(screen.getByRole("button", { name: /fill this step with sample data/i }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(slug).toBe("personal-details"));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() => expect(slug).toBe("account-type"));
    expect(screen.queryByText(/is not open yet/i)).toBeNull();
  });

  /**
   * The success state is a fact about the review step, and the URL is allowed to
   * contradict it. Before this, submitting and then going Back left "Application
   * complete" on screen at `/apply/documents` with the live region announcing
   * "Step 4 of 5, Documents" — in a shell whose whole claim is that the URL is
   * the step, the one screen where the claim was false.
   */
  it("shows a reference and states that nothing was transmitted, then yields to the URL", async () => {
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    seedDraft(sampleValues({ country: "DE", accountType: "individual" }));
    slug = "documents";
    render(<Harness />);

    const inputs = await waitFor(() => {
      const found = document.querySelectorAll<HTMLInputElement>("input[type=file]");
      expect(found.length).toBeGreaterThan(0);
      return found;
    });
    for (const input of inputs) {
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      fireEvent.change(input);
    }

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(slug).toBe("review"));

    const submit = await waitFor(() => {
      const button = screen.getByRole("button", { name: /submit application/i }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      return button;
    });
    fireEvent.click(submit);

    expect(await screen.findByText(/no data was transmitted/i)).toBeDefined();
    // The reference is the one thing on that screen that looks like it came back
    // from a server, so its shape is asserted rather than its presence.
    expect(screen.getByText(/^MM-[0-9A-Z]{4}-[0-9A-Z]{4}$/)).toBeDefined();

    // A browser Back is nothing but a slug change, which is how it arrives here.
    setSlug("/apply/documents");
    await waitFor(() => expect(screen.queryByText(/no data was transmitted/i)).toBeNull());
    // And the application really is gone: the draft went with the submit, so the
    // guard sends an empty application back to the first step.
    await waitFor(() => expect(slug).toBe("account-type"));
  });

  /**
   * An unknown slug is the page's 404 to raise. The shell renders nothing so a
   * not-found message is not served underneath a live application form.
   */
  it("renders nothing for a slug that is not a step", () => {
    slug = "nonsense";
    const { container } = render(<Harness />);
    expect(container.innerHTML).toBe("");
  });
});
