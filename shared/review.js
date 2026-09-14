"use strict";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "of",
  "to",
  "and",
  "or",
  "in",
  "on",
  "at",
  "with",
  "from",
  "this",
  "that",
  "into",
  "your",
  "you",
  "will",
  "first",
  "page",
]);

function keywords(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function reviewExplanation(task, explanation, options = {}) {
  const trimmed = String(explanation || "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const minWords = options.strict ? 16 : 10;
  const minChars = options.strict ? 80 : 48;

  if (!trimmed) {
    return {
      accepted: false,
      message:
        "Blank debrief. Write what you actually produced — the artifact, the steps, the outcome.",
    };
  }

  if (trimmed.length < minChars || words.length < minWords) {
    return {
      accepted: false,
      message: options.strict
        ? "Last lock was sloppy. This debrief needs more: what you made, how, and what's left."
        : "That's a shrug, not a debrief. Give at least a couple of sentences about the locked task.",
    };
  }

  const generic =
    /^(i (did|finished|completed|worked on) (it|the (work|task)|everything)|done|finished|worked on it)[.!]?$/i;
  if (generic.test(trimmed)) {
    return {
      accepted: false,
      message: "Too thin. Name the artifact, the steps, or what you produced.",
    };
  }

  const taskKw = keywords(task);
  if (taskKw.length === 0) {
    return {
      accepted: true,
      message: "Accepted. The debrief is specific enough for this lock.",
    };
  }

  const hay = trimmed.toLowerCase();
  const hits = taskKw.filter((k) => hay.includes(k));
  if (hits.length === 0) {
    return {
      accepted: false,
      message: `This doesn't mention the locked task. Talk about “${task}” specifically — not a neighboring chore.`,
    };
  }

  return {
    accepted: true,
    message: "Accepted. The debrief matches the lock.",
  };
}

module.exports = { keywords, reviewExplanation };
