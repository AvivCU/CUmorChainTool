"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import BrandMark from "@/components/brand-mark";
import ThemeToggle from "@/components/theme-toggle";
import { btnPrimary, card } from "@/lib/ui";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className={`${card} w-full max-w-sm p-8 text-center`}>
        <div className="flex justify-center">
          <BrandMark size="lg" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          CUmor Chain Tool
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Build and test the prompt chains that write CUmor&apos;s captions. Superadmins only.
        </p>
        <button onClick={handleGoogleLogin} disabled={isLoading} className={`${btnPrimary} mt-6 h-11 w-full`}>
          {isLoading ? "Redirecting…" : "Continue with Google"}
        </button>
        {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
      </div>
    </main>
  );
}
