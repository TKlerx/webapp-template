import type { InputHTMLAttributes } from "react";
import { Input as ShadcnInput } from "@/components/shadcn/input";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <ShadcnInput
      className={cn(
        "h-auto rounded-2xl border-black/10 bg-white px-4 py-3 shadow-none placeholder:text-black/40 dark:border-white/10 dark:bg-[var(--panel)] dark:placeholder:text-white/40",
        className,
      )}
      {...props}
    />
  );
}
