import { Layers } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth";
import { liveShare } from "@/lib/mix";
import type { Chain, MixEntry } from "@/lib/types";
import { card } from "@/lib/ui";
import ChainGrid from "@/components/chain-grid";
import NewChainButton from "./new-chain-button";

export const dynamic = "force-dynamic";

export default async function ChainsPage() {
  const { supabase } = await requireSuperadmin();

  const [chains, steps, mix, runs] = await Promise.all([
    supabase.from("prompt_chains").select("id, name, description, created_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("prompt_chain_steps").select("chain_id, include_image"),
    supabase.from("prompt_chain_mix").select("chain_id, weight, is_active"),
    supabase.from("generation_requests").select("chain_id").eq("status", "completed").not("chain_id", "is", null).limit(10000),
  ]);

  const error = chains.error ?? steps.error ?? mix.error ?? runs.error;
  if (error) return <p className="text-sm text-red-600">Couldn&apos;t load chains: {error.message}</p>;

  const chainList = (chains.data ?? []) as Chain[];
  const mixRows = (mix.data ?? []) as MixEntry[];

  const items = chainList.map((chain) => {
    const chainSteps = (steps.data ?? []).filter((s) => s.chain_id === chain.id);
    return {
      chain,
      stepCount: chainSteps.length,
      hasImage: chainSteps.some((s) => s.include_image),
      runCount: (runs.data ?? []).filter((r) => r.chain_id === chain.id).length,
      share: liveShare(mixRows, chain.id),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Prompt chains</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Each chain is a series of AI steps; every step&apos;s output feeds the next. Build one here,
            test-run it on text or an image, then turn it on for CUmor in the admin panel&apos;s chain mix.
          </p>
        </div>
        <NewChainButton />
      </div>

      {items.length === 0 ? (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-14 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">No prompt chains yet</p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Create your first chain, add a few steps, and run it to see what it writes.
          </p>
          <NewChainButton />
        </div>
      ) : (
        <ChainGrid items={items} />
      )}
    </div>
  );
}
