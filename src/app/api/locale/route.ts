import { NextResponse } from "next/server";
import { locales, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/locale";

export async function POST(request: Request) {
  const body = (await request.json()) as { locale?: string };

  if (!body.locale || !locales.includes(body.locale as Locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  await setUserLocale(body.locale as Locale);
  return NextResponse.json({ ok: true });
}
