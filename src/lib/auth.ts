import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every page and route in this app is superadmin-only; RLS enforces the
// same rule again in the database.
export async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_superadmin) redirect("/unauthorized");

  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email || "Admin";

  return { supabase, user, displayName };
}
