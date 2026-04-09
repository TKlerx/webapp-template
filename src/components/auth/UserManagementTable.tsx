"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AuthMethod, Role, UserStatus } from "../../../generated/prisma/enums";
import { Role as RoleEnum, UserStatus as UserStatusEnum } from "../../../generated/prisma/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { withBasePath } from "@/lib/base-path";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  authMethod: AuthMethod;
};

export function UserManagementTable({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: UserRow[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const t = useTranslations("users");

  async function runAction(
    key: string,
    url: string,
    options: RequestInit,
    successMessage: string,
  ) {
    setBusyKey(key);

    try {
      const response = await fetch(withBasePath(url), options);
      const payload = response.status === 204 ? null : await response.json().catch(() => null);

      if (!response.ok) {
        pushToast(payload?.error ?? t("couldNotUpdate"));
        return;
      }

      pushToast(successMessage);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 opacity-50 dark:border-white/10">
            <th className="pb-3">{t("name")}</th>
            <th className="pb-3">{t("email")}</th>
            <th className="pb-3">{t("role")}</th>
            <th className="pb-3">{t("statusLabel")}</th>
            <th className="pb-3">{t("auth")}</th>
            <th className="pb-3">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((entry) => {
            const canEditSelfRole = entry.id !== currentUserId;
            const isBusy = busyKey?.startsWith(entry.id);

            return (
              <tr className="border-b border-black/5 align-top dark:border-white/5" key={entry.id}>
                <td className="py-3">
                  <div className="font-medium">{entry.name}</div>
                </td>
                <td className="py-3 opacity-70">{entry.email}</td>
                <td className="py-3">
                  <Select
                    disabled={!canEditSelfRole || Boolean(isBusy)}
                    value={entry.role}
                    onValueChange={(value) =>
                      void runAction(
                        `${entry.id}-role`,
                        `/api/users/${entry.id}/role`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: value }),
                        },
                        t("roleUpdated", { role: t(`roles.${value as Role}`) }),
                      )
                    }
                  >
                    <SelectTrigger
                      aria-label={t("role")}
                      className="w-[13rem] rounded-2xl border-black/10 bg-white px-3 py-2 shadow-none dark:border-white/10 dark:bg-[var(--panel)]"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-black/10 dark:border-white/10">
                      {Object.values(RoleEnum).map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`roles.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3">
                  <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold dark:bg-white/10">
                    {t(`statuses.${entry.status}`)}
                  </span>
                </td>
                <td className="py-3 opacity-70">{entry.authMethod}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {entry.status === UserStatusEnum.PENDING_APPROVAL ? (
                      <Button
                        disabled={Boolean(isBusy)}
                        onClick={() =>
                          void runAction(
                            `${entry.id}-approve`,
                            `/api/users/${entry.id}/approve`,
                            { method: "PATCH" },
                            t("userApproved"),
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        {t("approve")}
                      </Button>
                    ) : null}

                    {entry.status === UserStatusEnum.ACTIVE ? (
                      <Button
                        disabled={Boolean(isBusy)}
                        onClick={() =>
                          void runAction(
                            `${entry.id}-deactivate`,
                            `/api/users/${entry.id}/deactivate`,
                            { method: "PATCH" },
                            t("userDeactivated"),
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        {t("deactivate")}
                      </Button>
                    ) : null}

                    {entry.status === UserStatusEnum.INACTIVE ? (
                      <Button
                        disabled={Boolean(isBusy)}
                        onClick={() =>
                          void runAction(
                            `${entry.id}-reactivate`,
                            `/api/users/${entry.id}/reactivate`,
                            { method: "PATCH" },
                            t("userReactivated"),
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        {t("reactivate")}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
