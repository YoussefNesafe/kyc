import type { Jurisdiction } from "./types";

/**
 * The United Arab Emirates. What a visitor should notice is an absence: there
 * is no taxpayer identification number anywhere on this branch, because the
 * UAE levies no personal income tax. A form that asked for one anyway would be
 * the tell that its "jurisdiction support" is three labels over one field.
 *
 * A `static` field says so out loud, otherwise the absence reads as an
 * oversight. It carries no `label`, which is also why `buildFormConfig` leaves
 * it unbadged — the engine's badge sits beside a label and there is none.
 */
export const ae: Jurisdiction = {
  code: "AE",
  label: "the United Arab Emirates",

  individual: {
    taxFields: [
      {
        type: "static",
        name: "ae_noNumberNote",
        as: "p",
        content:
          "The UAE levies no personal income tax, so this application asks you for no taxpayer number. Your Emirates ID and residency status are what identify you.",
      },
      {
        type: "masked",
        name: "ae_emiratesId",
        label: "Emirates ID number",
        mask: "784-####-#######-#",
        required: true,
        description:
          "Printed on the front of the card. The 784 prefix is fixed; the twelve digits after it are yours. Type any twelve — nothing is verified.",
        message: "An Emirates ID number is twelve digits after the 784 prefix.",
      },
      {
        type: "radio",
        name: "ae_visaStatus",
        label: "Residency status",
        required: true,
        options: [
          { label: "Standard residence visa", value: "residence" },
          { label: "Long-term (Golden) residence visa", value: "golden" },
          { label: "GCC national — no visa required", value: "gcc" },
        ],
      },
      {
        type: "select",
        name: "ae_emirate",
        label: "Emirate of residence",
        required: true,
        options: [
          { label: "Abu Dhabi", value: "AZ" },
          { label: "Ajman", value: "AJ" },
          { label: "Dubai", value: "DU" },
          { label: "Fujairah", value: "FU" },
          { label: "Ras Al Khaimah", value: "RK" },
          { label: "Sharjah", value: "SH" },
          { label: "Umm Al Quwain", value: "UQ" },
        ],
      },
    ],
  },

  corporate: {
    taxFields: [
      {
        type: "masked",
        name: "ae_tradeLicenceNumber",
        label: "Trade licence number",
        mask: "**-*******",
        required: true,
        description: "As printed on the licence issued by the relevant economic department or free-zone authority.",
        message: "A trade licence number is nine letters or digits.",
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "ae_tradeLicence",
        label: "Trade licence",
        required: true,
        accept: ".pdf,.jpg,.jpeg,.png",
        maxSizeMB: 10,
        description: "The current licence, plus the free-zone establishment card if the entity holds one.",
      },
    ],
  },
};
