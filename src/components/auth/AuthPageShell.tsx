"use client";

import type { PropsWithChildren, ReactNode } from "react";

type AuthPageShellProps = PropsWithChildren<{
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
}>;

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.08)] sm:p-8 dark:border-white/10">
        <p className="text-sm uppercase tracking-[0.2em] opacity-50">{eyebrow}</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm opacity-65">{description}</p>
        {children}
      </div>
    </main>
  );
}
