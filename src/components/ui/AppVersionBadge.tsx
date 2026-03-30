import { getAppVersionLabel } from "@/lib/app-version";

export function AppVersionBadge() {
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-50 rounded-full border border-black/10 bg-[color:color-mix(in_srgb,var(--panel)_88%,transparent)] px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-[color:var(--foreground)] opacity-70 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10">
      {getAppVersionLabel()}
    </div>
  );
}
