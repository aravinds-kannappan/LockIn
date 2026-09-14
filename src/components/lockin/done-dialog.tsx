"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type DoneDialogProps = {
  open: boolean;
  task: string;
  explanation: string;
  reviewing: boolean;
  error: string | null;
  onExplanationChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

export function DoneDialog({
  open,
  task,
  explanation,
  reviewing,
  error,
  onExplanationChange,
  onCancel,
  onSubmit,
}: DoneDialogProps) {
  const empty = explanation.trim().length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !reviewing) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border border-white/10 bg-zinc-950 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Debrief required</DialogTitle>
          <DialogDescription>
            You don&apos;t get to click Done and walk. Write what you did on{" "}
            <span className="text-zinc-200">{task}</span>. Warden will reject a
            fake.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="debrief">What did you do?</Label>
            <Textarea
              id="debrief"
              value={explanation}
              onChange={(e) => onExplanationChange(e.target.value)}
              disabled={reviewing}
              aria-invalid={Boolean(error)}
              placeholder="I outlined the hiring brief: role scope, must-have backend skills, interview loop, and a first draft of the posting."
              className="min-h-32 resize-none"
            />
            {empty && !error ? (
              <p className="text-xs text-zinc-500">
                Empty debrief. The agent will not accept a blank.
              </p>
            ) : (
              <p className="text-xs text-zinc-500">
                Mention the actual task. “I did the work” is an automatic no.
              </p>
            )}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Warden rejected this</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {reviewing ? (
            <p className="font-mono text-xs text-amber-400">
              Reviewing your debrief against the locked task…
            </p>
          ) : null}

          <DialogFooter className="bg-transparent px-0 pb-0">
            <Button
              type="button"
              variant="outline"
              disabled={reviewing}
              onClick={onCancel}
            >
              Keep working
            </Button>
            <Button
              type="submit"
              disabled={reviewing}
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              {reviewing ? "Judging…" : "Submit debrief"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
