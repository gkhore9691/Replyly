import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-mono transition-colors",
  {
    variants: {
      variant: {
        default: "border border-[var(--border)] bg-white/5 text-[var(--fg)]",
        secondary: "border border-[var(--border)] bg-white/5 text-[var(--muted)]",
        destructive: "border border-[var(--red)]/50 bg-[var(--red)]/10 text-[var(--red)]",
        success: "border border-[var(--green)]/50 bg-[var(--green)]/10 text-[var(--green)]",
        warning: "border border-[var(--yellow)]/50 bg-[var(--yellow)]/10 text-[var(--yellow)]",
        outline: "border border-[var(--border)] text-[var(--fg)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
