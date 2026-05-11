import type { ButtonHTMLAttributes } from "react";
import { Button as ShadcnButton } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      className={cn(
        "rounded-full px-4 py-2 text-sm font-semibold shadow-sm",
        variant === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-105"
          : "border border-black/15 bg-[var(--panel)] text-[var(--foreground)] hover:border-black/25 hover:bg-[color:color-mix(in_srgb,var(--panel)_92%,var(--foreground)_8%)] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-[color:color-mix(in_srgb,var(--panel)_88%,white_12%)]",
        className,
      )}
      variant={variant === "primary" ? "default" : "outline"}
      {...props}
    />
  );
}
