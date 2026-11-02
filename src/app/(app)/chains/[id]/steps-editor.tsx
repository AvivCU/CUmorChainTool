"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ImageIcon,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFeedback } from "@/components/feedback";
import type { Model, Step } from "@/lib/types";
import { btnGhost, btnPrimary, btnSecondary, card, iconBtn, input, label } from "@/lib/ui";

type Draft = {
  title: string;
  llm_model_id: number | "";
  include_image: boolean;
  prompt_template: string;
};

const NEW = "new";

function templateWarnings(template: string, order: number): string[] {
  const warnings: string[] = [];
  if (order === 1 && /\{\{\s*previous\s*\}\}/.test(template)) {
    warnings.push("{{previous}} is empty in step 1. Use {{input}} for the user's text.");
  }
  const later = [...template.matchAll(/\{\{\s*step_(\d+)\s*\}\}/g)]
    .map((match) => Number(match[1]))
    .filter((n) => n >= order);
  for (const n of new Set(later)) {
    warnings.push(`{{step_${n}}} refers to a step that hasn't run yet at this point, so it stays blank.`);
  }
  return warnings;
}

function variablesFor(order: number) {
  const vars = [
    { token: "{{input}}", help: "The text the user typed" },
    { token: "{{previous}}", help: "Output of the step right before this one" },
  ];
  for (let n = 1; n < order; n++) vars.push({ token: `{{step_${n}}}`, help: `Output of step ${n}` });
  vars.push({ token: "{{terms}}", help: "Campus terms from the admin panel" });
  vars.push({ token: "{{examples}}", help: "Liked example captions" });
  return order === 1 ? vars.filter((v) => v.token !== "{{previous}}") : vars;
}

export default function StepsEditor({
  chainId,
  initialSteps,
  models,
}: {
  chainId: number;
  initialSteps: Step[];
  models: Model[];
}) {
  const [steps, setSteps] = useState(initialSteps);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast, confirm } = useFeedback();

  const modelName = (id: number) => {
    const model = models.find((m) => m.id === id);
    return model ? `${model.name}${model.is_active ? "" : " (inactive)"}` : "Unknown model";
  };
  const defaultModelId = models.find((m) => m.is_active)?.id ?? "";

  const startEdit = (step: Step) =>
    setDrafts((d) => ({
      ...d,
      [step.id]: {
        title: step.title ?? "",
        llm_model_id: step.llm_model_id,
        include_image: step.include_image,
        prompt_template: step.prompt_template,
      },
    }));

  const startNew = () =>
    setDrafts((d) => ({
      ...d,
      [NEW]: {
        title: "",
        llm_model_id: defaultModelId,
        include_image: false,
        prompt_template:
          steps.length === 0
            ? "Write one short, witty caption for Columbia students about: {{input}}\nRespond with only the caption."
            : "{{previous}}",
      },
    }));

  const closeDraft = (key: string | number) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });

  const validate = (draft: Draft) => {
    if (draft.llm_model_id === "") return "Pick a model for this step.";
    if (!draft.prompt_template.trim()) return "The prompt can't be empty.";
    return null;
  };

  const saveDraft = async (key: string | number) => {
    const draft = drafts[key];
    const problem = validate(draft);
    if (problem) return toast(problem, "error");

    const fields = {
      title: draft.title.trim() || null,
      llm_model_id: Number(draft.llm_model_id),
      include_image: draft.include_image,
      prompt_template: draft.prompt_template,
    };
    const supabase = createClient();
    const select = "id, chain_id, step_order, title, include_image, llm_model_id, prompt_template";

    if (key === NEW) {
      const { data, error } = await supabase
        .from("prompt_chain_steps")
        .insert({ ...fields, chain_id: chainId, step_order: steps.length + 1 })
        .select(select)
        .single();
      if (error) return toast(`Couldn't add the step: ${error.message}`, "error");
      setSteps((s) => [...s, data as Step]);
      toast(`Added step ${steps.length + 1}.`);
    } else {
      const { data, error } = await supabase
        .from("prompt_chain_steps")
        .update(fields)
        .eq("id", key)
        .select(select)
        .single();
      if (error) return toast(`Couldn't save the step: ${error.message}`, "error");
      setSteps((s) => s.map((step) => (step.id === (data as Step).id ? (data as Step) : step)));
      toast("Step saved.");
    }
    closeDraft(key);
    router.refresh();
  };

  const removeStep = async (step: Step) => {
    const ok = await confirm({
      title: `Delete step ${step.step_order}${step.title ? ` "${step.title}"` : ""}?`,
      body:
        step.step_order < steps.length
          ? "The steps after it move up one place. Any {{step_N}} references in later steps may need updating."
          : "This can't be undone.",
      confirmLabel: "Delete step",
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    const { error } = await createClient().rpc("delete_prompt_chain_step", { p_step_id: step.id });
    setBusy(false);
    if (error) return toast(`Couldn't delete the step: ${error.message}`, "error");

    setSteps((s) =>
      s.filter((x) => x.id !== step.id).map((x, index) => ({ ...x, step_order: index + 1 }))
    );
    closeDraft(step.id);
    toast("Step deleted.");
    router.refresh();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;

    const previous = steps;
    const reordered = [...steps];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const renumbered = reordered.map((step, i) => ({ ...step, step_order: i + 1 }));
    setSteps(renumbered);
    setBusy(true);

    const { error } = await createClient().rpc("reorder_prompt_chain_steps", {
      p_chain_id: chainId,
      p_step_ids: renumbered.map((step) => step.id),
    });
    setBusy(false);

    if (error) {
      setSteps(previous);
      return toast(`Couldn't reorder: ${error.message}`, "error");
    }
    toast(`Moved to step ${target + 1}.`, "info");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Steps run top to bottom. Each step&apos;s output becomes <code className="font-mono text-brand-700 dark:text-brand-300">{"{{previous}}"}</code> for the next one, and the last step&apos;s output is the result.
        </p>
        {steps.length > 0 && !drafts[NEW] && (
          <button onClick={startNew} className={btnSecondary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add step
          </button>
        )}
      </div>

      {steps.length === 0 && !drafts[NEW] && (
        <div className={`${card} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">This chain has no steps yet</p>
          <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Example: step 1 describes an image, step 2 finds what&apos;s funny about it, step 3 writes five captions.
          </p>
          <button onClick={startNew} className={btnPrimary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add the first step
          </button>
        </div>
      )}

      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const draft = drafts[step.id];
          const warnings = templateWarnings(draft?.prompt_template ?? step.prompt_template, step.step_order);
          return (
            <li key={step.id} className="flex flex-col">
              {index > 0 && <Connector />}
              {draft ? (
                <StepForm
                  heading={`Edit step ${step.step_order}`}
                  order={step.step_order}
                  draft={draft}
                  models={models}
                  warnings={warnings}
                  onChange={(next) => setDrafts((d) => ({ ...d, [step.id]: next }))}
                  onCancel={() => closeDraft(step.id)}
                  onSave={() => saveDraft(step.id)}
                />
              ) : (
                <article className={`${card} p-4 sm:p-5`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white dark:bg-brand-500">
                      {step.step_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                          {step.title || <span className="italic text-zinc-400">Untitled step</span>}
                        </h3>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {modelName(step.llm_model_id)}
                        </span>
                        {step.include_image && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                            <ImageIcon className="h-3 w-3" aria-hidden="true" />
                            Sees the image
                          </span>
                        )}
                      </div>
                      <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                        {step.prompt_template}
                      </pre>
                      {warnings.map((w) => (
                        <p key={w} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          {w}
                        </p>
                      ))}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        className={iconBtn}
                        aria-label={`Move step ${step.step_order} up`}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={busy || index === steps.length - 1}
                        className={iconBtn}
                        aria-label={`Move step ${step.step_order} down`}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button onClick={() => startEdit(step)} className={iconBtn} aria-label={`Edit step ${step.step_order}`} title="Edit">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => removeStep(step)}
                        disabled={busy}
                        className={`${iconBtn} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400`}
                        aria-label={`Delete step ${step.step_order}`}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              )}
            </li>
          );
        })}
        {drafts[NEW] && (
          <li className="flex flex-col">
            {steps.length > 0 && <Connector />}
            <StepForm
              heading={`New step ${steps.length + 1}`}
              order={steps.length + 1}
              draft={drafts[NEW]}
              models={models}
              warnings={templateWarnings(drafts[NEW].prompt_template, steps.length + 1)}
              onChange={(next) => setDrafts((d) => ({ ...d, [NEW]: next }))}
              onCancel={() => closeDraft(NEW)}
              onSave={() => saveDraft(NEW)}
            />
          </li>
        )}
      </ol>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex h-8 items-center pl-[1.85rem] sm:pl-[2.1rem]" aria-hidden="true">
      <div className="flex h-full flex-col items-center">
        <div className="w-px flex-1 bg-brand-300 dark:bg-brand-700" />
        <ArrowDownToLine className="h-3.5 w-3.5 text-brand-500" />
      </div>
    </div>
  );
}

function StepForm({
  heading,
  order,
  draft,
  models,
  warnings,
  onChange,
  onCancel,
  onSave,
}: {
  heading: string;
  order: number;
  draft: Draft;
  models: Model[];
  warnings: string[];
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const templateId = useId();
  // Where the user last left the cursor; null until they click into the
  // box, so a variable clicked first is appended rather than prepended.
  const cursor = useRef<{ start: number; end: number } | null>(null);
  const selectable = models.filter((m) => m.is_active || m.id === draft.llm_model_id);

  const rememberCursor = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    cursor.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
  };

  const insertVariable = (token: string) => {
    const el = templateRef.current;
    const length = draft.prompt_template.length;
    const { start, end } = cursor.current ?? { start: length, end: length };
    const next = draft.prompt_template.slice(0, start) + token + draft.prompt_template.slice(end);
    onChange({ ...draft, prompt_template: next });
    const caret = start + token.length;
    cursor.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const save = async () => {
    setSaving(true);
    await onSave();
    setSaving(false);
  };

  return (
    <div className={`${card} border-brand-300 p-4 ring-2 ring-brand-500/15 sm:p-5 dark:border-brand-700`}>
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{heading}</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>
            Title <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          <input
            className={input}
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="e.g. Describe the image"
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Model</span>
          <select
            className={input}
            value={draft.llm_model_id}
            onChange={(e) => onChange({ ...draft, llm_model_id: e.target.value ? Number(e.target.value) : "" })}
          >
            <option value="">Choose a model…</option>
            {selectable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.llm_providers?.name ?? "?"}
                {m.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-brand-700"
          checked={draft.include_image}
          onChange={(e) => onChange({ ...draft, include_image: e.target.checked })}
        />
        <span className="text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Send the uploaded image to this step</span>
          <span className="block text-zinc-500 dark:text-zinc-400">
            Use this for the step that looks at the picture, e.g. &ldquo;describe this image&rdquo;.
          </span>
        </span>
      </label>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={templateId} className={label}>
          Prompt
        </label>
        <div className="flex flex-wrap gap-1.5" aria-label="Insert a variable">
          {variablesFor(order).map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertVariable(v.token)}
              title={v.help}
              className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-xs text-brand-800 transition-colors hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900"
            >
              {v.token}
            </button>
          ))}
        </div>
        <textarea
          id={templateId}
          ref={templateRef}
          className={`${input} min-h-40 font-mono text-xs leading-relaxed`}
          value={draft.prompt_template}
          onChange={(e) => {
            onChange({ ...draft, prompt_template: e.target.value });
            rememberCursor(e);
          }}
          onSelect={rememberCursor}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Click a variable to insert it at the cursor. Hover one to see what it holds.
        </p>
        {warnings.map((w) => (
          <p key={w} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {w}
          </p>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className={btnGhost}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save step"}
        </button>
      </div>
    </div>
  );
}
