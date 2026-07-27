"use client";

import type { ReactNode } from "react";
import { Separator } from "../components/ui/separator";
import type { FieldComponentProps } from "../core/registry";
import type { FieldConfig } from "../core/types";
import { renderRichText } from "./richText";

type StaticFieldConfig = Extract<FieldConfig, { type: "static" }>;
type StaticAs = NonNullable<StaticFieldConfig["as"]>;

const STATIC_TAG_RENDERERS: Partial<Record<StaticAs, (content: ReactNode) => ReactNode>> = {
  h1: (content) => (
    <h1 className="text-[var(--fb-space-15,8.01vw)] tablet:text-[var(--fb-space-15-tablet,3.75vw)] desktop:text-[var(--fb-space-15-desktop,1.56vw)] font-semibold">
      {content}
    </h1>
  ),
  h2: (content) => (
    <h2 className="text-[var(--fb-space-10,5.34vw)] tablet:text-[var(--fb-space-10-tablet,2.5vw)] desktop:text-[var(--fb-space-10-desktop,1.04vw)] font-semibold">
      {content}
    </h2>
  ),
  divider: () => <Separator />,
};

export function StaticField({ field }: FieldComponentProps) {
  const config = field as StaticFieldConfig;
  const content = renderRichText(config.content);
  const render = config.as ? STATIC_TAG_RENDERERS[config.as] : undefined;

  if (render) return render(content);
  return <p className="text-muted-foreground">{content}</p>;
}
