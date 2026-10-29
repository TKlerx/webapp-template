import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "@/i18n/locale";

const messages = {
  en: () => import("./messages/en.json"),
  de: () => import("./messages/de.json"),
  es: () => import("./messages/es.json"),
  fr: () => import("./messages/fr.json"),
  pt: () => import("./messages/pt.json"),
};

export default getRequestConfig(async () => {
  const locale = await getUserLocale();

  return {
    locale,
    messages: (await messages[locale]()).default,
  };
});
