import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        variant === "primary"
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border border-black/10 bg-white/60 text-black/80 dark:border-white/10 dark:bg-white/10 dark:text-white/80",
        className,
      )}
      {...props}
    />
  );
}
