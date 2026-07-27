import type { ReactNode } from "react";

type FormSectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-[var(--fb-space-8,4.272vw)] tablet:space-y-[var(--fb-space-8-tablet,2vw)] desktop:space-y-[var(--fb-space-8-desktop,0.832vw)]">
      {title && (
        <h2 className="text-[var(--fb-space-10,5.34vw)] tablet:text-[var(--fb-space-10-tablet,2.5vw)] desktop:text-[var(--fb-space-10-desktop,1.04vw)] font-semibold">{title}</h2>
      )}
      {description && <p className="text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
