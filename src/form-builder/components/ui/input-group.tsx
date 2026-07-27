"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../internal/cn"
import { Button } from "./button"
import { Input } from "./input"
import { Textarea } from "./textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex h-[8.544vw] tablet:h-[4vw] desktop:h-[1.664vw] w-full min-w-0 items-center rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] border border-input transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 tablet:has-[[data-slot=input-group-control]:focus-visible]:ring-3 desktop:has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 tablet:has-[[data-slot][aria-invalid=true]]:ring-3 desktop:has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=block-end]]:[&>input]:pt-[3.204vw] tablet:has-[>[data-align=block-end]]:[&>input]:pt-[1.5vw] desktop:has-[>[data-align=block-end]]:[&>input]:pt-[0.624vw] has-[>[data-align=block-start]]:[&>input]:pb-[3.204vw] tablet:has-[>[data-align=block-start]]:[&>input]:pb-[1.5vw] desktop:has-[>[data-align=block-start]]:[&>input]:pb-[0.624vw] has-[>[data-align=inline-end]]:[&>input]:pe-[1.602vw] tablet:has-[>[data-align=inline-end]]:[&>input]:pe-[0.75vw] desktop:has-[>[data-align=inline-end]]:[&>input]:pe-[0.312vw] has-[>[data-align=inline-start]]:[&>input]:ps-[1.602vw] tablet:has-[>[data-align=inline-start]]:[&>input]:ps-[0.75vw] desktop:has-[>[data-align=inline-start]]:[&>input]:ps-[0.312vw]",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] py-[1.602vw] tablet:py-[0.75vw] desktop:py-[0.312vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[1.335vw] tablet:[&>kbd]:rounded-[0.625vw] desktop:[&>kbd]:rounded-[0.26vw] [&>svg:not([class*='size-'])]:size-[4.272vw] tablet:[&>svg:not([class*='size-'])]:size-[2vw] desktop:[&>svg:not([class*='size-'])]:size-[0.832vw]",
  {
    variants: {
      align: {
        "inline-start":
          "order-first ps-[2.136vw] tablet:ps-[1vw] desktop:ps-[0.416vw] has-[>button]:ms-[-1.282vw] tablet:has-[>button]:ms-[-0.6vw] desktop:has-[>button]:ms-[-0.25vw] has-[>kbd]:ms-[-0.641vw] tablet:has-[>kbd]:ms-[-0.3vw] desktop:has-[>kbd]:ms-[-0.125vw]",
        "inline-end":
          "order-last pe-[2.136vw] tablet:pe-[1vw] desktop:pe-[0.416vw] has-[>button]:me-[-1.282vw] tablet:has-[>button]:me-[-0.6vw] desktop:has-[>button]:me-[-0.25vw] has-[>kbd]:me-[-0.641vw] tablet:has-[>kbd]:me-[-0.3vw] desktop:has-[>kbd]:me-[-0.125vw]",
        "block-start":
          "order-first w-full justify-start px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] pt-[2.136vw] tablet:pt-[1vw] desktop:pt-[0.416vw] group-has-[>input]/input-group:pt-[2.136vw] tablet:group-has-[>input]/input-group:pt-[1vw] desktop:group-has-[>input]/input-group:pt-[0.416vw] [.border-b]:pb-[2.136vw] tablet:[.border-b]:pb-[1vw] desktop:[.border-b]:pb-[0.416vw]",
        "block-end":
          "order-last w-full justify-start px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] pb-[2.136vw] tablet:pb-[1vw] desktop:pb-[0.416vw] group-has-[>input]/input-group:pb-[2.136vw] tablet:group-has-[>input]/input-group:pb-[1vw] desktop:group-has-[>input]/input-group:pb-[0.416vw] [.border-t]:pt-[2.136vw] tablet:[.border-t]:pt-[1vw] desktop:[.border-t]:pt-[0.416vw]",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] shadow-none",
  {
    variants: {
      size: {
        xs: "h-[6.408vw] tablet:h-[3vw] desktop:h-[1.248vw] gap-[1.068vw] tablet:gap-[0.5vw] desktop:gap-[0.208vw] rounded-[1.869vw] tablet:rounded-[0.875vw] desktop:rounded-[0.364vw] px-[1.602vw] tablet:px-[0.75vw] desktop:px-[0.312vw] [&>svg:not([class*='size-'])]:size-[3.738vw] tablet:[&>svg:not([class*='size-'])]:size-[1.75vw] desktop:[&>svg:not([class*='size-'])]:size-[0.728vw]",
        sm: "",
        "icon-xs":
          "size-[6.408vw] tablet:size-[3vw] desktop:size-[1.248vw] rounded-[1.869vw] tablet:rounded-[0.875vw] desktop:rounded-[0.364vw] p-0 has-[>svg]:p-0",
        "icon-sm": "size-[8.544vw] tablet:size-[4vw] desktop:size-[1.664vw] p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw]",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-[2.136vw] tablet:py-[1vw] desktop:py-[0.416vw] shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
