"use client"

import { useMemo } from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../internal/cn"
import { Label } from "./label"
import { Separator } from "./separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-[4.272vw] tablet:gap-[2vw] desktop:gap-[0.832vw] has-[>[data-slot=checkbox-group]]:gap-[3.204vw] tablet:has-[>[data-slot=checkbox-group]]:gap-[1.5vw] desktop:has-[>[data-slot=checkbox-group]]:gap-[0.624vw] has-[>[data-slot=radio-group]]:gap-[3.204vw] tablet:has-[>[data-slot=radio-group]]:gap-[1.5vw] desktop:has-[>[data-slot=radio-group]]:gap-[0.624vw]",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-[1.602vw] tablet:mb-[0.75vw] desktop:mb-[0.312vw] font-medium data-[variant=label]:text-[3.738vw] tablet:data-[variant=label]:text-[1.75vw] desktop:data-[variant=label]:text-[0.728vw] data-[variant=legend]:text-[4.272vw] tablet:data-[variant=legend]:text-[2vw] desktop:data-[variant=legend]:text-[0.832vw]",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-[5.34vw] tablet:gap-[2.5vw] desktop:gap-[1.04vw] data-[slot=checkbox-group]:gap-[3.204vw] tablet:data-[slot=checkbox-group]:gap-[1.5vw] desktop:data-[slot=checkbox-group]:gap-[0.624vw] *:data-[slot=field-group]:gap-[4.272vw] tablet:*:data-[slot=field-group]:gap-[2vw] desktop:*:data-[slot=field-group]:gap-[0.832vw]",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-[0.534vw] tablet:gap-[0.25vw] desktop:gap-[0.104vw] leading-snug",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-[2.67vw] tablet:has-[>[data-slot=field]]:rounded-[1.25vw] desktop:has-[>[data-slot=field]]:rounded-[0.52vw] has-[>[data-slot=field]]:border *:data-[slot=field]:p-[2.67vw] tablet:*:data-[slot=field]:p-[1.25vw] desktop:*:data-[slot=field]:p-[0.52vw] dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-[2.136vw] tablet:gap-[1vw] desktop:gap-[0.416vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-start text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-[1.602vw] tablet:[[data-variant=legend]+&]:-mt-[0.75vw] desktop:[[data-variant=legend]+&]:-mt-[0.312vw]",
        "last:mt-0 nth-last-2:-mt-[1.068vw] tablet:nth-last-2:-mt-[0.5vw] desktop:nth-last-2:-mt-[0.208vw]",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-[2.136vw] tablet:-my-[1vw] desktop:-my-[0.416vw] h-[5.34vw] tablet:h-[2.5vw] desktop:h-[1.04vw] text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] group-data-[variant=outline]/field-group:-mb-[2.136vw] tablet:group-data-[variant=outline]/field-group:-mb-[1vw] desktop:group-data-[variant=outline]/field-group:-mb-[0.416vw]",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-[2.136vw] tablet:px-[1vw] desktop:px-[0.416vw] text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ms-[4.272vw] tablet:ms-[2vw] desktop:ms-[0.832vw] flex list-disc flex-col gap-[1.068vw] tablet:gap-[0.5vw] desktop:gap-[0.208vw]">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-[3.738vw] tablet:text-[1.75vw] desktop:text-[0.728vw] font-normal text-destructive", className)}
      {...props}
    >
      {content}
    </div>
  )
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
