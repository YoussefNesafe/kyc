import { Fragment, type ReactNode } from "react";

const TOKEN = /<a\b([^>]*)>([\s\S]*?)<\/a>|<br\s*\/?>/gi;

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value === "") return false;
  if (hasControlChar(value)) return false;
  if (value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//"))) return true;
  try {
    const url = new URL(value, "http://base.invalid/");
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function getAttr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attrs);
  return match ? (match[2] ?? match[3]) : undefined;
}

export function renderRichText(content: string): ReactNode {
  const out: ReactNode[] = [];
  const re = new RegExp(TOKEN);
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    if (match.index > last) out.push(content.slice(last, match.index));

    if (match[0].toLowerCase().startsWith("<br")) {
      out.push(<br key={key++} />);
    } else {
      const attrs = match[1] ?? "";
      const text = match[2] ?? "";
      const href = getAttr(attrs, "href");
      if (href && isSafeHref(href)) {
        const newTab = getAttr(attrs, "target") === "_blank";
        out.push(
          <a
            key={key++}
            href={href}
            {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="underline underline-offset-2"
          >
            {text}
          </a>,
        );
      } else {
        out.push(text);
      }
    }
    last = re.lastIndex;
  }
  if (last < content.length) out.push(content.slice(last));

  if (out.length === 0) return content;
  if (out.length === 1) return out[0];
  return <Fragment>{out}</Fragment>;
}
