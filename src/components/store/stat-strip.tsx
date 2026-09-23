/** Bordered 3-up facts strip (about + delivery pages). */
export function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  if (!stats.length) return null;
  return (
    <dl className="mx-4 mt-[clamp(24px,5vw,56px)] mb-0 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-6 border-y border-rule px-1.5 pt-[clamp(20px,3.5vw,32px)] pb-[clamp(28px,4.5vw,48px)]">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="mb-2 font-mono text-[10px] font-semibold tracking-[0.24em] text-caption uppercase">{s.label}</dt>
          <dd className="m-0 text-[clamp(20px,2.6vw,28px)] font-bold tracking-[-0.03em]">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
