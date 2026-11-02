import { createClient } from "@/lib/supabase/server";
import { runPromptChain, splitCaptions, type ChainImage } from "@/lib/prompt-chain";
import type { RunStreamEvent } from "@/lib/types";

export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return jsonError("Unknown chain.", 404);
  const chainId = Number(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Sign in first.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_superadmin) return jsonError("Superadmins only.", 403);

  if (!process.env.GEMINI_API_KEY) return jsonError("Server is missing GEMINI_API_KEY.", 500);

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Send the run as form data.", 400);

  const input = String(form.get("input") ?? "").trim().slice(0, 2000);
  const file = form.get("image");
  const hasImage = file instanceof File && file.size > 0;

  if (!input && !hasImage) return jsonError("Type a prompt or attach an image.", 400);

  let image: ChainImage | null = null;
  let imageUrl: string | null = null;

  if (hasImage) {
    if (!IMAGE_TYPES.has(file.type)) return jsonError("Images must be JPEG, PNG, WebP or GIF.", 400);
    if (file.size > MAX_IMAGE_BYTES) return jsonError("Images must be 4 MB or smaller.", 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    image = { mimeType: file.type, base64: bytes.toString("base64") };

    const extension = file.type.split("/")[1].replace("jpeg", "jpg");
    const path = `${user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("chain-inputs")
      .upload(path, bytes, { contentType: file.type });
    if (uploadError) return jsonError(`Couldn't store the image: ${uploadError.message}`, 500);
    imageUrl = supabase.storage.from("chain-inputs").getPublicUrl(path).data.publicUrl;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RunStreamEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        const result = await runPromptChain(supabase, user.id, input, {
          chainId,
          image,
          imageUrl,
          source: "tool",
          completeOnSuccess: true,
          onEvent: (event) => {
            if (event.type === "start") send({ type: "start", requestId: event.requestId, steps: event.steps });
            else send(event);
          },
        });

        if (result.ok) {
          send({
            type: "done",
            requestId: result.requestId,
            output: result.output,
            captions: splitCaptions(result.output),
            imageUrl,
          });
        } else {
          send({ type: "error", message: result.error });
        }
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "The run crashed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
