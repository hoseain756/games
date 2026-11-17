"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-all outline-none",
        "data-[state=unchecked]:bg-input data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-input/80",
        "shadow-[inset_0_2px_3px_rgba(0,0,0,0.18)]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Invisible expanded hit area for touch (keeps visuals compact)
        "before:absolute before:-inset-2 before:content-['']",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-5 rounded-full shadow-md ring-0 transition-transform",
          // LTR: thumb rests at the left edge, travels right when checked
          "data-[state=checked]:translate-x-5",
          // RTL: thumb rests at the right edge (inline-start), must travel LEFT.
          // The stock shadcn translate pushed it out of the track in RTL.
          "rtl:data-[state=checked]:-translate-x-5"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
