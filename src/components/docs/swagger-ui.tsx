"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/base-path";

declare global {
  interface Window {
    SwaggerUIBundle?: (config: Record<string, unknown>) => void;
  }
}

export function SwaggerUi() {
  useEffect(() => {
    const stylesheetId = "swagger-ui-styles";
    if (!document.getElementById(stylesheetId)) {
      const link = document.createElement("link");
      link.id = stylesheetId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
      document.head.appendChild(link);
    }

    const mountSwagger = () => {
      window.SwaggerUIBundle?.({
        dom_id: "#swagger-ui",
        url: withBasePath("/api/openapi"),
        layout: "BaseLayout",
        deepLinking: true,
      });
    };

    const existingScript = document.getElementById("swagger-ui-script") as HTMLScriptElement | null;
    if (existingScript) {
      if (window.SwaggerUIBundle) {
        mountSwagger();
      } else {
        existingScript.addEventListener("load", mountSwagger, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "swagger-ui-script";
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.async = true;
    script.addEventListener("load", mountSwagger, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", mountSwagger);
    };
  }, []);

  return <div className="min-h-[60vh] rounded-[2rem] bg-white p-4 text-black" id="swagger-ui" />;
}
