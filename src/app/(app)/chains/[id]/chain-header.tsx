"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFeedback } from "@/components/feedback";
import ChainForm from "@/components/chain-form";
import LiveBadge from "@/components/live-badge";
import type { Chain } from "@/lib/types";
import { btnDanger, btnSecondary } from "@/lib/ui";

export default function ChainHeader({
  chain,
  stepCount,
  share,
}: {
  chain: Chain;
  stepCount: number;
  share: number;
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const save = async (values: { name: string; description: string }) => {
    const { error } = await createClient()
      .from("prompt_chains")
      .update({ name: values.name, description: values.description || null })
      .eq("id", chain.id);
    if (error) return error.code === "23505" ? "A chain with that name already exists." : error.message;
    toast("Chain updated.");
    router.refresh();
    return null;
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete "${chain.name}"?`,
      body: `This deletes its ${stepCount} step${stepCount === 1 ? "" : "s"} and removes it from CUmor's chain mix${
        share > 0 ? `, where it currently handles ${share}% of caption requests` : ""
      }. Captions it already produced stay in CUmor. This can't be undone.`,
      confirmLabel: "Delete chain",
      destructive: true,
    });
    if (!ok) return;

    const { data, error } = await createClient().from("prompt_chains").delete().eq("id", chain.id).select("id");
    if (error || !data?.length) {
      toast(`Couldn't delete the chain: ${error?.message ?? "permission denied"}`, "error");
      return;
    }
    toast(`Deleted "${chain.name}".`);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{chain.name}</h1>
          <LiveBadge share={share} />
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
          {chain.description || "No description yet."}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setEditing(true)} className={btnSecondary}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </button>
        <button onClick={remove} className={btnDanger}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </button>
      </div>

      {editing && (
        <ChainForm
          title="Edit chain"
          submitLabel="Save"
          initial={{ name: chain.name, description: chain.description ?? "" }}
          onSubmit={save}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
