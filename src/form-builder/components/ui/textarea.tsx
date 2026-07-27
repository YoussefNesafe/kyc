import * as React from "react"

import { cn } from "../../internal/cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[17.088vw] tablet:min-h-[8vw] desktop:min-h-[3.328vw] w-full rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] border border-input bg-transparent px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] py-[2.136vw] tablet:py-[1vw] desktop:py-[0.416vw] text-[4.272vw] tablet:text-[1.75vw] desktop:text-[0.728vw] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
