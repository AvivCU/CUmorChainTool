import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_superadmin")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_superadmin) {
          return NextResponse.redirect(`${origin}/`);
        }
      }

      return NextResponse.redirect(`${origin}/unauthorized`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
