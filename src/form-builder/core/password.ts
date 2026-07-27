import type { Messages } from "./messages";
import type { PasswordComplexity } from "./types";

export type PasswordCheck = {
  key: string;
  label: string;
  test: (value: string) => boolean;
};

export function getPasswordChecks(complexity: PasswordComplexity, messages: Messages): PasswordCheck[] {
  const checks: PasswordCheck[] = [];
  if (complexity.uppercase) {
    checks.push({ key: "uppercase", label: messages.passwordUppercase, test: (value) => /[A-Z]/.test(value) });
  }
  if (complexity.lowercase) {
    checks.push({ key: "lowercase", label: messages.passwordLowercase, test: (value) => /[a-z]/.test(value) });
  }
  if (complexity.number) {
    checks.push({ key: "number", label: messages.passwordNumber, test: (value) => /[0-9]/.test(value) });
  }
  if (complexity.special) {
    checks.push({ key: "special", label: messages.passwordSpecial, test: (value) => /[^A-Za-z0-9]/.test(value) });
  }
  if (complexity.minLength !== undefined) {
    const min = complexity.minLength;
    checks.push({ key: "minLength", label: messages.passwordMinLength(min), test: (value) => value.length >= min });
  }
  return checks;
}
