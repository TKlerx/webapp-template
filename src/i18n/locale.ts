import "server-only";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { defaultLocale, locales, type Locale } from "./config";

export const LOCALE_COOKIE = "starter_app_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;

  if (value && locales.includes(value as Locale)) {
    return value as Locale;
  }

  const savedLocale = (await getSessionUser())?.locale;
  return locales.find((locale) => locale === savedLocale) ?? defaultLocale;
}

export function getUserLocaleCookieHeaders(locale: Locale) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/";
  const expires = new Date(
    Date.now() + LOCALE_COOKIE_MAX_AGE * 1000,
  ).toUTCString();
  const paths = basePath === "/" ? ["/"] : ["/", basePath];

  return paths.map(
    (path) =>
      `${LOCALE_COOKIE}=${locale}; Path=${path}; Expires=${expires}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`,
  );
}
