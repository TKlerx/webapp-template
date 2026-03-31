import "dotenv/config";
import { execFileSync } from "node:child_process";
import {
  AuditAction,
  AuthMethod,
  Role,
  type ThemePreference,
  UserStatus,
} from "../../../generated/prisma/enums";

type LocalUserSeed = {
  email: string;
  name: string;
  role: Role;
  password: string;
  mustChangePassword: boolean;
  status?: UserStatus;
};

function runDbWorker<TInput, TResult>(operation: string, payload: TInput): TResult {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "tests/e2e/helpers/db-worker.ts", operation],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: "file:./e2e.db",
      },
      encoding: "utf8",
      input: JSON.stringify(payload),
    },
  ).trim();

  return output ? (JSON.parse(output) as TResult) : (null as TResult);
}

export function seedLocalUser(user: LocalUserSeed) {
  return runDbWorker<typeof user, string>("seedLocalUser", user);
}

export function seedSsoUser(user: {
  email: string;
  name: string;
  role?: Role;
  status: UserStatus;
  authMethod?: AuthMethod;
}) {
  return runDbWorker<typeof user, string>("seedSsoUser", user);
}

export function findUserByEmail(email: string) {
  return runDbWorker<
    { email: string },
    {
      id: string;
      email: string;
      name: string;
      role: Role;
      status: UserStatus;
      authMethod: AuthMethod;
    } | null
  >("findUserByEmail", { email });
}

export function updateUserStatus(email: string, status: UserStatus) {
  return runDbWorker<{ email: string; status: UserStatus }, null>("updateUserStatus", {
    email,
    status,
  });
}

export function assignUserToScope(email: string, scope: { code: string; name: string }) {
  return runDbWorker<{ email: string; scope: { code: string; name: string } }, string>(
    "assignUserToScope",
    {
      email,
      scope,
    },
  );
}

export function addAuditEntryFixture(input: {
  actorEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  scopeId?: string | null;
  details?: unknown;
}) {
  return runDbWorker<typeof input, string>("addAuditEntryFixture", input);
}

export function seedBackgroundJob(input: {
  jobType: string;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  createdByEmail?: string;
  workerId?: string | null;
  attemptCount?: number;
}) {
  return runDbWorker<typeof input, string>("seedBackgroundJob", input);
}

export { AuditAction, AuthMethod, Role, UserStatus };
export type { ThemePreference };
