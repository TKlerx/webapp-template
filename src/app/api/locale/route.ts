import { NextResponse } from "next/server";
import { locales, type Locale } from "@/i18n/config";
import { getUserLocaleCookieHeaders } from "@/i18n/locale";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const localeBodySchema = z.object({ locale: z.string().min(1) }).strict();

export async function POST(request: Request) {
  const parsed = await parseJsonBody(
    request,
    localeBodySchema,
    "Invalid locale",
  );
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (!body.locale || !locales.includes(body.locale as Locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const locale = body.locale as Locale;
  const response = NextResponse.json({ ok: true });

  for (const cookie of getUserLocaleCookieHeaders(locale)) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
