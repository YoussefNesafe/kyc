import { parseSubmission, type ParseSubmissionOptions } from "../core/parseSubmission";
import type { ServerErrorResult } from "../core/serverErrors";
import type { InferValues } from "../core/inferValues";
import type { FormConfig } from "../core/types";

export type FormActionResult<T> =
  | ({ ok: true } & T)
  | { ok: false; errors: ServerErrorResult };

function isFieldErrorLike(value: unknown): value is ServerErrorResult {
  return typeof value === "object" && value !== null && ("fieldErrors" in value || "formError" in value);
}

export function createFormAction<C extends FormConfig, R extends { ok: true }>(
  config: C,
  handler: (data: InferValues<C>) => Promise<R>,
  opts?: ParseSubmissionOptions,
) {
  return async (body: unknown): Promise<FormActionResult<Omit<R, "ok">>> => {
    const parsed = parseSubmission(config, body, opts);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    try {
      return await handler(parsed.values);
    } catch (e) {
      if (isFieldErrorLike(e)) return { ok: false, errors: e };
      throw e;
    }
  };
}
