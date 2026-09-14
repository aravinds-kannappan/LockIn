"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/lockin";

import { SimulatedBrowser } from "./simulated-browser";

type SessionScreenProps = {
  task: string;
  elapsedMs: number;
  notes: string;
  blockedCount: number;
  escapeAttempts: number;
  onNotesChange: (value: string) => void;
  onBlockedAttempt: (site: string) => void;
  onDone: () => void;
  onBreakLock: () => void;
};

export function SessionScreen({
  task,
  elapsedMs,
  notes,
  blockedCount,
  escapeAttempts,
  onNotesChange,
  onBlockedAttempt,
  onDone,
  onBreakLock,
}: SessionScreenProps) {
  const [pane, setPane] = useState<"desk" | "web">("desk");
  const notesEmpty = notes.trim().length === 0;

  return (
    <div className="lock-frame flex min-h-full flex-1 flex-col">
      <header className="flex flex-col gap-2 border-b border-amber-500/20 bg-zinc-950/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
          </span>
          <span className="font-mono text-[11px] tracking-[0.2em] text-red-400 uppercase">
            Computer locked
          </span>
          <Badge variant="outline" className="font-mono">
            {formatDuration(elapsedMs)}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="hidden font-mono text-[11px] text-zinc-500 sm:block">
            Esc = friction · {blockedCount} blocked · {escapeAttempts} escapes
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onBreakLock}>
            Break lock
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            onClick={onDone}
          >
            Done
          </Button>
        </div>
      </header>

      <div className="border-b border-white/10 bg-zinc-900/70 px-3 py-2 sm:px-4">
        <p className="flex items-start gap-2 text-sm text-zinc-100">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
          <span>
            <span className="mr-2 font-mono text-[10px] tracking-[0.16em] text-amber-500 uppercase">
              Task
            </span>
            {task}
          </span>
        </p>
      </div>

      <div className="flex gap-1 border-b border-white/10 px-3 py-2 lg:hidden">
        <Button
          type="button"
          size="sm"
          variant={pane === "desk" ? "secondary" : "ghost"}
          onClick={() => setPane("desk")}
        >
          Desk
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pane === "web" ? "secondary" : "ghost"}
          onClick={() => setPane("web")}
        >
          Browser
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-2 lg:overflow-hidden">
        <section
          className={`flex min-h-[240px] flex-col rounded-xl border border-white/10 bg-zinc-950 p-3 ${
            pane === "web" ? "hidden lg:flex" : "flex"
          }`}
        >
          <Label htmlFor="notes" className="mb-2">
            Session desk
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="This is the only writable surface. Outline the hiring brief, dump quotes, keep a checklist — just stay on the lock."
            className="min-h-0 flex-1 resize-none bg-zinc-900/40 font-mono text-[13px] leading-6"
          />
          {notesEmpty ? (
            <p className="mt-2 text-xs text-zinc-500">
              Desk is empty. That&apos;s fine for a minute — not for the whole
              lock.
            </p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              Notes stay on this machine for the session. They don&apos;t count
              as a debrief.
            </p>
          )}
        </section>

        <div className={pane === "desk" ? "hidden lg:block" : "block"}>
          <SimulatedBrowser
            task={task}
            blockedCount={blockedCount}
            onBlockedAttempt={onBlockedAttempt}
          />
        </div>
      </div>
    </div>
  );
}
