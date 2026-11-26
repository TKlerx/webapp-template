"use client";

import { Download, ExternalLink, Terminal } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@mantine/core";
import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";

type CliReleaseAsset = {
  target: string;
  label: string;
  filename: string;
  available: boolean;
};

type CliReleaseResponse = {
  assets: CliReleaseAsset[];
  checksumsAvailable: boolean;
};

const subscribeToOrigin = () => () => {};
const clientOrigin = () =>
  window.location.origin + withBasePath("/").replace(/\/$/, "");
const serverOrigin = () => "<APP_URL>";

export function CliDownloads() {
  const t = useTranslations("tokens.downloads");
  const serverUrl = useSyncExternalStore(
    subscribeToOrigin,
    clientOrigin,
    serverOrigin,
  );
  const [downloads, setDownloads] = useState<CliReleaseResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(withBasePath("/api/downloads/cli"), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load CLI downloads");
        return response.json();
      })
      .then((payload: CliReleaseResponse) => setDownloads(payload))
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [request]);

  const assets = downloads?.assets.filter((asset) => asset.available) ?? [];

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <Terminal className="mt-1 size-5 shrink-0 text-[var(--muted-foreground)]" />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("description")}
          </p>
        </div>
      </div>

      <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-black/5 p-3 font-mono text-xs dark:bg-white/5">
        {`starterctl configure --server ${serverUrl} --token <TOKEN>
starterctl health`}
      </pre>

      {assets.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <Button
              className="justify-start gap-2"
              key={asset.target}
              component="a"
              href={withBasePath(`/api/downloads/cli/${asset.target}`)}
              variant="default"
            >
              <Download className="size-4" />
              {asset.label}
            </Button>
          ))}
        </div>
      ) : loadError ? (
        <div className="mt-4 space-y-2">
          <p role="alert">{t("failed")}</p>
          <Button
            type="button"
            onClick={() => {
              setLoadError(false);
              setRequest((value) => value + 1);
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : !downloads ? (
        <p className="mt-4 text-sm" role="status">
          {t("loading")}
        </p>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
          {t("unavailable")}
        </p>
      )}

      {downloads?.checksumsAvailable ? (
        <Button
          className="mt-3 gap-2"
          component="a"
          href={withBasePath("/api/downloads/cli/checksums")}
          variant="default"
        >
          <ExternalLink className="size-4" />
          {t("checksums")}
        </Button>
      ) : null}
    </section>
  );
}
