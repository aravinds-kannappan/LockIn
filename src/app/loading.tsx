export default function Loading() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-zinc-950 px-6">
      <p className="font-mono text-[11px] tracking-[0.28em] text-amber-500 uppercase">
        Booting LockIn
      </p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-1/2 animate-pulse bg-amber-500" />
      </div>
      <p className="mt-4 text-sm text-zinc-500">Sealing the machine…</p>
    </div>
  );
}
