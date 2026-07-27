import type { Jurisdiction } from "./types";

/**
 * The fallback, used for every country without a bespoke config — and for a
 * country field nobody has touched yet, which is the same situation as far as
 * the form is concerned.
 *
 * It asks the generic question a jurisdiction-specific config replaces: declare
 * where you are taxed and give the number they know you by. The `fallbackNotice`
 * is what stops that reading as a thin form. `buildFormConfig` renders it as a
 * `static` field at the top of the tax step, so the visitor is told which of the
 * four configs resolved instead of being left to infer it from the questions.
 */
export const fallback: Jurisdiction = {
  code: "DEFAULT",
  label: "your country of residence",

  fallbackNotice:
    "No country-specific rules are configured for this selection, so the standard self-declaration below applies. Choosing Germany, the United States or the United Arab Emirates swaps these questions for that country's own — the difference is worth seeing.",

  individual: {
    taxFields: [
      {
        type: "country",
        name: "default_taxResidency",
        label: "Country of tax residence",
        required: true,
        description: "Where you file, if that is somewhere other than where you live.",
      },
      {
        type: "text",
        name: "default_tin",
        label: "Taxpayer identification number",
        required: true,
        placeholder: "However your tax authority writes it",
        rules: { minLength: 4, maxLength: 32, trim: true },
        description:
          "Formats vary too widely to mask, so this one is plain text. A configured jurisdiction gets a mask and a rule instead.",
      },
      {
        type: "checkbox",
        name: "default_selfDeclaration",
        label: "Self-declaration",
        required: true,
        options: [
          {
            label: "I confirm the tax residence and number above are the ones my tax authority holds",
            value: "confirmed",
          },
        ],
      },
    ],
  },

  corporate: {
    taxFields: [
      {
        type: "country",
        name: "default_incorporationCountry",
        label: "Country of incorporation",
        required: true,
      },
      {
        type: "text",
        name: "default_corporateTin",
        label: "Entity taxpayer identification number",
        required: true,
        rules: { minLength: 4, maxLength: 32, trim: true },
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "default_taxCertificate",
        label: "Tax residency certificate",
        accept: ".pdf",
        maxSizeMB: 10,
        description: "Optional. PDF only. Issued by the authority named above.",
      },
    ],
  },
};
