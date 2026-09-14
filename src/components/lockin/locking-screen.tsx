"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Killing notification channels",
  "Binding the browser to the lock list",
  "Sealing escape behind friction",
  "Handing the machine to one task",
];

export function LockingScreen({ task }: { task: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 420);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6">
      <p className="font-mono text-[11px] tracking-[0.28em] text-amber-500 uppercase">
        Sealing session
      </p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full w-2/3 animate-pulse bg-amber-500" />
      </div>
      <p className="mt-6 max-w-md text-center font-mono text-sm text-zinc-200">
        {STEPS[step]}
      </p>
      <p className="mt-8 max-w-lg text-center text-sm text-zinc-500">
        Locked task: <span className="text-zinc-300">{task}</span>
      </p>
    </div>
  );
}
