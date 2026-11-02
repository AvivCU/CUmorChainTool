"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { btnGhost } from "@/lib/ui";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button onClick={handleSignOut} className={btnGhost}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
