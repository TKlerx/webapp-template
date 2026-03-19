import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-black/40 dark:border-white/10 dark:bg-[var(--panel)] dark:placeholder:text-white/40",
        className,
      )}
      {...props}
    />
  );
}
