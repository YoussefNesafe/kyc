import * as React from "react"

import { cn } from "../../internal/cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[8.544vw] tablet:h-[4vw] desktop:h-[1.664vw] w-full min-w-0 rounded-[2.67vw] tablet:rounded-[1.25vw] desktop:rounded-[0.52vw] border border-input bg-transparent px-[2.67vw] tablet:px-[1.25vw] desktop:px-[0.52vw] py-[1.068vw] tablet:py-[0.5vw] desktop:py-[0.208vw] text-[4.272vw] tablet:text-[1.75vw] desktop:text-[0.728vw] transition-colors outline-none file:inline-flex file:h-[6.408vw] tablet:file:h-[3vw] desktop:file:h-[1.248vw] file:border-0 file:bg-transparent file:text-[3.738vw] tablet:file:text-[1.75vw] desktop:file:text-[0.728vw] file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 tablet:focus-visible:ring-3 desktop:focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 tablet:aria-invalid:ring-3 desktop:aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
