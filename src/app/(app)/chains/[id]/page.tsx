import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Images, ListOrdered, Play } from "lucide-react";
import { requireSuperadmin } from "@/lib/auth";
import { liveShare } from "@/lib/mix";
import type { Chain, MixEntry, Model, Step } from "@/lib/types";
import ChainHeader from "./chain-header";
import StepsEditor from "./steps-editor";
import RunPanel from "./run-panel";
import MediaList from "./media-list";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "steps", label: "Steps", Icon: ListOrdered },
  { id: "run", label: "Run", Icon: Play },
  { id: "media", label: "Media", Icon: Images },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function ChainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; source?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(id)) notFound();
  const chainId = Number(id);
  const tab: TabId = TABS.some((t) => t.id === query.tab) ? (query.tab as TabId) : "steps";

  const { supabase, user, displayName } = await requireSuperadmin();

  const [chain, steps, models, mix, runCount] = await Promise.all([
    supabase.from("prompt_chains").select("id, name, description, created_at, updated_at").eq("id", chainId).maybeSingle(),
    supabase
      .from("prompt_chain_steps")
      .select("id, chain_id, step_order, title, include_image, llm_model_id, prompt_template")
      .eq("chain_id", chainId)
      .order("step_order"),
    supabase.from("llm_models").select("id, name, model_identifier, is_active, llm_providers(name)").order("name"),
    supabase.from("prompt_chain_mix").select("chain_id, weight, is_active"),
    supabase
      .from("generation_requests")
      .select("id", { count: "exact", head: true })
      .eq("chain_id", chainId)
      .eq("status", "completed"),
  ]);

  const error = chain.error ?? steps.error ?? models.error ?? mix.error;
  if (error) return <p className="text-sm text-red-600">Couldn&apos;t load this chain: {error.message}</p>;
  if (!chain.data) notFound();

  const stepRows = (steps.data ?? []) as Step[];
  const modelRows = (models.data ?? []) as unknown as Model[];
  const share = liveShare((mix.data ?? []) as MixEntry[], chainId);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All chains
      </Link>

      <ChainHeader chain={chain.data as Chain} stepCount={stepRows.length} share={share} />

      <nav aria-label="Chain sections" className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map(({ id: tabId, label, Icon }) => {
          const active = tab === tabId;
          return (
            <Link
              key={tabId}
              href={`/chains/${chainId}?tab=${tabId}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              {tabId === "steps" && (
                <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {stepRows.length}
                </span>
              )}
              {tabId === "media" && (
                <span className="rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {runCount.count ?? 0}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {tab === "steps" && <StepsEditor chainId={chainId} initialSteps={stepRows} models={modelRows} />}
      {tab === "run" && (
        <RunPanel
          chainId={chainId}
          steps={stepRows.map((s) => ({ order: s.step_order, title: s.title, includeImage: s.include_image }))}
          userId={user.id}
          authorName={displayName}
        />
      )}
      {tab === "media" && <MediaList chainId={chainId} source={query.source} />}
    </div>
  );
}
