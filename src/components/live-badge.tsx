// Whether CUmor's public generate page currently uses this chain.
export default function LiveBadge({ share }: { share: number }) {
  return share > 0 ? (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200"
      title="Share of CUmor caption requests that use this chain"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-400" aria-hidden="true" />
      Live in CUmor · {share}%
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      title="Turn it on in the admin panel's Chain mix page"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" aria-hidden="true" />
      Not live
    </span>
  );
}
