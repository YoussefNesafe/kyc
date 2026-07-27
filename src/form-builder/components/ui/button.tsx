import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "../../internal/cn";

const buttonVariants = cva(
  "group/button cursor-pointer inline-flex shrink-0 items-center justify-center rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] border border-transparent bg-clip-padding text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        brand:
          "bg-accent-brand-solid text-accent-brand-foreground hover:bg-accent-brand-solid-hover focus-visible:border-accent-brand-foreground focus-visible:ring-accent-brand-foreground/50",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[8.544vw] tablet:h-[4vw] desktop:h-[1.664vw] gap-[1.602vw] tablet:gap-[0.75vw] desktop:gap-[0.312vw] px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] has-data-[icon=inline-end]:pe-[2.136vw] tablet:has-data-[icon=inline-end]:pe-[1vw] desktop:has-data-[icon=inline-end]:pe-[0.416vw] has-data-[icon=inline-start]:ps-[2.136vw] tablet:has-data-[icon=inline-start]:ps-[1vw] desktop:has-data-[icon=inline-start]:ps-[0.416vw]",
        xs: "h-[6.408vw] tablet:h-[3vw] desktop:h-[1.248vw] gap-[1.068vw] tablet:gap-[0.5vw] desktop:gap-[0.208vw] rounded-[2.136vw] tablet:rounded-[1vw] desktop:rounded-[0.416vw] px-[2.136vw] tablet:px-[1vw] desktop:px-[0.416vw] text-[3.204vw] tablet:text-[1.5vw] desktop:text-[0.624vw] in-data-[slot=button-group]:rounded-[2.67vw] tablet:in-data-[slot=button-group]:rounded-[1.25vw] desktop:in-data-[slot=button-group]:rounded-[0.52vw] has-data-[icon=inline-end]:pe-[1.602vw] tablet:has-data-[icon=inline-end]:pe-[0.75vw] desktop:has-data-[icon=inline-end]:pe-[0.312vw] has-data-[icon=inline-start]:ps-[1.602vw] tablet:has-data-[icon=inline-start]:ps-[0.75vw] desktop:has-data-[icon=inline-start]:ps-[0.312vw] [&_svg:not([class*='size-'])]:size-[3.204vw] tablet:[&_svg:not([class*='size-'])]:size-[1.5vw] desktop:[&_svg:not([class*='size-'])]:size-[0.624vw]",
        sm: "h-[7.476vw] tablet:h-[3.5vw] desktop:h-[1.456vw] gap-[1.068vw] tablet:gap-[0.5vw] desktop:gap-[0.208vw] rounded-[2.136vw] tablet:rounded-[1vw] desktop:rounded-[0.416vw] px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] text-[3.418vw] tablet:text-[1.6vw] desktop:text-[0.666vw] in-data-[slot=button-group]:rounded-[2.67vw] tablet:in-data-[slot=button-group]:rounded-[1.25vw] desktop:in-data-[slot=button-group]:rounded-[0.52vw] has-data-[icon=inline-end]:pe-[1.602vw] tablet:has-data-[icon=inline-end]:pe-[0.75vw] desktop:has-data-[icon=inline-end]:pe-[0.312vw] has-data-[icon=inline-start]:ps-[1.602vw] tablet:has-data-[icon=inline-start]:ps-[0.75vw] desktop:has-data-[icon=inline-start]:ps-[0.312vw] [&_svg:not([class*='size-'])]:size-[3.738vw] tablet:[&_svg:not([class*='size-'])]:size-[1.75vw] desktop:[&_svg:not([class*='size-'])]:size-[0.728vw]",
        lg: "h-[9.612vw] tablet:h-[4.5vw] desktop:h-[1.872vw] gap-[1.602vw] tablet:gap-[0.75vw] desktop:gap-[0.312vw] px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] has-data-[icon=inline-end]:pe-[2.136vw] tablet:has-data-[icon=inline-end]:pe-[1vw] desktop:has-data-[icon=inline-end]:pe-[0.416vw] has-data-[icon=inline-start]:ps-[2.136vw] tablet:has-data-[icon=inline-start]:ps-[1vw] desktop:has-data-[icon=inline-start]:ps-[0.416vw]",
        icon: "size-[8.544vw] tablet:size-[4vw] desktop:size-[1.664vw]",
        "icon-xs":
          "size-[6.408vw] tablet:size-[3vw] desktop:size-[1.248vw] rounded-[2.136vw] tablet:rounded-[1vw] desktop:rounded-[0.416vw] in-data-[slot=button-group]:rounded-[2.67vw] tablet:in-data-[slot=button-group]:rounded-[1.25vw] desktop:in-data-[slot=button-group]:rounded-[0.52vw] [&_svg:not([class*='size-'])]:size-[3.204vw] tablet:[&_svg:not([class*='size-'])]:size-[1.5vw] desktop:[&_svg:not([class*='size-'])]:size-[0.624vw]",
        "icon-sm":
          "size-[7.476vw] tablet:size-[3.5vw] desktop:size-[1.456vw] rounded-[2.136vw] tablet:rounded-[1vw] desktop:rounded-[0.416vw] in-data-[slot=button-group]:rounded-[2.67vw] tablet:in-data-[slot=button-group]:rounded-[1.25vw] desktop:in-data-[slot=button-group]:rounded-[0.52vw]",
        "icon-lg": "size-[9.612vw] tablet:size-[4.5vw] desktop:size-[1.872vw]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
