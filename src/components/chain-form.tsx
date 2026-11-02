"use client";

import { useEffect, useState } from "react";
import { btnPrimary, btnSecondary, input, label } from "@/lib/ui";

// Modal for creating or renaming a chain. onSubmit returns an error
// message to show, or null on success.
export default function ChainForm({
  title,
  submitLabel,
  initial = { name: "", description: "" },
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: { name: string; description: string };
  onSubmit: (values: { name: string; description: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Give the chain a name.");
    setSaving(true);
    setError("");
    const problem = await onSubmit({ name: name.trim(), description: description.trim() });
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="chain-form-title"
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 id="chain-form-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Name</span>
            <input
              autoFocus
              className={input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Image to five captions"
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>
              Description <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <textarea
              className={`${input} min-h-20`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this chain do differently?"
              maxLength={300}
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
