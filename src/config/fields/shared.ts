import type { AnyFieldConfig } from "@/form-builder/core/types";

/**
 * The fields every applicant sees, whatever they answer. These are the only
 * fields in the form with no `visibleWhen` at all — `accountType` and `country`
 * because they are the two axes everything else branches on, and the rest
 * because they are genuinely universal.
 */

/** Step 1 — the branch chooser. */
export const accountStepFields: AnyFieldConfig[] = [
  {
    type: "static",
    name: "applicationIntro",
    as: "p",
    // Says what the storage actually does. An earlier draft of this line
    // promised "close the tab and come back", which sessionStorage does not
    // deliver — and the requirement is sessionStorage, for the reason spelled
    // out on APPLICATION_DRAFT_STORAGE. The copy was the thing that had to
    // change. It is framed as a safeguard rather than a limitation, because
    // that is what it is: a half-finished KYC form holding a date of birth and
    // a tax number should not outlive the tab on a shared machine.
    //
    // It also no longer opens by declaring the brokerage fictional and nothing
    // transmitted. `DemoBanner` renders that above every screen including this
    // one, and repeating it here would put the same three sentences twice on a
    // visitor's first screen — which reads as boilerplate and gets skipped,
    // taking the part they DO need to read with it. The banner states what
    // never happens to the answers; this states where they go instead. Change
    // one and check the other.
    content:
      "Your answers stay in this browser tab and nowhere else. Refresh as often as you like — closing the tab discards them, which is the point: a half-finished application holding a date of birth and a tax number has no business outliving the session on a shared machine.",
  },
  {
    type: "radio",
    name: "accountType",
    label: "Who is this account for?",
    required: true,
    options: [
      { label: "Me — an individual account", value: "individual" },
      { label: "A company I represent — a corporate account", value: "corporate" },
    ],
    description: "This choice and your country of residence decide every question that follows.",
  },
  {
    type: "select",
    name: "accountPurpose",
    label: "What will the account mostly be used for?",
    required: true,
    options: [
      { label: "Long-term investing", value: "long-term" },
      { label: "Active trading", value: "active-trading" },
      { label: "Hedging an existing exposure", value: "hedging" },
      { label: "Holding cash and treasury instruments", value: "treasury" },
    ],
  },
];

/**
 * Step 3 — the second axis. It sits on the tax step rather than with the
 * address fields so that the jurisdiction fields it reveals appear beside it:
 * a select whose consequences are two steps away is a select whose consequences
 * are invisible, and the engine's own config validator warns about exactly that
 * arrangement for `optionsFrom` (`us_state` reads its options from this field).
 */
export const residencyField: AnyFieldConfig = {
  type: "country",
  name: "country",
  label: "Country of residence",
  required: true,
  preferredCountries: ["DE", "US", "AE"],
  description:
    "Germany, the United States and the United Arab Emirates have their own configured rules in this demo. Everywhere else gets the standard set — try switching between them.",
};

/** Rendered outside the steps by the engine, so it must not appear in any `fieldNames`. */
export const submitField: AnyFieldConfig = {
  type: "submit",
  name: "submitApplication",
  text: "Submit application",
};
