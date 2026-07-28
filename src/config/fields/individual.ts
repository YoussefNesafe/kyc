import type { AnyFieldConfig } from "@/form-builder/core/types";
import { latestDobForAge } from "@/lib/age";

/** What one account-type branch contributes, keyed by the step it lands on. */
export type BranchFields = {
  personalFields: AnyFieldConfig[];
  documentFields: AnyFieldConfig[];
};

const MINIMUM_AGE_YEARS = 18;

/**
 * The individual branch. Nothing here declares a `visibleWhen` —
 * `buildFormConfig` stamps the `accountType` guard, for the same reason the
 * jurisdiction files declare none.
 *
 * `now` is a parameter rather than a module-level `new Date()` so the age
 * cutoff is pinned by the caller: `draftConfigHash` hashes the fields, and a
 * `maxDate` that moved between two calls in one session would throw away the
 * visitor's draft.
 */
export function individualFields(now: Date): BranchFields {
  return {
    personalFields: [
      {
        type: "text",
        name: "fullName",
        label: "Full legal name",
        required: true,
        // WCAG 2.2 SC 1.3.5. Every field on this step asking about the person
        // filling it in carries its purpose token, because the label alone does
        // not: "Full legal name" and "Vollständiger Name" are one purpose to a
        // reader and none at all to a parser, and 1.3.5 exists so a browser can
        // fill this and an assistive tool can re-label it with the vocabulary
        // its user knows. The tokens are the ones in
        // https://www.w3.org/TR/WCAG22/#input-purposes — not free text.
        autocomplete: "name",
        placeholder: "As printed on your passport",
        rules: { minLength: 2, maxLength: 80, trim: true },
      },
      {
        type: "date",
        name: "dateOfBirth",
        label: "Date of birth",
        required: true,
        // "bday" is the right token and it is set deliberately, but be clear
        // about what it does here: nothing yet. The engine's `date` field is a
        // calendar in a popover behind a <button>, and there is no input for
        // the browser to fill, so the attribute never reaches the DOM. It is
        // declared so the config states the field's purpose truthfully and so
        // it starts working the day the date field grows a typed entry path.
        // 1.3.5 is not failed by its absence on a control that is not an input
        // field — but the config should not have to be re-derived later.
        autocomplete: "bday",
        maxDate: latestDobForAge(MINIMUM_AGE_YEARS, now),
        message: "You must be 18 or older to open a Meridian Markets account.",
        // The bound states a rule rather than an unavailable range. Under the
        // default "restrict" the calendar would grey out every date after the
        // cutoff — two-thirds of a lifetime — and a seventeen-year-old would be
        // left unable to select their own birthday with nothing on screen
        // explaining why. "validate" keeps those days pickable so the sentence
        // above can be the answer.
        pickerBounds: "validate",
        width: "half",
      },
      {
        type: "country",
        name: "nationality",
        label: "Nationality",
        required: true,
        // No `autocomplete`, and not an oversight: the spec's `country` token
        // means the country of an *address*, which is not what nationality is.
        // There is no purpose token for citizenship, and 1.3.5 asks for the
        // right token or none — a near-miss is worse than a gap, because it
        // tells a browser to fill this from the user's postal address.

        preferredCountries: ["DE", "US", "AE"],
        width: "half",
      },
      {
        type: "email",
        name: "email",
        label: "Email address",
        required: true,
        autocomplete: "email",
        rules: { trim: true },
        width: "half",
      },
      {
        type: "phone",
        name: "phone",
        label: "Mobile number",
        required: true,
        // The label asks for a mobile specifically, so the token says so.
        // Without this the field still carries react-phone-number-input's own
        // "tel" default — the one control on this step that was already
        // conformant, and by accident rather than by configuration.
        autocomplete: "mobile tel",
        preferredCountries: ["DE", "US", "AE"],
        width: "half",
      },
      {
        type: "textarea",
        name: "residentialAddress",
        label: "Residential address",
        required: true,
        // "street-address" is the multi-line whole-address token, which is what
        // this textarea collects — not "address-line1", which names only the
        // first line of a split address and would mis-describe a field that
        // asks for the apartment and floor too.
        autocomplete: "street-address",
        placeholder: "Street and number, plus any apartment or floor",
        rules: { minLength: 5, maxLength: 200, trim: true },
        description: "Where you actually live. A postbox is not enough for identity checks.",
      },
      {
        type: "text",
        name: "postalCode",
        label: "Postal code",
        required: true,
        autocomplete: "postal-code",
        rules: { maxLength: 12, trim: true },
        width: "third",
      },
      {
        type: "text",
        name: "city",
        label: "City",
        required: true,
        // "address-level2" is the city, in the spec's country-neutral levels
        // (level1 = state/province, level2 = city, level3 = suburb). There is
        // no "city" token; writing one would be a silent 1.3.5 failure that
        // looks conformant.
        autocomplete: "address-level2",
        rules: { maxLength: 60, trim: true },
        width: "third",
      },
    ],

    documentFields: [
      {
        type: "file",
        name: "identityDocument",
        label: "Photo identity document",
        required: true,
        accept: ".jpg,.jpeg,.png,.pdf",
        maxSizeMB: 5,
        description:
          "Passport, national ID card or driving licence. JPG, PNG or PDF up to 5 MB — a TIFF will be turned away with the reason. The file is read in this tab and never uploaded.",
      },
      {
        type: "file",
        name: "supportingDocuments",
        label: "Anything else you want to attach",
        multiple: true,
        accept: ".jpg,.jpeg,.png,.pdf",
        maxSizeMB: 5,
        description: "Optional, and checked one file at a time — each rejection names the file it is about.",
      },
    ],
  };
}
