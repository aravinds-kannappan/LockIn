"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HOLD_SECONDS = 5;
const CONFIRM_PHRASE = "I QUIT";

type EscapeDialogProps = {
  open: boolean;
  attempts: number;
  onStay: () => void;
  onAbandon: () => void;
};

export function EscapeDialog({
  open,
  attempts,
  onStay,
  onAbandon,
}: EscapeDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phrase, setPhrase] = useState("");
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(HOLD_SECONDS);

  useEffect(() => {
    if (!open || step !== 2) return;
    const id = window.setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setStep(3);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, step]);

  function handlePhrase() {
    if (phrase.trim().toUpperCase() !== CONFIRM_PHRASE) {
      setPhraseError(`Type ${CONFIRM_PHRASE} exactly. No shortcuts.`);
      return;
    }
    setPhraseError(null);
    setRemaining(HOLD_SECONDS);
    setStep(2);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border border-red-500/30 bg-zinc-950 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-red-100">Break the lock?</DialogTitle>
          <DialogDescription>
            Escape is logged. This is attempt {attempts}. Quitting voids the
            session — there is no debrief, no credit.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-2">
            <Label htmlFor="quit-phrase">
              Type {CONFIRM_PHRASE} to keep going
            </Label>
            <Input
              id="quit-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              aria-invalid={Boolean(phraseError)}
              autoComplete="off"
              className="font-mono"
            />
            {phraseError ? (
              <p className="text-xs text-red-400">{phraseError}</p>
            ) : (
              <p className="text-xs text-zinc-500">
                One-click quit is how you end up on YouTube.
              </p>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-4 text-center">
            <p className="font-mono text-3xl text-amber-400">{remaining}</p>
            <p className="mt-2 text-sm text-zinc-400">
              Sit with it. The task is still waiting.
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <p className="text-sm leading-6 text-zinc-300">
            Last chance. Abandoning wipes the lock and marks this session as
            broken. Stay if you still owe the task a real ending.
          </p>
        ) : null}

        <DialogFooter className="border-red-500/10 bg-transparent">
          <Button type="button" variant="outline" onClick={onStay}>
            Stay locked
          </Button>
          {step === 1 ? (
            <Button type="button" variant="destructive" onClick={handlePhrase}>
              Continue
            </Button>
          ) : null}
          {step === 3 ? (
            <Button type="button" variant="destructive" onClick={onAbandon}>
              Abandon session
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
