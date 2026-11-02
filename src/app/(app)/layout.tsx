import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth";
import BrandMark from "@/components/brand-mark";
import ThemeToggle from "@/components/theme-toggle";
import SignOutButton from "@/components/sign-out-button";
import { FeedbackProvider } from "@/components/feedback";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { displayName } = await requireSuperadmin();

  return (
    <FeedbackProvider>
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              CUmor <span className="text-brand-700 dark:text-brand-300">Chain Tool</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-sm text-zinc-500 md:inline dark:text-zinc-400">
              {displayName}
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </FeedbackProvider>
  );
}
