export type Chain = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Model = {
  id: number;
  name: string;
  model_identifier: string;
  is_active: boolean;
  llm_providers: { name: string } | null;
};

export type Step = {
  id: number;
  chain_id: number;
  step_order: number;
  title: string | null;
  include_image: boolean;
  llm_model_id: number;
  prompt_template: string;
};

export type MixEntry = { chain_id: number; weight: number; is_active: boolean };

// One NDJSON line from POST /api/chains/[id]/run.
export type RunStreamEvent =
  | { type: "start"; requestId: number; steps: { order: number; title: string | null }[] }
  | { type: "step"; order: number; ok: boolean; output: string; latencyMs: number }
  | { type: "done"; requestId: number; output: string; captions: string[]; imageUrl: string | null }
  | { type: "error"; message: string };
