import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import { card } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function UnauthorizedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className={`${card} w-full max-w-sm p-8 text-center`}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Access denied</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {user?.email ? `${user.email} is` : "Your account is"} signed in, but doesn&apos;t have
          superadmin access to the Chain Tool.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            Try a different account
          </Link>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
