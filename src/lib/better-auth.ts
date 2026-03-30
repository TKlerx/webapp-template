import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import bcrypt from "bcryptjs";
import { AuthMethod, Role, ThemePreference, UserStatus } from "../../generated/prisma/enums";
import { getConfiguredBasePath, getScopedCookiePath, hasRealAzureAdConfig } from "@/lib/azure-auth";
import { prisma } from "@/lib/db";

export const BETTER_AUTH_COOKIE_PREFIX = "business-app-starter";
export const BETTER_AUTH_API_BASE_PATH = `${getConfiguredBasePath()}/api/auth`;

function getDatabaseProvider() {
  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  return databaseUrl.startsWith("file:") ? "sqlite" : "postgresql";
}

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getConfiguredAuthBaseUrl() {
  const configuredOrigin = process.env.AUTH_BASE_URL?.trim();
  const fallbackOrigin = `http://localhost:${process.env.PORT ?? "3000"}`;
  return trimTrailingSlash(configuredOrigin || fallbackOrigin);
}

export function getBetterAuthCookieNames() {
  const securePrefix = getConfiguredAuthBaseUrl().startsWith("https://") ? "__Secure-" : "";
  return [
    `${securePrefix}${BETTER_AUTH_COOKIE_PREFIX}.session_token`,
    `${securePrefix}${BETTER_AUTH_COOKIE_PREFIX}.session_data`,
    `${securePrefix}${BETTER_AUTH_COOKIE_PREFIX}.dont_remember`,
    `${securePrefix}${BETTER_AUTH_COOKIE_PREFIX}.account_data`,
  ];
}

export const auth = betterAuth({
  secret:
    process.env.BETTERAUTH_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-secret-very-long-and-secure",
  baseURL: getConfiguredAuthBaseUrl(),
  basePath: BETTER_AUTH_API_BASE_PATH,
  database: prismaAdapter(prisma, {
    provider: getDatabaseProvider(),
  }),
  plugins: [nextCookies()],
  advanced: {
    cookiePrefix: BETTER_AUTH_COOKIE_PREFIX,
    trustedProxyHeaders: true,
    defaultCookieAttributes: {
      path: getScopedCookiePath(),
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    password: {
      hash(password) {
        return bcrypt.hash(password, 12);
      },
      verify({ password, hash }) {
        return bcrypt.compare(password, hash);
      },
    },
  },
  account: {
    accountLinking: {
      trustedProviders: ["microsoft"],
    },
  },
  socialProviders: hasRealAzureAdConfig()
    ? {
        microsoft: {
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        defaultValue: Role.SCOPE_USER,
      },
      status: {
        type: "string",
        input: false,
        defaultValue: UserStatus.PENDING_APPROVAL,
      },
      authMethod: {
        type: "string",
        input: false,
        defaultValue: AuthMethod.SSO,
      },
      mustChangePassword: {
        type: "boolean",
        input: false,
        defaultValue: false,
      },
      themePreference: {
        type: "string",
        input: false,
        defaultValue: ThemePreference.LIGHT,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          return {
            data: {
              ...user,
              email: user.email.toLowerCase(),
            },
          };
        },
      },
    },
  },
});
