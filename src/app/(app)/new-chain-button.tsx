"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFeedback } from "@/components/feedback";
import ChainForm from "@/components/chain-form";
import { btnPrimary } from "@/lib/ui";

export default function NewChainButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { toast } = useFeedback();

  const create = async (values: { name: string; description: string }) => {
    const { data, error } = await createClient()
      .from("prompt_chains")
      .insert({ name: values.name, description: values.description || null })
      .select("id")
      .single();

    if (error) {
      return error.code === "23505" ? "A chain with that name already exists." : error.message;
    }

    toast(`Created "${values.name}". Add its first step below.`);
    router.push(`/chains/${data.id}`);
    return null;
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnPrimary}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        New chain
      </button>
      {open && (
        <ChainForm
          title="New prompt chain"
          submitLabel="Create chain"
          onSubmit={create}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
