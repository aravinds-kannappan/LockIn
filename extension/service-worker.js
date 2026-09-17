const API = "http://127.0.0.1:18791";

const HOST_RULES = [
  { id: 1, host: "youtube.com", name: "YouTube" },
  { id: 2, host: "youtu.be", name: "YouTube" },
  { id: 3, host: "x.com", name: "X" },
  { id: 4, host: "twitter.com", name: "X" },
  { id: 5, host: "instagram.com", name: "Instagram" },
  { id: 6, host: "reddit.com", name: "Reddit" },
  { id: 7, host: "tiktok.com", name: "TikTok" },
  { id: 8, host: "facebook.com", name: "Facebook" },
  { id: 9, host: "netflix.com", name: "Netflix" },
  { id: 10, host: "twitch.tv", name: "Twitch" },
  { id: 11, host: "discord.com", name: "Discord" },
  { id: 12, host: "news.ycombinator.com", name: "Hacker News" },
];

let armed = false;

function blockUrl(site, host) {
  return `${API}/blocked?site=${encodeURIComponent(site)}&host=${encodeURIComponent(host)}`;
}

function rulesFor(extraHosts = []) {
  const rules = HOST_RULES.map((site) => ({
    id: site.id,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { url: blockUrl(site.name, site.host) },
    },
    condition: {
      urlFilter: `||${site.host}^`,
      resourceTypes: ["main_frame"],
    },
  }));
  extraHosts.forEach((host, index) => {
    if (!host || HOST_RULES.some((s) => s.host === host)) return;
    rules.push({
      id: 100 + index,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { url: blockUrl(host, host) },
      },
      condition: {
        urlFilter: `||${host}^`,
        resourceTypes: ["main_frame"],
      },
    });
  });
  return rules;
}

async function setArmed(next, extraHosts = []) {
  const rules = rulesFor(extraHosts);
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rules.map((r) => r.id).concat(HOST_RULES.map((s) => s.id), [100, 101, 102, 103, 104, 105]),
    addRules: next ? rules : [],
  });
  armed = next;
}

async function poll() {
  try {
    const res = await fetch(`${API}/state`, { cache: "no-store" });
    if (!res.ok) {
      if (armed) await setArmed(false);
      return;
    }
    const state = await res.json();
    const shouldArm = Boolean(state.locked);
    if (shouldArm !== armed) {
      await setArmed(shouldArm, state.extraHosts || []);
    }
  } catch {
    if (armed) await setArmed(false);
  }
}

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (!armed || !changeInfo.url || !tab?.url) return;
  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");
    const hit = HOST_RULES.find((s) => host === s.host || host.endsWith(`.${s.host}`));
    if (!hit) return;
    await fetch(`${API}/blocked`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: tab.url, host: hit.host, name: hit.name }),
    });
  } catch {
    // ignore
  }
});

setInterval(poll, 1000);
poll();
