import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-sm hover:brightness-105"
          : "border border-black/15 bg-[var(--panel)] text-[var(--foreground)] shadow-sm hover:border-black/25 hover:bg-[color:color-mix(in_srgb,var(--panel)_92%,var(--foreground)_8%)] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-[color:color-mix(in_srgb,var(--panel)_88%,white_12%)]",
        className,
      )}
      {...props}
    />
  );
}
