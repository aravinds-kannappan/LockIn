const LOCKING_STEPS = [
  "Arming site blockers",
  "Watching Chrome & Safari",
  "You're locked in",
];

const state = {
  phase: "setup",
  task: "",
  notes: "",
  greeting: { headline: "LockIn", body: "", suggestedTask: "" },
  sampleTasks: [],
  loginItemEnabled: true,
  blockedEvents: [],
  elapsedMs: 0,
  blockedAttempts: 0,
  checklist: [],
  checklistDone: 0,
  recap: null,
  pacEnabled: false,
  stats: {},
};

let setupTask = "";
let setupError = null;
let suggesting = false;
let endingOpen = false;
let endNote = "";
let newItemText = "";
let lockStep = 0;
let lockStepTimer = null;
let clockTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function render() {
  const root = document.getElementById("app");
  if (state.phase === "locking") root.innerHTML = lockingView();
  else if (state.phase === "locked") root.innerHTML = lockedView();
  else if (state.phase === "recap") root.innerHTML = recapView();
  else root.innerHTML = setupView();
  if (endingOpen) root.insertAdjacentHTML("beforeend", endModal());
  bind();
}

function setupView() {
  const g = state.greeting || {};
  const hasHistory = (state.stats?.sessions || 0) > 0;
  return `
    <div class="agent">
      <div class="drag-region"></div>
      <div class="agent-header">
        <div class="agent-icon">L</div>
        <div>
          <div class="agent-name">LockIn</div>
          <div class="agent-sub">Focus agent</div>
        </div>
      </div>
      <div class="agent-body">
        <div class="greeting">
          <p class="greeting-headline">${escapeHtml(g.headline || "Ready to lock in.")}</p>
          ${g.body ? `<p class="greeting-body">${escapeHtml(g.body)}</p>` : ""}
        </div>
        <form id="lock-form">
          <label for="task">What are you working on?</label>
          <textarea id="task" rows="3" placeholder="e.g. Finish the API docs for the auth endpoint">${escapeHtml(setupTask)}</textarea>
          ${setupError ? `<div class="error-msg">${escapeHtml(setupError)}</div>` : ""}
          <div class="btn-row">
            <button class="btn primary" type="submit">Lock In</button>
            <button class="btn ghost" type="button" id="suggest">${suggesting ? "…" : "Suggest"}</button>
          </div>
        </form>
        ${
          state.sampleTasks?.length
            ? `
          <div class="samples">
            <p class="section-label">Try one of these</p>
            ${state.sampleTasks
              .map(
                (t) =>
                  `<button class="sample-btn" type="button" data-sample="${escapeHtml(t)}">${escapeHtml(t)}</button>`,
              )
              .join("")}
          </div>
        `
            : ""
        }
        ${
          hasHistory
            ? `
          <div class="stats-row">
            <div class="stat"><span class="stat-num">${state.stats.sessions}</span> sessions</div>
            <div class="stat"><span class="stat-num">${state.stats.completed}</span> completed</div>
            <div class="stat"><span class="stat-num">${state.stats.totalBlocks}</span> blocks</div>
          </div>
        `
            : ""
        }
        <label class="toggle-row">
          <input type="checkbox" id="login-item" ${state.loginItemEnabled ? "checked" : ""} />
          <span>Open at login</span>
        </label>
        <p class="shortcut-hint">⌘⇧L to summon · <code>lockin://start</code> for Siri Shortcuts</p>
      </div>
    </div>`;
}

function lockingView() {
  return `
    <div class="agent">
      <div class="drag-region"></div>
      <div class="agent-body" style="display:flex;align-items:center;justify-content:center;min-height:300px">
        <div style="text-align:center">
          <div class="pulse-ring"></div>
          <p class="locking-text">${escapeHtml(LOCKING_STEPS[lockStep] || LOCKING_STEPS.at(-1))}</p>
          <p class="locking-task">${escapeHtml(state.task)}</p>
        </div>
      </div>
    </div>`;
}

function lockedView() {
  const items = state.checklist || [];
  const done = items.filter((t) => t.done).length;
  const events = (state.blockedEvents || []).slice().reverse();
  return `
    <div class="agent">
      <div class="drag-region"></div>
      <div class="locked-header">
        <div class="locked-dot"></div>
        <span class="locked-label">Locked in</span>
        <span class="locked-timer">${formatDuration(state.elapsedMs)}</span>
      </div>
      <div class="locked-task">${escapeHtml(state.task)}</div>
      <div class="agent-body">
        <div class="checklist-section">
          <p class="section-label">Checklist ${items.length ? `<span class="count-badge">${done}/${items.length}</span>` : ""}</p>
          <div class="checklist">
            ${items
              .map(
                (t) => `
              <div class="checklist-item ${t.done ? "is-done" : ""}" data-id="${escapeHtml(t.id)}">
                <button class="check-btn" data-toggle="${escapeHtml(t.id)}">${t.done ? "✓" : ""}</button>
                <span class="check-text">${escapeHtml(t.text)}</span>
                <button class="remove-btn" data-remove="${escapeHtml(t.id)}">×</button>
              </div>`,
              )
              .join("")}
          </div>
          <form class="add-item-form" id="add-item-form">
            <input type="text" id="new-item" placeholder="Add a task…" value="${escapeHtml(newItemText)}" autocomplete="off" />
            <button class="btn add-btn" type="submit">+</button>
          </form>
        </div>
        ${
          events.length
            ? `<div class="blocked-section-mini">
                <p class="section-label">Blocked <span class="count-badge">${state.blockedAttempts}</span></p>
                <div class="blocked-feed-mini">
                  ${events
                    .slice(0, 3)
                    .map(
                      (e) =>
                        `<span class="blocked-tag">${escapeHtml(e.name || e.host)}</span>`,
                    )
                    .join("")}
                  ${events.length > 3 ? `<span class="blocked-tag muted">+${events.length - 3} more</span>` : ""}
                </div>
              </div>`
            : ""
        }
        <button class="btn end-btn" id="end-session">End Session</button>
      </div>
    </div>`;
}

function recapView() {
  const recap = state.recap || {};
  const tasks = recap.checklist || [];
  const hasTasks = tasks.length > 0;
  return `
    <div class="agent">
      <div class="drag-region"></div>
      <div class="agent-header">
        <div class="agent-icon ${recap.abandoned ? "icon-warn" : "icon-done"}">
          ${recap.abandoned ? "—" : "✓"}
        </div>
        <div>
          <div class="agent-name">${recap.abandoned ? "Session ended" : "Nice work"}</div>
          <div class="agent-sub">${escapeHtml(recap.task || "")}</div>
        </div>
      </div>
      <div class="agent-body">
        <div class="recap-stats">
          <div class="recap-stat">
            <div class="recap-num">${formatDuration(recap.durationMs || 0)}</div>
            <div class="recap-label">Time</div>
          </div>
          ${hasTasks ? `
            <div class="recap-stat">
              <div class="recap-num">${recap.checklistDone || 0}/${recap.checklistTotal || 0}</div>
              <div class="recap-label">Tasks</div>
            </div>
          ` : ""}
          <div class="recap-stat">
            <div class="recap-num">${recap.blockedAttempts || 0}</div>
            <div class="recap-label">Blocked</div>
          </div>
        </div>
        ${hasTasks ? `
          <div class="recap-checklist">
            <p class="section-label">Checklist</p>
            ${tasks.map((t) => `
              <div class="recap-task ${t.done ? "is-done" : ""}">
                <span class="recap-check">${t.done ? "✓" : "–"}</span>
                <span>${escapeHtml(t.text)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${recap.explanation ? `<div class="recap-note"><p class="section-label">Your note</p><p>${escapeHtml(recap.explanation)}</p></div>` : ""}
        <button class="btn primary" id="new-session" style="width:100%">New Session</button>
      </div>
    </div>`;
}

function endModal() {
  return `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <p class="modal-title">End session?</p>
        <label for="end-note">Quick note (optional)</label>
        <textarea id="end-note" rows="3" placeholder="What did you get done?">${escapeHtml(endNote)}</textarea>
        <div class="btn-row">
          <button class="btn ghost" id="keep-going">Keep going</button>
          <button class="btn primary" id="confirm-end">End</button>
        </div>
      </div>
    </div>`;
}

function bind() {
  const task = document.getElementById("task");
  if (task) {
    task.addEventListener("input", (e) => {
      setupTask = e.target.value;
      if (setupError) {
        setupError = null;
        render();
        document.getElementById("task")?.focus();
      }
    });
  }

  document.getElementById("lock-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const result = await window.lockin.lock(setupTask);
    if (!result?.ok) {
      setupError = result?.error || "Could not start.";
      render();
    }
  });

  document.getElementById("suggest")?.addEventListener("click", async () => {
    suggesting = true;
    render();
    const pick = await window.lockin.suggest();
    setupTask = pick || state.suggestedTask || setupTask;
    suggesting = false;
    render();
  });

  document.querySelectorAll("[data-sample]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setupTask = btn.getAttribute("data-sample") || "";
      setupError = null;
      render();
    });
  });

  document.getElementById("login-item")?.addEventListener("change", async (e) => {
    await window.lockin.setLoginItem(e.target.checked);
  });

  document.getElementById("add-item-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("new-item");
    const text = input?.value || newItemText;
    if (text.trim()) {
      await window.lockin.addChecklistItem(text.trim());
      newItemText = "";
    }
  });

  document.getElementById("new-item")?.addEventListener("input", (e) => {
    newItemText = e.target.value;
  });

  document.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.lockin.toggleChecklistItem(btn.getAttribute("data-toggle"));
    });
  });

  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await window.lockin.removeChecklistItem(btn.getAttribute("data-remove"));
    });
  });

  document.getElementById("end-session")?.addEventListener("click", () => {
    endingOpen = true;
    endNote = "";
    render();
  });

  document.getElementById("keep-going")?.addEventListener("click", () => {
    endingOpen = false;
    render();
  });

  document.getElementById("confirm-end")?.addEventListener("click", async () => {
    endNote = document.getElementById("end-note")?.value || endNote;
    endingOpen = false;
    await window.lockin.endSession(endNote);
  });

  document.getElementById("end-note")?.addEventListener("input", (e) => {
    endNote = e.target.value;
  });

  document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") {
      endingOpen = false;
      render();
    }
  });

  document.getElementById("new-session")?.addEventListener("click", async () => {
    setupTask = "";
    endNote = "";
    await window.lockin.reset();
  });
}

function applyState(next) {
  Object.assign(state, next);

  if (
    state.phase === "setup" &&
    !setupTask &&
    state.stats?.sessions > 0 &&
    state.suggestedTask
  ) {
    setupTask = state.suggestedTask;
  }

  if (state.phase === "locking" && !lockStepTimer) {
    lockStep = 0;
    lockStepTimer = setInterval(() => {
      lockStep = Math.min(lockStep + 1, LOCKING_STEPS.length - 1);
      render();
    }, 400);
  }
  if (state.phase !== "locking" && lockStepTimer) {
    clearInterval(lockStepTimer);
    lockStepTimer = null;
  }

  if (state.phase === "locked" && !clockTimer) {
    clockTimer = setInterval(() => {
      if (state.startedAt) {
        state.elapsedMs = Date.now() - state.startedAt;
        const timer = document.querySelector(".locked-timer");
        if (timer) timer.textContent = formatDuration(state.elapsedMs);
        else render();
      }
    }, 250);
  }
  if (state.phase !== "locked" && clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  if (state.phase === "recap") endingOpen = false;

  render();
}

window.lockin.onState(applyState);
window.lockin.getState().then(applyState);
