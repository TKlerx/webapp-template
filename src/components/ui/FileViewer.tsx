import Image from "next/image";

type FileViewerProps = {
  src: string;
  mimeType: string;
  fileName: string;
};

export function FileViewer({ src, mimeType, fileName }: FileViewerProps) {
  if (mimeType.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--panel)] dark:border-white/10">
        <Image
          alt={fileName}
          className="h-auto max-h-[70vh] w-full object-contain"
          height={1200}
          src={src}
          unoptimized
          width={1200}
        />
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--panel)] dark:border-white/10">
        <iframe
          className="h-[70vh] w-full"
          src={src}
          title={fileName}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[var(--panel)] p-6 text-sm dark:border-white/15">
      <p className="font-medium">{fileName}</p>
      <p className="mt-2 opacity-70">This file type cannot be previewed inline.</p>
      <a className="mt-4 inline-flex underline" href={src}>
        Download file
      </a>
    </div>
  );
}
