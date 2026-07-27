import { describe, expect, it } from "vitest";
import { getField, getRegisteredTypes } from "@/form-builder/core/registry";
import type { AnyFieldConfig } from "@/form-builder/core/types";
import { APPLICATION_FORM } from "@/config/applicationForm";
import { registerBuiltInFields } from "./registerBuiltInFields";

registerBuiltInFields();

/** Every type in the config, including the ones nested inside a `group`. */
function typesIn(fields: AnyFieldConfig[]): Set<string> {
  const types = new Set<string>();
  for (const field of fields) {
    types.add(field.type);
    if (field.type === "group") {
      for (const type of typesIn((field as { fields: AnyFieldConfig[] }).fields)) types.add(type);
    }
  }
  return types;
}

describe("registerBuiltInFields", () => {
  /**
   * The test that would have caught the whole class of bug this file exists to
   * prevent: an unregistered type is not a crash, it is a field that quietly
   * renders "Unknown field type" in development and *nothing* in production.
   * Driven off the real config, so adding a field type to a jurisdiction fails
   * here rather than in a browser.
   */
  it("registers a component for every field type the application config uses", () => {
    const registered = new Set(getRegisteredTypes());
    const missing = [...typesIn(APPLICATION_FORM.fields)].filter((type) => !registered.has(type));
    expect(missing).toEqual([]);
  });

  /**
   * `email`, `number` and `textarea` share `TextField` but are separate keys —
   * the registry is the only lookup, and registering `text` alone would leave
   * the other three unknown.
   */
  it("registers the TextField aliases under their own names", () => {
    const text = getField("text");
    expect(text).toBeDefined();
    for (const alias of ["email", "number", "textarea"]) {
      expect(getField(alias)).toBe(text);
    }
  });

  it("is idempotent", () => {
    const before = getField("text");
    registerBuiltInFields();
    expect(getField("text")).toBe(before);
  });
});
