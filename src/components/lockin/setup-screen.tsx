"use client";

import { Sparkles, Lock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_TASKS } from "@/lib/lockin";

type SetupScreenProps = {
  task: string;
  error: string | null;
  suggesting: boolean;
  onTaskChange: (value: string) => void;
  onLock: () => void;
  onSuggest: () => void;
  onPickSample: (task: string) => void;
};

export function SetupScreen({
  task,
  error,
  suggesting,
  onTaskChange,
  onLock,
  onSuggest,
  onPickSample,
}: SetupScreenProps) {
  const empty = task.trim().length === 0;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
            <Lock className="size-3.5" />
          </span>
          <span className="font-mono text-sm tracking-[0.18em] text-zinc-200 uppercase">
            LockIn
          </span>
        </div>
        <p className="hidden text-xs text-zinc-500 sm:block">
          Not a polite blocker. A lock.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-amber-500/90 uppercase">
          Name the one thing
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          This machine will only do this task.
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-6 text-zinc-400 sm:text-[15px]">
          Write the lock. Social sites refuse to open. Quitting takes work. When
          you&apos;re done, you debrief — and the agent decides if you actually
          did the thing.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onLock();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="task">Focus task</Label>
            <Textarea
              id="task"
              value={task}
              onChange={(e) => onTaskChange(e.target.value)}
              aria-invalid={Boolean(error)}
              placeholder="Draft the Q3 hiring brief for the senior backend role"
              className="min-h-24 resize-none bg-zinc-950/60 text-base md:text-[15px]"
            />
            {empty ? (
              <p className="text-xs text-zinc-500">
                Empty lock. Pick a sample or let the agent choose — you
                can&apos;t seal a blank session.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                One sentence. Specific enough that a stranger could grade you.
              </p>
            )}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Can&apos;t seal this</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              size="lg"
              className="h-10 flex-1 bg-amber-500 text-zinc-950 hover:bg-amber-400"
              onClick={onLock}
            >
              <Lock data-icon="inline-start" />
              Lock this machine
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-10 flex-1"
              disabled={suggesting}
              onClick={onSuggest}
            >
              <Sparkles data-icon="inline-start" />
              {suggesting ? "Warden is choosing…" : "Let the agent pick"}
            </Button>
          </div>
        </form>

        <div className="mt-10">
          <p className="mb-2 font-mono text-[11px] tracking-[0.18em] text-zinc-500 uppercase">
            Sample locks
          </p>
          <ul className="space-y-2">
            {SAMPLE_TASKS.map((sample) => (
              <li key={sample}>
                <button
                  type="button"
                  onClick={() => onPickSample(sample)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-950/40 px-3 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:border-amber-500/40 hover:bg-zinc-900 hover:text-zinc-50"
                >
                  {sample}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
