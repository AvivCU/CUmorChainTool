import Link from "next/link";
import Image from "next/image";
import { FlaskConical, Images, MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { splitCaptions } from "@/lib/prompt-chain";
import { card } from "@/lib/ui";

export type MediaRequest = {
  id: number;
  user_id: string | null;
  prompt: string;
  output: string | null;
  image_url: string | null;
  source: "app" | "tool";
  created_at: string;
};

export type PostedCaption = {
  id: number;
  request_id: number | null;
  caption: string;
  upvotes: number;
  downvotes: number;
};

export const MEDIA_FILTERS = [
  { id: "all", label: "All" },
  { id: "tool", label: "Tool runs" },
  { id: "app", label: "From CUmor users" },
] as const;

export default function MediaGrid({
  chainId,
  filter,
  requests,
  posted,
  names,
}: {
  chainId: number;
  filter: string;
  requests: MediaRequest[];
  posted: PostedCaption[];
  names: Record<string, string>;
}) {
  const postedByRequest = new Map<number, PostedCaption[]>();
  for (const g of posted) {
    if (g.request_id === null) continue;
    postedByRequest.set(g.request_id, [...(postedByRequest.get(g.request_id) ?? []), g]);
  }
  const totalScore = posted.reduce((sum, g) => sum + g.upvotes - g.downvotes, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav
          aria-label="Filter media"
          className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {MEDIA_FILTERS.map((f) => (
            <Link
              key={f.id}
              aria-current={filter === f.id ? "page" : undefined}
              href={`/chains/${chainId}?tab=media${f.id === "all" ? "" : `&source=${f.id}`}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.id
                  ? "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {requests.length} generation{requests.length === 1 ? "" : "s"} · {posted.length} posted to CUmor
          {posted.length > 0 && ` · net score ${totalScore > 0 ? "+" : ""}${totalScore}`}
        </p>
      </div>

      {requests.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <Images className="h-7 w-7 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
          <p className="font-medium text-zinc-900 dark:text-zinc-50">Nothing generated yet</p>
          <Link
            href={`/chains/${chainId}?tab=run`}
            className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Run this chain →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {requests.map((r) => {
            const postedHere = postedByRequest.get(r.id) ?? [];
            const postedCaptions = new Set(postedHere.map((g) => g.caption));
            const outputs = r.output ? splitCaptions(r.output) : [];
            const unposted = outputs.filter((c) => !postedCaptions.has(c));
            return (
              <li key={r.id} className={`${card} flex flex-col overflow-hidden`}>
                {r.image_url && (
                  <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-950">
                    <Image
                      src={r.image_url}
                      alt="Image this run was given"
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-contain"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {r.source === "tool" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
                        <FlaskConical className="h-3 w-3" aria-hidden="true" />
                        Tool run
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <MessageSquare className="h-3 w-3" aria-hidden="true" />
                        CUmor user
                      </span>
                    )}
                    <span className="text-zinc-400">
                      {names[r.user_id ?? ""] ?? "Unknown"} · {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  {r.prompt && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Prompt: <span className="text-zinc-700 dark:text-zinc-300">{r.prompt}</span>
                    </p>
                  )}

                  <ul className="flex flex-col gap-2">
                    {postedHere.map((g) => (
                      <li key={g.id} className="rounded-lg bg-green-50 p-2.5 text-sm dark:bg-green-950/40">
                        <p className="text-zinc-900 dark:text-zinc-50">&ldquo;{g.caption}&rdquo;</p>
                        <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="font-medium text-green-700 dark:text-green-400">In CUmor feed</span>
                          <span className="inline-flex items-center gap-1" aria-label={`${g.upvotes} upvotes`}>
                            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                            {g.upvotes}
                          </span>
                          <span className="inline-flex items-center gap-1" aria-label={`${g.downvotes} downvotes`}>
                            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                            {g.downvotes}
                          </span>
                        </p>
                      </li>
                    ))}
                    {unposted.map((caption) => (
                      <li
                        key={caption}
                        className="rounded-lg bg-zinc-50 p-2.5 text-sm text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                      >
                        &ldquo;{caption}&rdquo;
                      </li>
                    ))}
                    {postedHere.length === 0 && outputs.length === 0 && (
                      <li className="text-sm italic text-zinc-400">No saved output for this older run.</li>
                    )}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
