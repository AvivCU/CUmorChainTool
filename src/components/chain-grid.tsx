import Link from "next/link";
import { ChevronRight, ImageIcon, Layers, Sparkles } from "lucide-react";
import type { Chain } from "@/lib/types";
import { card } from "@/lib/ui";
import LiveBadge from "./live-badge";

export type ChainSummary = {
  chain: Chain;
  stepCount: number;
  hasImage: boolean;
  runCount: number;
  share: number;
};

export default function ChainGrid({ items }: { items: ChainSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({ chain, stepCount, hasImage, runCount, share }) => (
        <li key={chain.id}>
          <Link
            href={`/chains/${chain.id}`}
            className={`${card} group flex h-full flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700`}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-zinc-900 group-hover:text-brand-700 dark:text-zinc-50 dark:group-hover:text-brand-300">
                {chain.name}
              </h2>
              <ChevronRight
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </div>
            <p className="line-clamp-2 flex-1 text-sm text-zinc-500 dark:text-zinc-400">
              {chain.description || "No description."}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Layers className="h-3 w-3" aria-hidden="true" />
                {stepCount} step{stepCount === 1 ? "" : "s"}
              </span>
              {hasImage && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  <ImageIcon className="h-3 w-3" aria-hidden="true" />
                  Image input
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {runCount} generated
              </span>
              <LiveBadge share={share} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
