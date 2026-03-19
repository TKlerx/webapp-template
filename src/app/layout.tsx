import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "GVI Finance",
  description: "GVI Finance web application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionPromise = getSessionUser();
  const configuredBasePath = process.env.BASE_PATH ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body data-base-path={configuredBasePath}>
        <SessionLayout sessionPromise={sessionPromise}>{children}</SessionLayout>
      </body>
    </html>
  );
}

async function SessionLayout({
  sessionPromise,
  children,
}: {
  sessionPromise: ReturnType<typeof getSessionUser>;
  children: React.ReactNode;
}) {
  const user = await sessionPromise;
  const initialTheme = user?.themePreference ?? "LIGHT";
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SessionProvider user={user}>
        <ThemeProvider initialTheme={initialTheme}>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
