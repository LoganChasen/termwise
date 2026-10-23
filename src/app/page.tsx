export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Termwise</h1>
      <p className="mt-2 text-ink-2">Your whole semester in one place. Under construction.</p>
      <div className="mt-8 flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="size-5 rounded-[4px]" style={{ background: `var(--heat-${n})` }} />
        ))}
      </div>
    </main>
  );
}
