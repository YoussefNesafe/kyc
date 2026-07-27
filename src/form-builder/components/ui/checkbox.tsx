"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "../../internal/cn"
import { CheckIcon } from "lucide-react"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-[4.272vw] tablet:size-[2vw] desktop:size-[0.832vw] shrink-0 items-center justify-center rounded-[1.068vw] tablet:rounded-[0.5vw] desktop:rounded-[0.208vw] border border-input transition-colors outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-[3.204vw] tablet:after:-inset-x-[1.5vw] desktop:after:-inset-x-[0.624vw] after:-inset-y-[2.136vw] tablet:after:-inset-y-[1vw] desktop:after:-inset-y-[0.416vw] focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-[3.738vw] tablet:[&>svg]:size-[1.75vw] desktop:[&>svg]:size-[0.728vw]"
      >
        <CheckIcon
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
