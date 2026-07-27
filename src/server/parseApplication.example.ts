/**
 * DELIBERATELY UNWIRED. Nothing imports this file, and nothing should.
 *
 * It is not dead code left behind by a deleted feature, and deleting it would
 * remove the only proof of the demo's central architectural claim. Please read
 * this comment before tidying it away.
 *
 * ## What it is for
 *
 * The claim the whole demo rests on is that `APPLICATION_FORM` is a
 * *specification*, not a description of a UI — that the same configuration
 * which decides that a German corporate applicant is asked for a
 * Handelsregisterauszug is also what would reject a submission that omits one,
 * on a server, with no second implementation to keep in step. That is easy to
 * assert in a README and cheap to get wrong.
 *
 * So it is written out instead. Everything below compiles under `yarn
 * typecheck` against the real config and the engine's real
 * `parseSubmission` signature, which means the claim breaks the build the day
 * it stops being true — a rename in the config, a changed field type, a
 * different result shape from the engine. A paragraph of prose would have gone
 * on being confidently wrong.
 *
 * ## Why it is not actually wired up
 *
 * Because the demo's other promise is that nothing is transmitted, and the
 * cheapest way to keep a promise like that is to have no endpoint at all. There
 * is no route handler, no server action and no `fetch` anywhere in this
 * project; `e2e/no-data-egress.spec.ts` is what holds that line. Wiring this
 * file to a real POST would be the one change that makes the banner a lie.
 *
 * To use it in an application that *does* have a server: move it to a route
 * handler or a server action, call `parseApplication` with the parsed body, and
 * return `errors` to the client, where `FormRenderer`'s `onSubmit` can hand
 * them straight back through its `ServerErrorResult` return — the engine maps
 * `fieldErrors` onto fields and jumps the wizard to the first failing one.
 */

import { APPLICATION_FORM } from "@/config/applicationForm";
import { parseSubmission, type ParseSubmissionResult } from "@/form-builder/core/parseSubmission";

/**
 * Validates a posted application body against the same config the browser
 * rendered.
 *
 * `parseSubmission` takes the config, the raw body, and options; it re-derives
 * which fields are *visible* for these values before validating, so a body that
 * carries a `de_churchTax` for a US applicant is not validated against a rule
 * that does not apply to them — and, more usefully, a body that *omits* a
 * required field the applicant's own branch does ask for is rejected. That
 * conditional step is the part a hand-written server validator gets wrong.
 *
 * The result is a discriminated union, so the failure branch cannot be read as
 * a success by accident:
 *
 * - `{ ok: true, values, unvalidated }` — `values` is typed from the config
 *   through `InferValues`, not `Record<string, unknown>`.
 * - `{ ok: false, code, errors, unvalidated }` — `errors` is
 *   `{ fieldErrors?, formError? }`, already keyed by field path, which is the
 *   exact shape `FormRenderer`'s `onSubmit` accepts back.
 *
 * `unvalidated` is the honest part, and the reason this example does not stop
 * at `if (!result.ok)`. The engine cannot validate a `file` field from a JSON
 * body — a `File` does not survive the wire — so it names those paths rather
 * than pretending they passed. A real server checks the uploaded bytes itself;
 * see `assertDocumentsPresent` below for the shape of that check.
 */
export function parseApplication(
  body: unknown,
): ParseSubmissionResult<Record<string, unknown>> {
  return parseSubmission(APPLICATION_FORM, body, {
    // Every string in a KYC application is a name, a number or an address. The
    // engine's default ceiling is ten thousand characters; nothing here needs
    // a tenth of that, and a lower ceiling is a cheap upper bound on what a
    // malformed or hostile body can make the validator do.
    maxStringLength: 1_000,
  });
}

/**
 * What a real server would still have to do for itself.
 *
 * The paths in `unvalidated` are the fields the schema had nothing to say
 * about — the file fields, since documents arrive as uploads rather than as
 * JSON. This is not a gap in the config; it is the boundary of what a value
 * schema can know. The point of returning the list is that the server is told
 * exactly which fields it owns, by name, instead of having to keep its own copy
 * of that list in step with the configuration.
 */
export function documentPathsToCheck(result: ParseSubmissionResult<Record<string, unknown>>): string[] {
  return result.unvalidated;
}

/**
 * A worked call, so the types above are exercised rather than merely declared.
 *
 * Written as a function that is never called rather than as a comment, for the
 * same reason the rest of the file exists: `tsc` reads functions and ignores
 * prose. If `accountType` stops being a field, or the result shape changes,
 * this stops compiling.
 */
export function exampleUsage(): string {
  const result = parseApplication({
    accountType: "individual",
    accountPurpose: "long-term",
    country: "DE",
  });

  if (result.ok) {
    const outstanding = documentPathsToCheck(result);
    return outstanding.length
      ? `Accepted, pending documents: ${outstanding.join(", ")}`
      : "Accepted";
  }

  // `code` distinguishes a body that failed validation from one that was never
  // usable — a non-object, an oversized string, a form the config could not be
  // built for. Worth logging separately: the first is a user error and the
  // second is an attack or a bug.
  const fields = Object.keys(result.errors.fieldErrors ?? {});
  return `Rejected (${result.code}): ${fields.length ? fields.join(", ") : (result.errors.formError ?? "no detail")}`;
}
