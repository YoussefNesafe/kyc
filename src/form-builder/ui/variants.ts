import { cva } from "class-variance-authority";
import type { ResponsiveFieldWidth } from "../core/types";

export const fieldWrapperVariants = cva(
  "flex flex-col gap-[var(--fb-space-3,1.602vw)] tablet:gap-[var(--fb-space-3-tablet,0.75vw)] desktop:gap-[var(--fb-space-3-desktop,0.312vw)]",
  {
    variants: {
      size: {
        sm: "text-[var(--fb-space-7,3.738vw)] tablet:text-[var(--fb-space-7-tablet,1.75vw)] desktop:text-[var(--fb-space-7-desktop,0.728vw)]",
        md: "",
        lg: "text-[var(--fb-space-9,4.806vw)] tablet:text-[var(--fb-space-9-tablet,2.25vw)] desktop:text-[var(--fb-space-9-desktop,0.936vw)]",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export type FieldWrapperSize = "sm" | "md" | "lg";

export const fieldWidthVariants = cva("", {
  variants: {
    width: {
      full: "col-span-12",
      half: "col-span-6",
      third: "col-span-4",
      quarter: "col-span-3",
    },
    widthTablet: {
      full: "tablet:col-span-12",
      half: "tablet:col-span-6",
      third: "tablet:col-span-4",
      quarter: "tablet:col-span-3",
    },
    widthDesktop: {
      full: "desktop:col-span-12",
      half: "desktop:col-span-6",
      third: "desktop:col-span-4",
      quarter: "desktop:col-span-3",
    },
  },
  defaultVariants: { width: "full", widthTablet: "full", widthDesktop: "full" },
});

export function fieldWidthClass(width?: ResponsiveFieldWidth): string {
  const resolved =
    typeof width === "string" ? { mobile: width, tablet: width, desktop: width } : (width ?? {});
  return fieldWidthVariants({
    width: resolved.mobile,
    widthTablet: resolved.tablet,
    widthDesktop: resolved.desktop,
  });
}
