export type Messages = {
  required: string;
  email: string;
  minLength: (n: number) => string;
  maxLength: (n: number) => string;
  min: (limit: number | string) => string;
  max: (limit: number | string) => string;
  pattern: string;
  fileSize: (mb: number) => string;
  /** `extension` is undefined when the file has none to name — see fileTypeRejected in defaultMessages. */
  fileTypeRejected: (name: string, extension: string | undefined, formats: string) => string;
  /** The dropzone's idle prompt; a field's `placeholder` replaces it. */
  dropFiles: string;
  /**
   * The dropzone's idle hint. `formats` arrives already written out by
   * `acceptedFormatsLabel` and is "" when there is no constraint to name;
   * `maxSizeMB` is undefined when the field sets no ceiling. Returning "" for
   * the both-absent case is meaningful — see fileHint in defaultMessages.
   */
  fileHint: (formats: string, maxSizeMB: number | undefined) => string;
  /** Wraps a per-file reason so the row says *that* it failed, not only why. */
  fileRejected: (reason: string) => string;
  filesSelected: (count: number) => string;
  /**
   * Shown when more files are dropped on a single-file field than it can hold.
   * `kept` is the one that was taken, named so the user can see which survived.
   */
  oneFileOnly: (kept: string) => string;
  otpLength: (n: number) => string;
  sendCode: string;
  codeSent: string;
  resend: string;
  otpDidntReceive: string;
  resendIn: string;
  seconds: string;
  otpVerified: string;
  otpSendFailed: string;
  otpVerifyFailed: string;
  otpNotVerified: string;
  invalidDate: string;
  invalidTime: string;
  invalidPhone: string;
  invalidCountry: string;
  maskIncomplete: string;
  clearSignature: string;
  showPassword: string;
  hidePassword: string;
  passwordUppercase: string;
  passwordLowercase: string;
  passwordNumber: string;
  passwordSpecial: string;
  passwordMinLength: (n: number) => string;
  next: string;
  back: string;
  steps: string;
  submit: string;
  country: string;
  searchCountry: string;
  addRow: string;
  removeRow: (row: number) => string;
  removeFile: (name: string) => string;
  noOptions: string;
  ratingValue: (n: number, max: number) => string;
  invalidOption: string;
  edit: string;
  yes: string;
  no: string;
  notAnswered: string;
  signed: string;
  matches: (label: string) => string;
  dateAfter: (label: string) => string;
  dateBefore: (label: string) => string;
  timeAfter: (label: string) => string;
  timeBefore: (label: string) => string;
};

export const defaultMessages: Messages = {
  required: "This field is required",
  email: "Enter a valid email address",
  minLength: (n) => `Must be at least ${n} characters`,
  maxLength: (n) => `Must be at most ${n} characters`,
  min: (n) => `Must be at least ${n}`,
  max: (n) => `Must be at most ${n}`,
  pattern: "Invalid format",
  fileSize: (mb) => `File must be smaller than ${mb} MB`,
  // `formats` arrives already written out ("PDF, JPG or images"), not as the raw
  // accept attribute — don't re-split it.
  //
  // Both trailing parts are conditional because both can legitimately be empty,
  // and an empty one must take its punctuation with it rather than leave a
  // dangling "(" or a sentence ending in "please upload ". `extension` is
  // undefined for a file with no extension; `formats` is "" when accept names
  // no format we can write out, which happens for an accept of only
  // uninterpretable tokens — a typo like "pdf" for ".pdf" rejects every file,
  // so this is the path most likely to be seen, not the least.
  //
  // No indefinite article anywhere on purpose: the extension is uppercased, so
  // "a" vs "an" would be picked from a letter instead of a sound — "a SVG file".
  fileTypeRejected: (name, extension, formats) =>
    `${name} isn't in a format we accept${extension ? ` (${extension})` : ""}` +
    `${formats ? ` — please upload ${formats}` : ""}`,
  dropFiles: "Drag files here, or browse",
  // Both halves are optional and each drops its own separator, for the same
  // reason fileTypeRejected's do. All four combinations are reachable from
  // config alone: a field may set `accept` only, `maxSizeMB` only, both, or
  // neither — and `formats` is additionally "" for an `accept` naming no format
  // we can write out. The empty result is the caller's cue to render no hint at
  // all rather than an empty line, which is why this returns "" instead of a
  // stand-in phrase.
  fileHint: (formats, maxSizeMB) =>
    [formats, maxSizeMB === undefined ? "" : `max ${maxSizeMB} MB`].filter(Boolean).join(", "),
  // The reason alone can be a sentence about the file ("scan.tiff isn't in a
  // format we accept") or about the rule ("File must be smaller than 1 MB").
  // The second only identifies the file it belongs to by sitting in that file's
  // row, so the verdict is stated in words here rather than left to the row's
  // position and its red text.
  fileRejected: (reason) => `Rejected: ${reason}`,
  filesSelected: (count) => `${count} ${count === 1 ? "file" : "files"} selected`,
  // Reachable only by dropping: the `multiple` attribute stops the OS picker
  // returning more than one, but a drop carries whatever the pointer was
  // holding. Says which file was kept rather than how many were not, because
  // the actionable question is "is the right one in there?".
  oneFileOnly: (kept) => `Only one file can go here — kept ${kept}`,
  otpLength: (n) => `Enter the ${n}-digit code`,
  sendCode: "Send OTP",
  codeSent: "Code Sent",
  resend: "Resend",
  otpDidntReceive: "Didn't receive OTP?",
  resendIn: "Resend in",
  seconds: "seconds",
  otpVerified: "Verified",
  otpSendFailed: "Could not send the code. Try again.",
  otpVerifyFailed: "Invalid OTP",
  otpNotVerified: "OTP is not verified",
  invalidDate: "Enter a valid date",
  invalidTime: "Enter a valid time",
  invalidPhone: "Enter a valid phone number",
  invalidCountry: "Select a valid country",
  maskIncomplete: "Incomplete value",
  clearSignature: "Clear",
  showPassword: "Show password",
  hidePassword: "Hide password",
  passwordUppercase: "1 Uppercase",
  passwordLowercase: "1 Lowercase",
  passwordNumber: "1 Number",
  passwordSpecial: "1 Special Char",
  passwordMinLength: (n) => `Min. ${n} char.`,
  next: "Next",
  back: "Back",
  steps: "Steps",
  submit: "Submit",
  country: "Country",
  searchCountry: "Search country...",
  addRow: "Add",
  removeRow: (row) => `Remove row ${row}`,
  removeFile: (name) => `Remove ${name}`,
  noOptions: "No options",
  ratingValue: (n, max) => `${n} of ${max}`,
  invalidOption: "Select a valid option",
  edit: "Edit",
  yes: "Yes",
  no: "No",
  notAnswered: "—",
  signed: "Signed",
  matches: (label) => `Must match ${label}`,
  dateAfter: (label) => `Must be on or after ${label}`,
  dateBefore: (label) => `Must be on or before ${label}`,
  timeAfter: (label) => `Must be at or after ${label}`,
  timeBefore: (label) => `Must be at or before ${label}`,
};

export function mergeMessages(overrides?: Partial<Messages>): Messages {
  return { ...defaultMessages, ...overrides };
}
