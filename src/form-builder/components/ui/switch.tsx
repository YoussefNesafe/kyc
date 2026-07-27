"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "../../internal/cn"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-[3.204vw] tablet:after:-inset-x-[1.5vw] desktop:after:-inset-x-[0.624vw] after:-inset-y-[2.136vw] tablet:after:-inset-y-[1vw] desktop:after:-inset-y-[0.416vw] focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[4.913vw] tablet:data-[size=default]:h-[2.3vw] desktop:data-[size=default]:h-[0.957vw] data-[size=default]:w-[8.544vw] tablet:data-[size=default]:w-[4vw] desktop:data-[size=default]:w-[1.664vw] data-[size=sm]:h-[3.738vw] tablet:data-[size=sm]:h-[1.75vw] desktop:data-[size=sm]:h-[0.728vw] data-[size=sm]:w-[6.408vw] tablet:data-[size=sm]:w-[3vw] desktop:data-[size=sm]:w-[1.248vw] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-[4.272vw] tablet:group-data-[size=default]/switch:size-[2vw] desktop:group-data-[size=default]/switch:size-[0.832vw] group-data-[size=sm]/switch:size-[3.204vw] tablet:group-data-[size=sm]/switch:size-[1.5vw] desktop:group-data-[size=sm]/switch:size-[0.624vw] group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] rtl:group-data-[size=default]/switch:data-checked:-translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] rtl:group-data-[size=sm]/switch:data-checked:-translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 rtl:group-data-[size=default]/switch:data-unchecked:-translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 rtl:group-data-[size=sm]/switch:data-unchecked:-translate-x-0 dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
