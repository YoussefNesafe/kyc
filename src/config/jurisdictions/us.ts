import type { Option } from "@/form-builder/core/types";
import type { Jurisdiction } from "./types";

/**
 * States and DC, keyed by the country code that reveals them. The engine's
 * `optionsFrom` reads this map at render time from the value of the `country`
 * field, and its schema pass rejects a state value that does not belong to the
 * selected country — so the dependency is declared once, in data, and enforced
 * on both sides without a `useEffect` anywhere.
 */
const STATES_BY_COUNTRY: Record<string, Option[]> = {
  US: [
    { label: "Alabama", value: "AL" },
    { label: "Alaska", value: "AK" },
    { label: "Arizona", value: "AZ" },
    { label: "Arkansas", value: "AR" },
    { label: "California", value: "CA" },
    { label: "Colorado", value: "CO" },
    { label: "Connecticut", value: "CT" },
    { label: "Delaware", value: "DE" },
    { label: "District of Columbia", value: "DC" },
    { label: "Florida", value: "FL" },
    { label: "Georgia", value: "GA" },
    { label: "Hawaii", value: "HI" },
    { label: "Idaho", value: "ID" },
    { label: "Illinois", value: "IL" },
    { label: "Indiana", value: "IN" },
    { label: "Iowa", value: "IA" },
    { label: "Kansas", value: "KS" },
    { label: "Kentucky", value: "KY" },
    { label: "Louisiana", value: "LA" },
    { label: "Maine", value: "ME" },
    { label: "Maryland", value: "MD" },
    { label: "Massachusetts", value: "MA" },
    { label: "Michigan", value: "MI" },
    { label: "Minnesota", value: "MN" },
    { label: "Mississippi", value: "MS" },
    { label: "Missouri", value: "MO" },
    { label: "Montana", value: "MT" },
    { label: "Nebraska", value: "NE" },
    { label: "Nevada", value: "NV" },
    { label: "New Hampshire", value: "NH" },
    { label: "New Jersey", value: "NJ" },
    { label: "New Mexico", value: "NM" },
    { label: "New York", value: "NY" },
    { label: "North Carolina", value: "NC" },
    { label: "North Dakota", value: "ND" },
    { label: "Ohio", value: "OH" },
    { label: "Oklahoma", value: "OK" },
    { label: "Oregon", value: "OR" },
    { label: "Pennsylvania", value: "PA" },
    { label: "Rhode Island", value: "RI" },
    { label: "South Carolina", value: "SC" },
    { label: "South Dakota", value: "SD" },
    { label: "Tennessee", value: "TN" },
    { label: "Texas", value: "TX" },
    { label: "Utah", value: "UT" },
    { label: "Vermont", value: "VT" },
    { label: "Virginia", value: "VA" },
    { label: "Washington", value: "WA" },
    { label: "West Virginia", value: "WV" },
    { label: "Wisconsin", value: "WI" },
    { label: "Wyoming", value: "WY" },
  ],
};

/**
 * The United States. What a visitor should notice: a searchable state list that
 * only exists because the country above it says US, a masked nine-digit
 * taxpayer number, and a backup-withholding declaration that is a checkbox
 * rather than a radio — a different control from the German church-tax question
 * it sits in the same slot as.
 */
export const us: Jurisdiction = {
  code: "US",
  label: "the United States",

  individual: {
    taxFields: [
      {
        type: "select",
        name: "us_state",
        label: "State of residence",
        required: true,
        // The purpose here is `address-level1`, but this is a searchable
        // select — a combobox behind a <button>, with no input for a browser
        // to fill — so the token would not reach the DOM and is left off
        // rather than declared where it cannot act. Same for `ae_emirate`.
        // `dateOfBirth` is the one place this config declares an inert token,
        // because date of birth is the first field a 1.3.5 audit looks for.
        searchable: true,
        optionsFrom: { field: "country", map: STATES_BY_COUNTRY },
        description: "Derived from the country above — the list is empty for anywhere else.",
      },
      {
        type: "masked",
        name: "us_tin",
        label: "Taxpayer identification number",
        mask: "###-##-####",
        required: true,
        description:
          "SSN or ITIN. Nine digits, and nine digits is all this demo looks at — type anything.",
        message: "A taxpayer identification number is nine digits.",
      },
      {
        type: "checkbox",
        name: "us_backupWithholding",
        label: "Backup withholding",
        description:
          "Tick this if you have been notified that you are subject to backup withholding. On a real form W-9 this is the sentence most applicants strike through.",
        options: [
          { label: "I am currently subject to backup withholding", value: "subject" },
          { label: "I have been notified of underreported interest or dividends", value: "notified" },
        ],
      },
    ],
  },

  corporate: {
    taxFields: [
      {
        type: "masked",
        name: "us_ein",
        label: "Employer identification number",
        mask: "##-#######",
        required: true,
        description: "Nine digits, written two-then-seven.",
        message: "An EIN is nine digits.",
      },
      {
        type: "select",
        name: "us_entityClassification",
        label: "Federal tax classification",
        required: true,
        options: [
          { label: "C corporation", value: "c-corp" },
          { label: "S corporation", value: "s-corp" },
          { label: "Partnership", value: "partnership" },
          { label: "Limited liability company", value: "llc" },
          { label: "Trust or estate", value: "trust" },
        ],
      },
    ],
    documentFields: [
      {
        type: "file",
        name: "us_treatyStatement",
        label: "Treaty benefit statement",
        accept: ".pdf",
        maxSizeMB: 10,
        description: "Optional. PDF only. Attach it if the entity is claiming reduced withholding under a tax treaty.",
      },
    ],
  },
};
