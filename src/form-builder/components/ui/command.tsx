"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"

import { cn } from "../../internal/cn"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import {
  InputGroup,
  InputGroupAddon,
} from "./input-group"
import { SearchIcon, CheckIcon } from "lucide-react"

function Command({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-[3.738vw]! tablet:rounded-[1.75vw]! desktop:rounded-[0.728vw]! bg-popover p-[1.068vw] tablet:p-[0.5vw] desktop:p-[0.208vw] text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-[3.738vw]! tablet:rounded-[1.75vw]! desktop:rounded-[0.728vw]! p-0",
          className
        )}
        showCloseButton={showCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="p-[1.068vw] tablet:p-[0.5vw] desktop:p-[0.208vw] pb-0">
      <InputGroup className="h-[8.544vw]! tablet:h-[4vw]! desktop:h-[1.664vw]! rounded-[2.67vw]! tablet:rounded-[1.25vw]! desktop:rounded-[0.52vw]! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:ps-[2.136vw]! tablet:*:data-[slot=input-group-addon]:ps-[1vw]! desktop:*:data-[slot=input-group-addon]:ps-[0.416vw]!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn(
            "w-full text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
        <InputGroupAddon>
          <SearchIcon className="size-[4.272vw] tablet:size-[2vw] desktop:size-[0.832vw] shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "no-scrollbar max-h-[76.896vw] tablet:max-h-[36vw] desktop:max-h-[14.976vw] scroll-py-[1.068vw] tablet:scroll-py-[0.5vw] desktop:scroll-py-[0.208vw] overflow-x-hidden overflow-y-auto outline-none",
        className
      )}
      {...props}
    />
  )
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-[6.408vw] tablet:py-[3vw] desktop:py-[1.248vw] text-center text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw]", className)}
      {...props}
    />
  )
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-[1.068vw] tablet:p-[0.5vw] desktop:p-[0.208vw] text-foreground **:[[cmdk-group-heading]]:px-[2.136vw] tablet:**:[[cmdk-group-heading]]:px-[1vw] desktop:**:[[cmdk-group-heading]]:px-[0.416vw] **:[[cmdk-group-heading]]:py-[1.602vw] tablet:**:[[cmdk-group-heading]]:py-[0.75vw] desktop:**:[[cmdk-group-heading]]:py-[0.312vw] **:[[cmdk-group-heading]]:text-[3.204vw] tablet:**:[[cmdk-group-heading]]:text-[1.5vw] desktop:**:[[cmdk-group-heading]]:text-[0.624vw] **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-[1.068vw] tablet:-mx-[0.5vw] desktop:-mx-[0.208vw] h-px bg-border", className)}
      {...props}
    />
  )
}

function CommandItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] rounded-[1.602vw] tablet:rounded-[0.75vw] desktop:rounded-[0.312vw] px-[2.136vw] tablet:px-[1vw] desktop:px-[0.416vw] py-[1.602vw] tablet:py-[0.75vw] desktop:py-[0.312vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] outline-hidden select-none in-data-[slot=dialog-content]:rounded-[2.67vw]! tablet:in-data-[slot=dialog-content]:rounded-[1.25vw]! desktop:in-data-[slot=dialog-content]:rounded-[0.52vw]! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[4.272vw] tablet:[&_svg:not([class*='size-'])]:size-[2vw] desktop:[&_svg:not([class*='size-'])]:size-[0.832vw] data-selected:*:[svg]:text-foreground",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ms-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  )
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "ms-auto text-[3.204vw] tablet:text-[1.5vw] desktop:text-[0.624vw] tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
