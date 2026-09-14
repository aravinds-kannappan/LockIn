"use client";

import { CheckCircle2, Unlock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "@/lib/lockin";

export type Recap = {
  task: string;
  abandoned: boolean;
  durationMs: number;
  blockedAttempts: number;
  escapeAttempts: number;
  explanation: string;
  verdict: string;
};

export function RecapScreen({
  recap,
  onReset,
}: {
  recap: Recap;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
        <span className="font-mono text-sm tracking-[0.18em] text-zinc-200 uppercase">
          LockIn
        </span>
        <Badge variant={recap.abandoned ? "destructive" : "default"}>
          {recap.abandoned ? "Broken lock" : "Session sealed"}
        </Badge>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-start gap-3">
          {recap.abandoned ? (
            <Unlock className="mt-0.5 size-6 text-red-400" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-6 text-amber-400" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
              {recap.abandoned
                ? "You broke the lock."
                : "Debrief accepted."}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {recap.abandoned
                ? "That's data, not a sermon. The machine is yours again — and the task is unfinished."
                : recap.verdict}
            </p>
          </div>
        </div>

        <Card className="bg-zinc-950/50">
          <CardHeader className="border-b">
            <CardTitle>Locked task</CardTitle>
            <CardDescription>{recap.task}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 pt-4">
            <Stat label="Time locked" value={formatDuration(recap.durationMs)} />
            <Stat
              label="Blocked sites"
              value={String(recap.blockedAttempts)}
            />
            <Stat
              label="Escape tries"
              value={String(recap.escapeAttempts)}
            />
          </CardContent>
          {recap.abandoned ? (
            <CardFooter>
              <p className="text-sm text-zinc-500">
                No debrief on file. You left before Warden could grade the
                work.
              </p>
            </CardFooter>
          ) : (
            <CardFooter className="flex-col items-start gap-1">
              <p className="text-xs tracking-wide text-zinc-500 uppercase">
                Your explanation
              </p>
              <p className="text-sm leading-6 text-zinc-200">
                {recap.explanation}
              </p>
            </CardFooter>
          )}
        </Card>

        {recap.blockedAttempts === 0 && !recap.abandoned ? (
          <p className="mt-4 text-sm text-zinc-500">
            Clean lock. You didn&apos;t even rattle the cage.
          </p>
        ) : null}

        <Button
          type="button"
          className="mt-8 h-10 bg-amber-500 text-zinc-950 hover:bg-amber-400"
          onClick={onReset}
        >
          New lock
        </Button>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-lg text-zinc-50">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}
