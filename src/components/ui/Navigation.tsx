"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Role } from "../../../generated/prisma/enums";
import type { SessionUser } from "@/lib/auth";

export function Navigation({ user }: { user: SessionUser }) {
  const t = useTranslations("nav");

  const links = [{ href: "/dashboard", label: t("dashboard") }];
  links.push({ href: "/settings/tokens", label: t("tokens") });
  links.push({ href: "/docs/api", label: t("apiDocs") });

  if (user.role === Role.PLATFORM_ADMIN) {
    links.push({ href: "/background-jobs", label: t("backgroundJobs") });
    links.push({ href: "/users", label: t("users") });
    links.push({ href: "/audit-trail", label: t("auditTrail") });
    links.push({ href: "/admin/notifications", label: t("notifications") });
    links.push({ href: "/admin/tokens", label: t("adminTokens") });
  }

  return (
    <nav className="flex flex-wrap gap-2 text-sm sm:gap-3">
      {links.map((link) => (
        <Link
          key={link.href}
          className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 sm:px-4 sm:py-2 dark:border-white/10 dark:bg-white/10"
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
