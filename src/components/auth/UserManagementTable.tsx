"use client";

import { Button, Table } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  AuthMethod,
  Role,
  UserStatus,
} from "../../../generated/prisma/enums";
import { UserStatus as UserStatusEnum } from "../../../generated/prisma/enums";
import { withBasePath } from "@/lib/base-path";
import { apiErrorSchema } from "@/lib/api-response";
import { UserRoleSelect } from "@/components/auth/UserRoleSelect";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
      const payload = apiErrorSchema.safeParse(
        response.status === 204
          ? null
          : await response.json().catch(() => null),
      );

      if (!response.ok) {
        pushToast(
          mapUserError(payload.success ? payload.data.error : undefined, t),
        );
        return;
      }

      pushToast(successMessage);
      router.refresh();
    } catch {
      pushToast(t("couldNotUpdate"));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Table.ScrollContainer
      ref={scrollContainerRef}
      minWidth="52rem"
      type="native"
    >
      <Table
        aria-label={t("title")}
        className="text-left text-sm"
        borderColor="var(--border)"
        verticalSpacing="md"
        highlightOnHover
        highlightOnHoverColor="color-mix(in srgb, var(--panel) 86%, var(--background))"
      >
        <Table.Thead>
          <Table.Tr className="border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,var(--background)_12%)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
            <Table.Th className="px-4 py-3 sm:px-6">{t("name")}</Table.Th>
            <Table.Th className="px-4 py-3">{t("email")}</Table.Th>
            <Table.Th className="px-4 py-3">{t("role")}</Table.Th>
            <Table.Th className="px-4 py-3">{t("statusLabel")}</Table.Th>
            <Table.Th className="px-4 py-3">{t("auth")}</Table.Th>
            <Table.Th className="px-4 py-3 sm:px-6">{t("actions")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((entry) => {
            const canEditRole = entry.id !== currentUserId;
            const isBusy = busyKey?.startsWith(entry.id);

            return (
              <Table.Tr className="align-top transition-colors" key={entry.id}>
                <Table.Td className="px-4 py-4 sm:px-6">
                  <div className="font-medium">{entry.name}</div>
                </Table.Td>
                <Table.Td className="px-4 py-4 text-[var(--muted-foreground)]">
                  {entry.email}
                </Table.Td>
                <Table.Td className="px-4 py-4">
                  <UserRoleSelect
                    className="w-52"
                    disabled={!canEditRole}
                    readOnly={Boolean(isBusy)}
                    scrollContainerRef={scrollContainerRef}
                    value={entry.role}
                    onChange={(value) =>
                      void runAction(
                        `${entry.id}-role`,
                        `/api/users/${entry.id}/role`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: value }),
                        },
                        t("roleUpdated", { role: t(`roles.${value}`) }),
                      )
                    }
                  />
                </Table.Td>
                <Table.Td className="px-4 py-4">
                  <span className="rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-xs font-semibold text-[var(--secondary-foreground)]">
                    {t(`statuses.${entry.status}`)}
                  </span>
                </Table.Td>
                <Table.Td className="px-4 py-4 font-mono text-xs text-[var(--muted-foreground)]">
                  {entry.authMethod}
                </Table.Td>
                <Table.Td className="px-4 py-4 sm:px-6">
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
                        variant="default"
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
                        variant="default"
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
                        variant="default"
                      >
                        {t("reactivate")}
                      </Button>
                    ) : null}
                  </div>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function mapUserError(
  error: unknown,
  t: ReturnType<typeof useTranslations<"users">>,
) {
  if (typeof error !== "string") {
    return t("couldNotUpdate");
  }

  if (error === "Cannot deactivate the last Admin user") {
    return t("lastAdminDeactivateError");
  }

  if (error === "Cannot change role of the last Admin user") {
    return t("lastAdminRoleError");
  }

  return error;
}
