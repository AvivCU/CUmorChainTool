"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";

type Tone = "success" | "error" | "info";

type Toast = { id: number; tone: Tone; message: string };

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

type FeedbackApi = {
  toast: (message: string, tone?: Tone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const api = useContext(FeedbackContext);
  if (!api) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return api;
}

const TOAST_STYLES: Record<Tone, { Icon: typeof Info; className: string }> = {
  success: {
    Icon: CircleCheck,
    className: "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100",
  },
  error: {
    Icon: CircleAlert,
    className: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100",
  },
  info: {
    Icon: Info,
    className: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100",
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    },
    [dismiss]
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    []
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        pending.resolve(false);
        setPending(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map(({ id, tone, message }) => {
          const { Icon, className } = TOAST_STYLES[tone];
          return (
            <div
              key={id}
              role={tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg [animation:toast-in_160ms_ease-out] ${className}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{message}</p>
              <button
                onClick={() => dismiss(id)}
                aria-label="Dismiss"
                className="rounded p-0.5 opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={pending.body ? "confirm-body" : undefined}
            className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex gap-3">
              {pending.destructive && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                  <TriangleAlert className="h-5 w-5" aria-hidden="true" />
                </span>
              )}
              <div>
                <h2 id="confirm-title" className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {pending.title}
                </h2>
                {pending.body && (
                  <p id="confirm-body" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {pending.body}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => close(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                ref={confirmButton}
                onClick={() => close(true)}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
                  pending.destructive
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-brand-700 hover:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400"
                }`}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}
