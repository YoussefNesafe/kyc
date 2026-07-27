import type { Jurisdiction } from "./types";

/**
 * Germany. What a visitor should notice: the tax number is a *masked* eleven
 * digit field rather than free text, and there is a church-tax question that
 * exists nowhere else in the form.
 *
 * The mask uses the engine's token characters (`#` digit, `A` letter,
 * `*` alphanumeric). Writing the mask with zeros — `00 000 000 000` — reads
 * naturally but is rejected by the config validator, which requires at least
 * one real token char.
 */
export const de: Jurisdiction = {
  code: "DE",
  label: "Germany",

  individual: {
    taxFields: [
      {
        type: "masked",
        name: "de_steuerId",
        label: "Steuer-Identifikationsnummer",
        mask: "## ### ### ###",
        required: true,
        description:
          "Eleven digits, issued once and for life by the Bundeszentralamt für Steuern. Any eleven digits are accepted here — this demo checks the shape, never the number.",
        message: "A Steuer-Identifikationsnummer is eleven digits.",
      },
      {
        type: "radio",
        name: "de_churchTax",
        label: "Church tax (Kirchensteuer)",
        required: true,
        description:
          "German brokers withhold church tax alongside the flat capital-gains tax, so the answer changes what is deducted at source.",
        options: [
          { label: "Yes — I belong to a religious community that levies it", value: "member" },
          { label: "No — I do not", value: "none" },
          { label: "Prefer not to say — treat me as liable", value: "undisclosed" },
        ],
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "de_meldebescheinigung",
        label: "Meldebescheinigung",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png",
        maxSizeMB: 5,
        description:
          "The registration certificate from your Einwohnermeldeamt, dated within the last three months. Nothing you attach leaves this browser tab.",
      },
    ],
  },

  corporate: {
    taxFields: [
      {
        type: "masked",
        name: "de_ustIdNr",
        label: "Umsatzsteuer-Identifikationsnummer",
        mask: "AA#########",
        required: true,
        description: "Two letters and nine digits — the VAT identification number of the registered entity.",
        message: "A USt-IdNr is two letters followed by nine digits.",
      },
      {
        type: "radio",
        name: "de_handelsregisterCourt",
        label: "Registering Amtsgericht",
        required: true,
        description: "The local court holding the Handelsregister entry. Shortened to four options for the demo.",
        options: [
          { label: "Amtsgericht Charlottenburg (Berlin)", value: "charlottenburg" },
          { label: "Amtsgericht München", value: "muenchen" },
          { label: "Amtsgericht Frankfurt am Main", value: "frankfurt" },
          { label: "Somewhere else", value: "other" },
        ],
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "de_handelsregisterauszug",
        label: "Handelsregisterauszug",
        required: true,
        accept: ".pdf",
        maxSizeMB: 10,
        description: "PDF only — the commercial-register extract, dated within the last six months.",
      },
    ],
  },
};
