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
        placeholder: "As printed on your passport",
        rules: { minLength: 2, maxLength: 80, trim: true },
      },
      {
        type: "date",
        name: "dateOfBirth",
        label: "Date of birth",
        required: true,
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
        preferredCountries: ["DE", "US", "AE"],
        width: "half",
      },
      {
        type: "email",
        name: "email",
        label: "Email address",
        required: true,
        rules: { trim: true },
        width: "half",
      },
      {
        type: "phone",
        name: "phone",
        label: "Mobile number",
        required: true,
        preferredCountries: ["DE", "US", "AE"],
        width: "half",
      },
      {
        type: "textarea",
        name: "residentialAddress",
        label: "Residential address",
        required: true,
        placeholder: "Street and number, plus any apartment or floor",
        rules: { minLength: 5, maxLength: 200, trim: true },
        description: "Where you actually live. A postbox is not enough for identity checks.",
      },
      {
        type: "text",
        name: "postalCode",
        label: "Postal code",
        required: true,
        rules: { maxLength: 12, trim: true },
        width: "third",
      },
      {
        type: "text",
        name: "city",
        label: "City",
        required: true,
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
