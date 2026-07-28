import type { BranchFields } from "./individual";

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The corporate branch. Declares no `visibleWhen` — `buildFormConfig` stamps
 * the `accountType` guard.
 *
 * The beneficial-owners `group` is the field a visitor should notice most: it
 * is a repeating row, declared as data like everything else, and it is why the
 * corporate branch is a different form rather than the individual form with the
 * word "company" swapped in.
 */
export function corporateFields(now: Date): BranchFields {
  return {
    personalFields: [
      {
        type: "text",
        name: "companyName",
        label: "Registered company name",
        required: true,
        // The only autofill token this branch's entity fields can honestly
        // carry. `organization` is defined as the company corresponding to the
        // person in the other fields — which is exactly the relationship
        // between this and the authorised contact below.
        autocomplete: "organization",
        rules: { minLength: 2, maxLength: 120, trim: true },
      },
      {
        type: "text",
        name: "companyNumber",
        label: "Company registration number",
        required: true,
        rules: { minLength: 3, maxLength: 40, trim: true },
        width: "half",
      },
      {
        type: "date",
        name: "incorporationDate",
        label: "Date of incorporation",
        required: true,
        maxDate: todayIso(now),
        message: "A company cannot have been incorporated in the future.",
        width: "half",
      },
      {
        type: "textarea",
        name: "registeredAddress",
        label: "Registered office address",
        required: true,
        // Deliberately no `street-address`. WCAG 1.3.5 covers fields about the
        // person filling the form, and this is the entity's address, not
        // theirs. The autofill address tokens are one group describing one
        // subject, so claiming this one would invite a browser to drop the
        // applicant's home address into a company's registered office —
        // a conformance gesture that makes the form worse. Same reasoning
        // leaves companyNumber and incorporationDate untagged: neither has a
        // purpose token, and neither is about the applicant.
        rules: { minLength: 5, maxLength: 200, trim: true },
      },
      {
        type: "text",
        name: "contactName",
        label: "Authorised contact",
        required: true,
        // This trio is the one part of the corporate branch that asks about
        // the person filling the form, so it is the part 1.3.5 actually
        // reaches — and it gets the same tokens the individual branch uses.
        autocomplete: "name",
        rules: { minLength: 2, maxLength: 80, trim: true },
        description: "The person we would speak to. They must be authorised to act for the entity.",
      },
      {
        type: "email",
        name: "contactEmail",
        label: "Contact email",
        required: true,
        autocomplete: "work email",
        rules: { trim: true },
        width: "half",
      },
      {
        type: "phone",
        name: "contactPhone",
        label: "Contact number",
        required: true,
        autocomplete: "work tel",
        preferredCountries: ["DE", "US", "AE"],
        width: "half",
      },
      {
        type: "group",
        name: "beneficialOwners",
        label: "Beneficial owners",
        min: 1,
        max: 4,
        description:
          "Everyone holding 25% or more, directly or indirectly. Add a row per person — the rows are config, not a bespoke component.",
        fields: [
          {
            type: "text",
            name: "ownerName",
            label: "Full legal name",
            required: true,
            // No `name` token here, unlike the individual branch's field of
            // the same label. A beneficial owner is a third party, so 1.3.5
            // does not reach it — and a browser filling every row of a
            // repeating group with the applicant's own name is a worse
            // outcome than no autofill. (The engine's `autocomplete` takes the
            // spec's `section-*` prefix, which is how a repeating group WOULD
            // express one-per-row purposes if these were the user's own.)
            rules: { minLength: 2, maxLength: 80, trim: true },
            width: "half",
          },
          {
            type: "number",
            name: "ownerStake",
            label: "Holding (%)",
            required: true,
            min: 25,
            max: 100,
            step: 1,
            width: "quarter",
          },
          {
            type: "country",
            name: "ownerNationality",
            label: "Nationality",
            required: true,
            width: "quarter",
          },
        ],
      },
    ],

    documentFields: [
      {
        type: "file",
        name: "certificateOfIncorporation",
        label: "Certificate of incorporation",
        required: true,
        accept: ".pdf",
        maxSizeMB: 10,
        description: "PDF only, up to 10 MB. Anything else is refused with the format it expected.",
      },
      {
        type: "file",
        name: "ownershipStructure",
        label: "Ownership structure chart",
        accept: ".pdf,.png,.jpg,.jpeg",
        maxSizeMB: 10,
        description: "Optional, but it saves a round of questions when the chain of ownership has more than one link.",
      },
    ],
  };
}
