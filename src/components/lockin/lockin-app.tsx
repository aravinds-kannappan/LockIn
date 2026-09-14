"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SAMPLE_TASKS, reviewExplanation } from "@/lib/lockin";

import { DoneDialog } from "./done-dialog";
import { EscapeDialog } from "./escape-dialog";
import { LockingScreen } from "./locking-screen";
import { RecapScreen, type Recap } from "./recap-screen";
import { SessionScreen } from "./session-screen";
import { SetupScreen } from "./setup-screen";

type Phase = "setup" | "locking" | "locked" | "recap";

const LOCK_MS = 1700;
const REVIEW_MS = 900;

export function LockInApp() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [task, setTask] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [blockedAttempts, setBlockedAttempts] = useState<string[]>([]);
  const [escapeAttempts, setEscapeAttempts] = useState(0);
  const [escapeOpen, setEscapeOpen] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);

  const elapsedMs = startedAt ? now - startedAt : 0;

  useEffect(() => {
    if (phase !== "locked") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const sealLock = useCallback((nextTask: string) => {
    setTask(nextTask);
    setNotes("");
    setBlockedAttempts([]);
    setEscapeAttempts(0);
    setExplanation("");
    setReviewError(null);
    setRecap(null);
    setPhase("locking");
    window.setTimeout(() => {
      setStartedAt(Date.now());
      setNow(Date.now());
      setPhase("locked");
    }, LOCK_MS);
  }, []);

  function handleLock() {
    const next = task.trim();
    if (!next) {
      setSetupError("Name the task first. A blank lock is just a screensaver.");
      return;
    }
    if (next.length < 8) {
      setSetupError("Too vague. Write a task someone else could grade.");
      return;
    }
    setSetupError(null);
    sealLock(next);
  }

  function handleSuggest() {
    setSuggesting(true);
    setSetupError(null);
    window.setTimeout(() => {
      const pick =
        SAMPLE_TASKS[Math.floor(Math.random() * SAMPLE_TASKS.length)];
      setTask(pick);
      setSuggesting(false);
    }, 800);
  }

  const openEscape = useCallback(() => {
    setEscapeAttempts((n) => n + 1);
    setEscapeOpen(true);
  }, []);

  useEffect(() => {
    if (phase !== "locked") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        openEscape();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [phase, openEscape]);

  function finish(abandoned: boolean, verdict: string, text: string) {
    const durationMs = startedAt ? Date.now() - startedAt : 0;
    setRecap({
      task,
      abandoned,
      durationMs,
      blockedAttempts: blockedAttempts.length,
      escapeAttempts,
      explanation: text,
      verdict,
    });
    setEscapeOpen(false);
    setDoneOpen(false);
    setReviewing(false);
    setStartedAt(null);
    setPhase("recap");
  }

  function handleSubmitDebrief() {
    setReviewing(true);
    setReviewError(null);
    window.setTimeout(() => {
      const result = reviewExplanation(task, explanation);
      if (!result.accepted) {
        setReviewError(result.message);
        setReviewing(false);
        return;
      }
      finish(false, result.message, explanation.trim());
    }, REVIEW_MS);
  }

  const body = useMemo(() => {
    if (phase === "setup") {
      return (
        <SetupScreen
          task={task}
          error={setupError}
          suggesting={suggesting}
          onTaskChange={(value) => {
            setTask(value);
            if (setupError) setSetupError(null);
          }}
          onLock={handleLock}
          onSuggest={handleSuggest}
          onPickSample={(sample) => {
            setTask(sample);
            setSetupError(null);
          }}
        />
      );
    }
    if (phase === "locking") {
      return <LockingScreen task={task} />;
    }
    if (phase === "recap" && recap) {
      return (
        <RecapScreen
          recap={recap}
          onReset={() => {
            setPhase("setup");
            setTask("");
            setNotes("");
            setRecap(null);
            setExplanation("");
            setReviewError(null);
          }}
        />
      );
    }
    return (
      <SessionScreen
        task={task}
        elapsedMs={elapsedMs}
        notes={notes}
        blockedCount={blockedAttempts.length}
        escapeAttempts={escapeAttempts}
        onNotesChange={setNotes}
        onBlockedAttempt={(site) =>
          setBlockedAttempts((list) => [...list, site])
        }
        onDone={() => {
          setReviewError(null);
          setDoneOpen(true);
        }}
        onBreakLock={openEscape}
      />
    );
    // handleLock / handleSuggest are stable enough for this demo tree
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    task,
    setupError,
    suggesting,
    recap,
    elapsedMs,
    notes,
    blockedAttempts.length,
    escapeAttempts,
    openEscape,
  ]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      {body}
      <EscapeDialog
        key={escapeAttempts}
        open={escapeOpen}
        attempts={escapeAttempts}
        onStay={() => setEscapeOpen(false)}
        onAbandon={() => finish(true, "Broken lock.", "")}
      />
      <DoneDialog
        open={doneOpen}
        task={task}
        explanation={explanation}
        reviewing={reviewing}
        error={reviewError}
        onExplanationChange={(value) => {
          setExplanation(value);
          if (reviewError) setReviewError(null);
        }}
        onCancel={() => {
          if (!reviewing) setDoneOpen(false);
        }}
        onSubmit={handleSubmitDebrief}
      />
    </div>
  );
}
