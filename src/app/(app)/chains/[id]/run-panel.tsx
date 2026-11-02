"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Copy,
  ImagePlus,
  LoaderCircle,
  Play,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFeedback } from "@/components/feedback";
import type { RunStreamEvent } from "@/lib/types";
import { btnGhost, btnPrimary, card, input, label } from "@/lib/ui";

type StepStatus = "waiting" | "running" | "done" | "failed";
type TimelineStep = { order: number; title: string | null; status: StepStatus; output?: string; latencyMs?: number };
type Result = { requestId: number; captions: string[]; output: string };

const MAX_SIDE = 1600;

// Large photos are shrunk in the browser so uploads stay well under the
// server's 4 MB limit and the model gets a sensible size.
async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size < 1_000_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

export default function RunPanel({
  chainId,
  steps,
  userId,
  authorName,
}: {
  chainId: number;
  steps: { order: number; title: string | null; includeImage: boolean }[];
  userId: string;
  authorName: string;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [failure, setFailure] = useState("");
  const [posted, setPosted] = useState<Record<string, "posting" | "posted">>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useFeedback();

  const imageStep = steps.find((s) => s.includeImage);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("That file isn't an image.", "error");
    const prepared = await prepareImage(file);
    if (prepared.size > 4 * 1024 * 1024) return toast("That image is too large (max 4 MB).", "error");
    setImage(prepared);
    setPreview(URL.createObjectURL(prepared));
  };

  const clearImage = () => {
    setImage(null);
    setPreview(null);
  };

  const handleEvent = (event: RunStreamEvent) => {
    if (event.type === "start") {
      setTimeline(
        event.steps.map((s, i) => ({ order: s.order, title: s.title, status: i === 0 ? "running" : "waiting" }))
      );
    } else if (event.type === "step") {
      setTimeline((current) => {
        const next = current.map((s) =>
          s.order === event.order
            ? { ...s, status: (event.ok ? "done" : "failed") as StepStatus, output: event.output, latencyMs: event.latencyMs }
            : s
        );
        const waitingIndex = next.findIndex((s) => s.status === "waiting");
        if (event.ok && waitingIndex >= 0) next[waitingIndex] = { ...next[waitingIndex], status: "running" };
        return next;
      });
    } else if (event.type === "done") {
      setResult({ requestId: event.requestId, captions: event.captions, output: event.output });
    } else if (event.type === "error") {
      setFailure(event.message);
    }
  };

  const run = async () => {
    if (!text.trim() && !image) return toast("Type a prompt or add an image first.", "error");

    setRunning(true);
    setTimeline(steps.map((s, i) => ({ order: s.order, title: s.title, status: i === 0 ? "running" : "waiting" })));
    setResult(null);
    setFailure("");
    setPosted({});

    const form = new FormData();
    form.set("input", text);
    if (image) form.set("image", image);

    try {
      const response = await fetch(`/api/chains/${chainId}/run`, { method: "POST", body: form });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Run failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handleEvent(JSON.parse(line) as RunStreamEvent);
      }
      if (buffer.trim()) handleEvent(JSON.parse(buffer) as RunStreamEvent);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Run failed.");
      setTimeline((current) => current.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s)));
    } finally {
      setRunning(false);
      router.refresh();
    }
  };

  const post = async (caption: string) => {
    if (!result) return;
    setPosted((p) => ({ ...p, [caption]: "posting" }));
    const { error } = await createClient().from("generations").insert({
      creator_id: userId,
      author_name: authorName,
      prompt: text.trim() || "Caption for an image",
      caption,
      request_id: result.requestId,
    });
    if (error) {
      setPosted((p) => {
        const next = { ...p };
        delete next[caption];
        return next;
      });
      return toast(`Couldn't post it: ${error.message}`, "error");
    }
    setPosted((p) => ({ ...p, [caption]: "posted" }));
    toast("Posted to the CUmor feed.");
    router.refresh();
  };

  const copy = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      toast("Copied.", "info");
    } catch {
      toast("Couldn't copy. Select the text instead.", "error");
    }
  };

  if (steps.length === 0) {
    return (
      <div className={`${card} px-6 py-12 text-center`}>
        <p className="font-medium text-zinc-900 dark:text-zinc-50">Add a step before running this chain</p>
        <Link href={`/chains/${chainId}?tab=steps`} className={`${btnPrimary} mt-4`}>
          Go to steps
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className={`${card} flex h-fit flex-col gap-4 p-5`} aria-label="Run inputs">
        <div>
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Generate with this chain</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Runs every step in order. Results are saved under Media; post the ones you like to CUmor.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={label}>
            Prompt <span className="font-normal text-zinc-400">(becomes {"{{input}}"})</span>
          </span>
          <textarea
            className={`${input} min-h-24`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. waiting for the 1 train during finals week"
            maxLength={2000}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={label}>
            Image <span className="font-normal text-zinc-400">(optional)</span>
          </span>
          {preview ? (
            <div className="relative overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={preview} alt="Selected input" className="max-h-64 w-full object-contain bg-zinc-50 dark:bg-zinc-950" />
              <button
                onClick={clearImage}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickImage(e.dataTransfer.files[0]);
              }}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition-colors ${
                dragging
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                  : "border-zinc-300 text-zinc-500 hover:border-brand-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              }`}
            >
              <ImagePlus className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              <span>
                <span className="font-medium text-brand-700 dark:text-brand-300">Choose an image</span> or drop one here
              </span>
              <span className="text-xs text-zinc-400">JPEG, PNG, WebP or GIF</span>
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              pickImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {imageStep
              ? `Step ${imageStep.order}${imageStep.title ? ` (${imageStep.title})` : ""} looks at the image.`
              : "No step in this chain looks at images. Tick “Send the uploaded image” on a step to use one."}
          </p>
        </div>

        <button onClick={run} disabled={running} className={`${btnPrimary} h-11`}>
          {running ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Running…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" aria-hidden="true" />
              Run chain
            </>
          )}
        </button>
      </section>

      <section className="flex flex-col gap-4" aria-label="Run results" aria-live="polite">
        {timeline.length === 0 ? (
          <div className={`${card} flex flex-col items-center gap-2 px-6 py-14 text-center`}>
            <Play className="h-6 w-6 text-zinc-300 dark:text-zinc-600" aria-hidden="true" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Each step&apos;s output will appear here as it finishes.
            </p>
          </div>
        ) : (
          <ol className={`${card} divide-y divide-zinc-100 dark:divide-zinc-800`}>
            {timeline.map((step) => (
              <li key={step.order} className="flex gap-3 p-4">
                <StatusIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      Step {step.order}
                      {step.title ? `: ${step.title}` : ""}
                    </p>
                    {step.latencyMs !== undefined && (
                      <span className="text-xs tabular-nums text-zinc-400">{(step.latencyMs / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {step.status === "running" && <p className="mt-1 text-sm text-zinc-500">Thinking…</p>}
                  {step.output && (
                    <p
                      className={`mt-1.5 whitespace-pre-wrap text-sm ${
                        step.status === "failed" ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {step.output}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {failure && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {failure}
          </p>
        )}

        {result && (
          <div className={`${card} p-5`}>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
              {result.captions.length > 1 ? `${result.captions.length} captions` : "Caption"}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {result.captions.map((caption) => {
                const state = posted[caption];
                return (
                  <li
                    key={caption}
                    className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 sm:flex-row sm:items-center dark:border-zinc-800"
                  >
                    <p className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">&ldquo;{caption}&rdquo;</p>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => copy(caption)} className={btnGhost} aria-label="Copy caption">
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {state === "posted" ? (
                        <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-green-700 dark:text-green-400">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          Posted
                        </span>
                      ) : (
                        <button onClick={() => post(caption)} disabled={state === "posting"} className={btnGhost}>
                          <Send className="h-4 w-4" aria-hidden="true" />
                          {state === "posting" ? "Posting…" : "Post to CUmor"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/chains/${chainId}?tab=media`}
              className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              See everything this chain has generated →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  const base = "mt-0.5 h-5 w-5 shrink-0";
  if (status === "running") return <LoaderCircle className={`${base} animate-spin text-brand-600 dark:text-brand-400`} aria-label="Running" />;
  if (status === "done") return <CircleCheck className={`${base} text-green-600 dark:text-green-500`} aria-label="Done" />;
  if (status === "failed") return <CircleX className={`${base} text-red-600 dark:text-red-500`} aria-label="Failed" />;
  return <Clock className={`${base} text-zinc-300 dark:text-zinc-600`} aria-label="Waiting" />;
}
