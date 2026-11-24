import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppVersionBadge } from "@/components/ui/AppVersionBadge";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Webapp Template",
  description: "Reusable web application template",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const configuredBasePath = process.env.BASE_PATH ?? "";
  const [user, locale, messages] = await Promise.all([
    getSessionUser(),
    getLocale(),
    getMessages(),
  ]);
  const initialTheme = user?.themePreference ?? "DARK";
  const colorScheme = initialTheme === "DARK" ? "dark" : "light";

  return (
    <html
      lang={locale}
      data-theme={colorScheme}
      data-mantine-color-scheme={colorScheme}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable}`}
        data-base-path={configuredBasePath}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <SessionProvider user={user}>
            <ThemeProvider initialTheme={initialTheme}>
              <ToastProvider>
                {children}
                <AppVersionBadge />
              </ToastProvider>
            </ThemeProvider>
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
