export const SAMPLE_TASKS = [
  "Draft the Q3 hiring brief for the senior backend role",
  "Write the first 800 words of the LockIn landing page",
  "Study 20 Anki cards on OS internals and summarize misses",
] as const;

export const BLOCKED_SITES = [
  { host: "youtube.com", name: "YouTube", aliases: ["youtu.be"] },
  { host: "x.com", name: "X", aliases: ["twitter.com", "t.co"] },
  { host: "instagram.com", name: "Instagram", aliases: [] },
  { host: "reddit.com", name: "Reddit", aliases: ["old.reddit.com"] },
  { host: "tiktok.com", name: "TikTok", aliases: [] },
  { host: "facebook.com", name: "Facebook", aliases: ["fb.com"] },
  { host: "netflix.com", name: "Netflix", aliases: [] },
  { host: "twitch.tv", name: "Twitch", aliases: [] },
  { host: "discord.com", name: "Discord", aliases: ["discord.gg"] },
  { host: "news.ycombinator.com", name: "Hacker News", aliases: [] },
] as const;

export const QUICK_DISTS = [
  { label: "YouTube", url: "youtube.com" },
  { label: "X", url: "x.com" },
  { label: "Instagram", url: "instagram.com" },
  { label: "Reddit", url: "reddit.com" },
] as const;

export const ALLOWED_WORK_HOSTS = [
  "github.com",
  "docs.google.com",
  "notion.so",
  "stackoverflow.com",
  "developer.mozilla.org",
];

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

export type BlockedMatch = {
  host: string;
  name: string;
};

export function parseHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.split("?")[0] ?? "";
  return host.replace(/^www\./, "");
}

export function matchBlocked(raw: string): BlockedMatch | null {
  const host = parseHost(raw);
  if (!host) return null;
  for (const site of BLOCKED_SITES) {
    const names = [site.host, ...site.aliases];
    if (names.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { host: site.host, name: site.name };
    }
  }
  return null;
}

export function isAllowedWorkSite(raw: string): boolean {
  const host = parseHost(raw);
  return ALLOWED_WORK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

export type ReviewResult = {
  accepted: boolean;
  message: string;
};

export function reviewExplanation(task: string, explanation: string): ReviewResult {
  const trimmed = explanation.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (!trimmed) {
    return {
      accepted: false,
      message:
        "Blank debrief. Write what you actually produced — the artifact, the steps, the outcome.",
    };
  }

  if (trimmed.length < 48 || words.length < 10) {
    return {
      accepted: false,
      message:
        "That's a shrug, not a debrief. Give at least a couple of sentences about the locked task.",
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
