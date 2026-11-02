import { createClient } from "@/lib/supabase/server";
import MediaGrid, { MEDIA_FILTERS, type MediaRequest, type PostedCaption } from "@/components/media-grid";

export default async function MediaList({ chainId, source }: { chainId: number; source?: string }) {
  const filter = MEDIA_FILTERS.some((f) => f.id === source) ? source! : "all";
  const supabase = await createClient();

  let query = supabase
    .from("generation_requests")
    .select("id, user_id, prompt, output, image_url, source, created_at")
    .eq("chain_id", chainId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(60);
  if (filter !== "all") query = query.eq("source", filter);

  const { data, error } = await query;
  if (error) return <p className="text-sm text-red-600">Couldn&apos;t load media: {error.message}</p>;
  const requests = (data ?? []) as MediaRequest[];

  const ids = requests.map((r) => r.id);
  const userIds = [...new Set(requests.map((r) => r.user_id).filter((id): id is string => Boolean(id)))];

  const [posted, profiles] = await Promise.all([
    ids.length
      ? supabase.from("generations").select("id, request_id, caption, upvotes, downvotes").in("request_id", ids)
      : null,
    userIds.length ? supabase.from("profiles").select("id, first_name, last_name").in("id", userIds) : null,
  ]);

  const names = Object.fromEntries(
    (profiles?.data ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed user"])
  );

  return (
    <MediaGrid
      chainId={chainId}
      filter={filter}
      requests={requests}
      posted={(posted?.data ?? []) as PostedCaption[]}
      names={names}
    />
  );
}
