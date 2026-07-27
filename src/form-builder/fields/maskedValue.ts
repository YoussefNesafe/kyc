const TOKENS = new Set(["#", "A", "*"]);

function matchesToken(token: string, char: string): boolean {
  if (token === "#") return /\d/.test(char);
  if (token === "A") return /[A-Za-z]/.test(char);
  return /[A-Za-z0-9]/.test(char);
}

export function maskTokenCount(mask: string): number {
  let count = 0;
  for (const char of mask) if (TOKENS.has(char)) count += 1;
  return count;
}

export function formatMasked(raw: string, mask: string): string {
  let out = "";
  let index = 0;
  for (const char of mask) {
    if (index >= raw.length) break;
    if (TOKENS.has(char)) {
      out += raw[index];
      index += 1;
    } else {
      out += char;
    }
  }
  return out;
}

export function extractRaw(display: string, mask: string): string {
  let raw = "";
  let maskIndex = 0;
  let displayIndex = 0;
  while (displayIndex < display.length && maskIndex < mask.length) {
    const maskChar = mask[maskIndex];
    const displayChar = display[displayIndex];
    if (TOKENS.has(maskChar)) {
      if (matchesToken(maskChar, displayChar)) {
        raw += displayChar;
        maskIndex += 1;
      }
      displayIndex += 1;
    } else if (displayChar === maskChar) {
      maskIndex += 1;
      displayIndex += 1;
    } else {
      maskIndex += 1;
    }
  }
  return raw;
}
