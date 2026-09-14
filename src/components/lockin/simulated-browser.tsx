"use client";

import { useState } from "react";
import { Globe, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isAllowedWorkSite,
  matchBlocked,
  parseHost,
  QUICK_DISTS,
} from "@/lib/lockin";

type BrowserState =
  | { kind: "empty" }
  | { kind: "blocked"; query: string; name: string }
  | { kind: "allowed"; query: string; host: string }
  | { kind: "unknown"; query: string; host: string };

type SimulatedBrowserProps = {
  task: string;
  blockedCount: number;
  onBlockedAttempt: (site: string) => void;
};

export function SimulatedBrowser({
  task,
  blockedCount,
  onBlockedAttempt,
}: SimulatedBrowserProps) {
  const [draft, setDraft] = useState("");
  const [view, setView] = useState<BrowserState>({ kind: "empty" });

  function navigate(raw: string) {
    const query = raw.trim();
    if (!query) {
      setView({ kind: "empty" });
      return;
    }
    const blocked = matchBlocked(query);
    if (blocked) {
      onBlockedAttempt(blocked.name);
      setView({ kind: "blocked", query, name: blocked.name });
      return;
    }
    const host = parseHost(query) || query;
    if (isAllowedWorkSite(query)) {
      setView({ kind: "allowed", query, host });
      return;
    }
    setView({ kind: "unknown", query, host });
  }

  return (
    <section className="flex h-full min-h-[280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-500/70" />
        </div>
        <p className="flex-1 truncate font-mono text-[11px] text-zinc-500">
          LockIn Browser · distractions denied
        </p>
        <Badge variant="outline" className="font-mono text-[10px]">
          {blockedCount} blocked
        </Badge>
      </div>

      <form
        className="flex gap-2 border-b border-white/10 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(draft);
        }}
      >
        <Globe className="mt-1.5 size-4 shrink-0 text-zinc-500" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Open a site — try youtube.com"
          aria-label="Address bar"
          className="h-8 font-mono text-xs"
        />
        <Button type="submit" size="sm" variant="secondary">
          Go
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-2 py-2">
        {QUICK_DISTS.map((site) => (
          <Button
            key={site.url}
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setDraft(site.url);
              navigate(site.url);
            }}
          >
            {site.label}
          </Button>
        ))}
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => {
            setDraft("github.com");
            navigate("github.com");
          }}
        >
          GitHub
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {view.kind === "empty" ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 text-center">
            <p className="font-mono text-xs tracking-[0.18em] text-zinc-500 uppercase">
              New tab
            </p>
            <p className="mt-2 max-w-xs text-sm text-zinc-400">
              No feed. No For You. Type a URL if you must — YouTube, X,
              Instagram, and Reddit will refuse.
            </p>
          </div>
        ) : null}

        {view.kind === "blocked" ? (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center bg-red-950/40 px-6 py-8 text-center">
            <ShieldOff className="size-8 text-red-400" />
            <p className="mt-3 font-mono text-[11px] tracking-[0.22em] text-red-400 uppercase">
              This machine refused the request
            </p>
            <h2 className="mt-2 text-xl font-semibold text-red-100">
              {view.name} is locked out
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-red-100/70">
              <span className="font-mono text-red-200">{view.query}</span> is on
              the session denylist. The attempt is logged. Get back to{" "}
              <span className="text-red-50">{task}</span>.
            </p>
            <Button
              type="button"
              className="mt-5 bg-red-500 text-zinc-950 hover:bg-red-400"
              onClick={() => {
                setDraft("");
                setView({ kind: "empty" });
              }}
            >
              Back to work
            </Button>
          </div>
        ) : null}

        {view.kind === "allowed" ? (
          <div className="px-4 py-5">
            <p className="font-mono text-[11px] text-emerald-400/90 uppercase">
              Allowed work surface
            </p>
            <h2 className="mt-1 text-base font-medium text-zinc-100">
              {view.host}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              This host isn&apos;t on the denylist. It still isn&apos;t a
              license to wander. Stay on {task}.
            </p>
          </div>
        ) : null}

        {view.kind === "unknown" ? (
          <div className="px-4 py-5">
            <p className="font-mono text-[11px] text-zinc-500 uppercase">
              Unlisted host
            </p>
            <h2 className="mt-1 text-base font-medium text-zinc-100">
              {view.host}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Not a known distraction domain, so the demo lets it through. In a
              real LockIn install this machine would still prefer the task
              over the open web.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
