"use client";

import { useTranslations } from "next-intl";

type CommentThreadProps = {
  comments: Array<{
    id: string;
    text: string;
    createdAt: string | Date;
    author: {
      name: string;
      role: string;
    };
  }>;
};

export function CommentThread({ comments }: CommentThreadProps) {
  const t = useTranslations("review");

  if (comments.length === 0) {
    return <p className="text-sm opacity-65">{t("noComments")}</p>;
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <article
          key={comment.id}
          className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4 dark:border-white/10"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] opacity-55">
            <span>{comment.author.name}</span>
            <span>{comment.author.role}</span>
            <span>{new Date(comment.createdAt).toLocaleString()}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{comment.text}</p>
        </article>
      ))}
    </div>
  );
}
