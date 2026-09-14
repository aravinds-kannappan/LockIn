"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-zinc-950 px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.22em] text-red-400 uppercase">
        Session fault
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-zinc-50">
        LockIn couldn&apos;t keep the machine sealed.
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
        {error.message || "Something broke while locking or reviewing."} Reload
        and start the task again — the lock does not survive a crash.
      </p>
      <Button
        type="button"
        className="mt-6 bg-amber-500 text-zinc-950 hover:bg-amber-400"
        onClick={() => reset()}
      >
        Try again
      </Button>
    </div>
  );
}
