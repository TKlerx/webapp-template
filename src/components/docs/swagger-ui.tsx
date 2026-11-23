"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void;
  }
}

type SwaggerBundle = NonNullable<Window["SwaggerUIBundle"]>;
let bundleRequest: Promise<SwaggerBundle> | undefined;

function loadBundle(): Promise<SwaggerBundle> {
  if (window.SwaggerUIBundle) return Promise.resolve(window.SwaggerUIBundle);
  bundleRequest ??= new Promise<SwaggerBundle>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = withBasePath("/vendor/swagger-ui/swagger-ui-bundle.js");
    script.async = true;
    const fail = () => {
      script.remove();
      reject(new Error("Swagger UI bundle failed to load"));
    };
    script.onerror = fail;
    script.onload = () => {
      if (window.SwaggerUIBundle) resolve(window.SwaggerUIBundle);
      else fail();
    };
    document.body.appendChild(script);
  }).catch((error: unknown) => {
    bundleRequest = undefined;
    throw error;
  });
  return bundleRequest;
}

export function SwaggerUi() {
  const t = useTranslations("apiDocs");
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const stylesheetId = "swagger-ui-styles";
    if (!document.getElementById(stylesheetId)) {
      const link = document.createElement("link");
      link.id = stylesheetId;
      link.rel = "stylesheet";
      link.href = withBasePath("/vendor/swagger-ui/swagger-ui.css");
      document.head.appendChild(link);
    }

    let cancelled = false;
    void loadBundle()
      .then((bundle) => {
        if (cancelled) return;
        bundle({
          dom_id: "#swagger-ui",
          url: withBasePath("/api/openapi"),
          layout: "BaseLayout",
          deepLinking: true,
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="min-h-[60vh] overflow-hidden rounded-lg border border-[var(--border)] bg-white p-4 text-black shadow-[0_18px_42px_-38px_var(--foreground)]">
      {error && (
        <div role="alert">
          <p>{t("loadError")}</p>
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}
      <div id="swagger-ui" />
    </div>
  );
}
