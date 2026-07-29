import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormRenderer } from "@/form-builder/components/FormRenderer";
import type { FormConfig } from "@/form-builder/core/types";
import { loadDocumentField } from "./deferred";
import { registerBuiltInFields } from "./registerBuiltInFields";

/**
 * What is worth testing about the demo's document field is the part the engine
 * does not already cover: the simulated upload, and its relationship with the
 * verdict. The dropzone, the accessible name, the per-index error mapping and
 * the schema itself all belong to the engine's own suite.
 *
 * Rendered through `FormRenderer` rather than in isolation on purpose. The
 * whole claim of this field is that its per-file status comes from the schema
 * by way of react-hook-form, so a test that stubbed the form context would be
 * asserting the one thing it should be proving.
 */

registerBuiltInFields();

const config: FormConfig = {
  id: "document-field-test",
  title: "Documents",
  fields: [
    {
      type: "file",
      name: "identity",
      label: "Photo identity document",
      required: true,
      accept: ".pdf",
      maxSizeMB: 5,
    },
  ],
};

/**
 * `file` is code-split — see `src/fields/deferred.ts` — so the component the
 * registry hands back is a `next/dynamic` wrapper, and it renders nothing on the
 * first pass. Loading the module up front makes the import cache warm; the
 * `act` flush inside `renderField` is what lets React commit the resolved
 * component before a test goes looking for its file input.
 *
 * This is the deferral being asserted rather than worked around: a field that
 * arrives a tick late is exactly what production now does.
 */
beforeAll(async () => {
  await loadDocumentField();
});

async function renderField() {
  const result = render(<FormRenderer config={config} onSubmit={() => {}} />);
  await act(async () => {});
  return result;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[type=file]");
  if (!input) throw new Error("no file input rendered");
  return input;
}

/**
 * How a file reaches the field. `files` is read-only on a real input, so the
 * list is defined onto the node and the change event fired by hand — the same
 * thing a picker does, minus the picker.
 */
function attach(files: File[]): void {
  const input = fileInput();
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

const pdf = (name = "passport.pdf") => new File(["x"], name, { type: "application/pdf" });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the document field", () => {
  /**
   * The point of the whole ordering in `acceptFiles`: put the file in the
   * value, let the schema judge it, and only then start an upload. A rejected
   * file must never show one — refusing to upload a file you have just refused
   * is the correct behaviour, not a cosmetic detail — and it must still say why
   * it was refused, in its own row.
   */
  it("keeps a rejected file, explains it, and never starts an upload for it", async () => {
    await renderField();

    attach([new File(["x"], "scan.tiff", { type: "image/tiff" })]);

    // Twice on purpose: once in the row it is about, once in the field's
    // `role="alert"` region, which is the only part of the field that announces.
    expect(await screen.findAllByText(/isn't in a format we accept/i)).toHaveLength(2);
    expect(screen.getByText("scan.tiff")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(document.querySelector('[data-slot="document-row"]')?.getAttribute("data-status")).toBe(
      "rejected",
    );
  });

  /**
   * And the accepted case, which is the part that is not in the engine at all.
   * The bar is a `progressbar` with a value rather than a decorated div, so the
   * assertion can read what a screen-reader user would be told.
   */
  it("runs a simulated upload for an accepted file and then settles on Attached", async () => {
    vi.useFakeTimers();
    await renderField();

    attach([pdf()]);
    // Lets the eager `trigger` resolve: the upload starts on the far side of
    // the schema's verdict, not on the change event.
    await act(async () => {});

    const bar = screen.getByRole("progressbar", { name: /simulated upload of passport\.pdf/i });
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThan(100);
    expect(screen.getByText(/nothing is being uploaded/i)).toBeDefined();

    await act(async () => {
      // Comfortably past the longest simulated duration.
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Attached")).toBeDefined();
    expect(document.querySelector('[data-slot="document-row"]')?.getAttribute("data-status")).toBe(
      "attached",
    );
  });

  /**
   * Reachable by dropping rather than by picking — the `multiple` attribute
   * stops the OS dialog returning more than one file, but a drop carries
   * whatever the pointer was holding. Saying which file was kept is the whole
   * point: silently keeping one of three is how a visitor submits without the
   * document they meant to attach.
   */
  it("says so when a single-file field has no room for what was dropped on it", async () => {
    await renderField();

    attach([pdf("first.pdf"), pdf("second.pdf")]);

    expect(await screen.findByText(/only one file can go here — kept first\.pdf/i)).toBeDefined();
    await waitFor(() => expect(screen.queryByText("second.pdf")).toBeNull());
  });

  /**
   * Removing the row that is mid-upload has to take the timer with it. Without
   * the `forgetUpload`, the interval outlives the row it was painting and goes
   * on calling `setProgress` for a file that is no longer in the value.
   */
  it("stops the simulated upload when its file is removed", async () => {
    vi.useFakeTimers();
    await renderField();

    attach([pdf()]);
    await act(async () => {});
    expect(screen.getByRole("progressbar")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /remove passport\.pdf/i }));
    await act(async () => {});

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("passport.pdf")).toBeNull();
    // Nothing left to repaint, and nothing throws trying.
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
