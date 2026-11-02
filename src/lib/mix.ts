import type { MixEntry } from "./types";

// Percent of CUmor caption requests that go to this chain right now.
export function liveShare(mix: MixEntry[], chainId: number): number {
  const total = mix.filter((m) => m.is_active).reduce((sum, m) => sum + Number(m.weight), 0);
  const entry = mix.find((m) => m.chain_id === chainId);
  if (!entry?.is_active || total <= 0) return 0;
  return Math.round((Number(entry.weight) / total) * 100);
}
