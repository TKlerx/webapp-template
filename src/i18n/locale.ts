import "server-only";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

const LOCALE_COOKIE = "starter_app_locale";

export async function getUserLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;

  if (value && locales.includes(value as Locale)) {
    return value as Locale;
  }

  return defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: process.env.NEXT_PUBLIC_BASE_PATH || "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
