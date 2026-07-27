"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"

import { cn } from "../../internal/cn"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-[1.068vw] tablet:scroll-my-[0.5vw] desktop:scroll-my-[0.208vw] p-[1.068vw] tablet:p-[0.5vw] desktop:p-[0.208vw]", className)}
      {...props}
    />
  )
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-[1.602vw] tablet:gap-[0.75vw] desktop:gap-[0.312vw] rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] border border-input bg-transparent py-[2.136vw] tablet:py-[1vw] desktop:py-[0.416vw] pe-[2.136vw] tablet:pe-[1vw] desktop:pe-[0.416vw] ps-[2.67vw] tablet:ps-[1.25vw] desktop:ps-[0.52vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-[8.544vw] tablet:data-[size=default]:h-[4vw] desktop:data-[size=default]:h-[1.664vw] data-[size=sm]:h-[7.476vw] tablet:data-[size=sm]:h-[3.5vw] desktop:data-[size=sm]:h-[1.456vw] data-[size=sm]:rounded-[2.136vw] tablet:data-[size=sm]:rounded-[1vw] desktop:data-[size=sm]:rounded-[0.416vw] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-[1.602vw] tablet:*:data-[slot=select-value]:gap-[0.75vw] desktop:*:data-[slot=select-value]:gap-[0.312vw] dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw]",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="pointer-events-none size-[4.272vw] tablet:size-[2vw] desktop:size-[0.832vw] text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        data-align-trigger={position === "item-aligned"}
        className={cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-[38.448vw] tablet:min-w-[18vw] desktop:min-w-[7.488vw] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] bg-popover text-popover-foreground shadow-md ring-1 tablet:ring-1 desktop:ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", position ==="popper"&&"data-[side=bottom]:translate-y-[1.068vw] tablet:data-[side=bottom]:translate-y-[0.5vw] desktop:data-[side=bottom]:translate-y-[0.208vw] data-[side=left]:-translate-x-[1.068vw] tablet:data-[side=left]:-translate-x-[0.5vw] desktop:data-[side=left]:-translate-x-[0.208vw] rtl:data-[side=left]:translate-x-[1.068vw] tablet:rtl:data-[side=left]:translate-x-[0.5vw] desktop:rtl:data-[side=left]:translate-x-[0.208vw] data-[side=right]:translate-x-[1.068vw] tablet:data-[side=right]:translate-x-[0.5vw] desktop:data-[side=right]:translate-x-[0.208vw] rtl:data-[side=right]:-translate-x-[1.068vw] tablet:rtl:data-[side=right]:-translate-x-[0.5vw] desktop:rtl:data-[side=right]:-translate-x-[0.208vw] data-[side=top]:-translate-y-[1.068vw] tablet:data-[side=top]:-translate-y-[0.5vw] desktop:data-[side=top]:-translate-y-[0.208vw]", className )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-position={position}
          className={cn(
            "data-[position=popper]:h-(--radix-select-trigger-height) data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)",
            position === "popper" && ""
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-[1.602vw] tablet:px-[0.75vw] desktop:px-[0.312vw] py-[1.068vw] tablet:py-[0.5vw] desktop:py-[0.208vw] text-[3.204vw] tablet:text-[1.5vw] desktop:text-[0.624vw] text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-[1.602vw] tablet:gap-[0.75vw] desktop:gap-[0.312vw] rounded-[2.136vw] tablet:rounded-[1vw] desktop:rounded-[0.416vw] py-[1.068vw] tablet:py-[0.5vw] desktop:py-[0.208vw] pe-[8.544vw] tablet:pe-[4vw] desktop:pe-[1.664vw] ps-[1.602vw] tablet:ps-[0.75vw] desktop:ps-[0.312vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw] *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-[2.136vw] tablet:*:[span]:last:gap-[1vw] desktop:*:[span]:last:gap-[0.416vw]",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute end-[2.136vw] tablet:end-[1vw] desktop:end-[0.416vw] flex size-[4.272vw] tablet:size-[2vw] desktop:size-[0.832vw] items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-[1.068vw] tablet:-mx-[0.5vw] desktop:-mx-[0.208vw] my-[1.068vw] tablet:my-[0.5vw] desktop:my-[0.208vw] h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-[1.068vw] tablet:py-[0.5vw] desktop:py-[0.208vw] [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw]",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "z-10 flex cursor-default items-center justify-center bg-popover py-[1.068vw] tablet:py-[0.5vw] desktop:py-[0.208vw] [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw]",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
