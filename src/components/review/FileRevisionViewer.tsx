"use client";

import { useTranslations } from "next-intl";
import { withBasePath } from "@/lib/base-path";
import { FileViewer } from "@/components/ui/FileViewer";

type FileRevisionViewerProps = {
  receiptId: string;
  original: {
    fileName: string;
    mimeType: string;
  };
  revisions: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    createdAt: string | Date;
    uploadedBy: {
      name: string;
      role: string;
    };
  }>;
};

export function FileRevisionViewer({ receiptId, original, revisions }: FileRevisionViewerProps) {
  const t = useTranslations("review");

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] opacity-55">
          {t("filePreview")}
        </p>
        <FileViewer
          fileName={original.fileName}
          mimeType={original.mimeType}
          src={withBasePath(`/api/receipts/${receiptId}/file`)}
        />
      </section>

      {revisions.length > 0 ? (
        <section className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] opacity-55">
            {t("revisions")}
          </p>
          {revisions.map((revision) => (
            <div key={revision.id} className="space-y-3">
              <div className="text-sm opacity-75">
                {revision.fileName} - {revision.uploadedBy.name} ({revision.uploadedBy.role}) -{" "}
                {new Date(revision.createdAt).toLocaleString()}
              </div>
              <FileViewer
                fileName={revision.fileName}
                mimeType={revision.mimeType}
                src={withBasePath(`/api/receipts/${receiptId}/file?revisionId=${revision.id}`)}
              />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
