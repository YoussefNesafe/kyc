import { AsYouType, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

export function applyCountryToPhoneValue(value: string, iso: string): string | null {
  let callingCode: string;
  try {
    callingCode = getCountryCallingCode(iso as CountryCode);
  } catch {
    return null;
  }
  const typer = new AsYouType();
  typer.input(value ?? "");
  const national = typer.getNumber()?.nationalNumber ?? "";
  return `+${callingCode}${national}`;
}
