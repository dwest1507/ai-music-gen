import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-widest transition-all duration-150 focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/5 text-primary",
        secondary:
          "border-white/[0.06] text-muted-foreground/60",
        destructive:
          "border-destructive/30 bg-destructive/5 text-destructive",
        outline:
          "border-white/[0.10] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
