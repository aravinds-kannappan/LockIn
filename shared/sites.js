"use strict";

const BLOCKED_SITES = [
  { host: "youtube.com", name: "YouTube", aliases: ["youtu.be", "youtube-nocookie.com"] },
  { host: "x.com", name: "X", aliases: ["twitter.com", "t.co"] },
  { host: "instagram.com", name: "Instagram", aliases: [] },
  { host: "reddit.com", name: "Reddit", aliases: ["old.reddit.com"] },
  { host: "tiktok.com", name: "TikTok", aliases: [] },
  { host: "facebook.com", name: "Facebook", aliases: ["fb.com"] },
  { host: "netflix.com", name: "Netflix", aliases: [] },
  { host: "twitch.tv", name: "Twitch", aliases: [] },
  { host: "discord.com", name: "Discord", aliases: ["discord.gg"] },
  { host: "news.ycombinator.com", name: "Hacker News", aliases: [] },
];

const SAMPLE_TASKS = [
  "Draft the Q3 hiring brief for the senior backend role",
  "Write the first 800 words of the LockIn landing page",
  "Study 20 Anki cards on OS internals and summarize misses",
];

function parseHost(raw) {
  const trimmed = String(raw || "").trim().toLowerCase();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).hostname.replace(/^www\./, "");
    }
  } catch {
    // fall through
  }
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, "");
  const host = withoutProtocol.split("/")[0]?.split("?")[0] ?? "";
  return host.replace(/^www\./, "").replace(/\.$/, "");
}

function allHostsFor(site) {
  return [site.host, ...site.aliases];
}

function hostMatches(host, candidate) {
  return host === candidate || host.endsWith(`.${candidate}`);
}

function matchBlocked(raw, extraHosts = []) {
  const host = parseHost(raw);
  if (!host) return null;
  for (const site of BLOCKED_SITES) {
    if (allHostsFor(site).some((h) => hostMatches(host, h))) {
      return { host: site.host, name: site.name };
    }
  }
  for (const extra of extraHosts) {
    const extraHost = parseHost(extra);
    if (extraHost && hostMatches(host, extraHost)) {
      return { host: extraHost, name: extraHost };
    }
  }
  return null;
}

function isBlockedHost(host, extraHosts = []) {
  return Boolean(matchBlocked(host, extraHosts));
}

function pacHostList(extraHosts = []) {
  const hosts = new Set();
  for (const site of BLOCKED_SITES) {
    for (const h of allHostsFor(site)) hosts.add(h);
  }
  for (const extra of extraHosts) {
    const h = parseHost(extra);
    if (h) hosts.add(h);
  }
  return [...hosts];
}

function dnrFilters(extraHosts = []) {
  return pacHostList(extraHosts).flatMap((host) => [
    `||${host}^`,
    `||www.${host}^`,
  ]);
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

module.exports = {
  BLOCKED_SITES,
  SAMPLE_TASKS,
  parseHost,
  matchBlocked,
  isBlockedHost,
  pacHostList,
  dnrFilters,
  formatDuration,
};
