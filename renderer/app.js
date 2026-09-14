const LOCKING_STEPS = [
  "Covering the desktop",
  "Arming Chrome and Safari tab kills",
  "Binding blocked hosts to this lock",
  "Handing the machine to one task",
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
  escapeAttempts: 0,
  reviewError: null,
  reviewing: false,
  recap: null,
  pacEnabled: false,
  stats: {},
};

let setupTask = "";
let setupError = null;
let suggesting = false;
let doneOpen = false;
let escapeOpen = false;
let explanation = "";
let escapeStep = 1;
let escapePhrase = "";
let escapePhraseError = null;
let holdLeft = 5;
let holdTimer = null;
let lockStep = 0;
let lockStepTimer = null;
let clockTimer = null;

function $(html) {
  return html;
}

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  const root = document.getElementById("app");
  if (state.phase === "locking") root.innerHTML = lockingView();
  else if (state.phase === "locked") root.innerHTML = sessionView();
  else if (state.phase === "recap") root.innerHTML = recapView();
  else root.innerHTML = setupView();
  if (doneOpen) root.insertAdjacentHTML("beforeend", doneModal());
  if (escapeOpen) root.insertAdjacentHTML("beforeend", escapeModal());
  bind();
}

function setupView() {
  const g = state.greeting || {};
  return $`
    <div class="app">
      <header class="header">
        <div class="brand"><span class="mark">L</span> LockIn</div>
        <p class="muted">Real machine lock. Not a browser toy.</p>
      </header>
      <div class="center">
        <div class="stack">
          <p class="kicker">Warden</p>
          <h1>${escapeHtml(g.headline || "Name the one thing.")}</h1>
          <p>${escapeHtml(g.body || "This machine will only do this task.")}</p>
          <form id="lock-form">
            <label for="task">Focus task</label>
            <textarea id="task" rows="4" placeholder="Draft the Q3 hiring brief for the senior backend role">${escapeHtml(setupTask)}</textarea>
            <p class="empty">${setupTask.trim() ? "One sentence. Specific enough that a stranger could grade you." : "Empty lock. Pick a sample or let the agent choose."}</p>
            ${setupError ? `<div class="alert"><h3>Can't seal this</h3><p>${escapeHtml(setupError)}</p></div>` : ""}
            <div class="row" style="margin-top:14px">
              <button class="btn primary grow" type="submit">Lock this machine</button>
              <button class="btn grow" type="button" id="suggest">${suggesting ? "Warden is choosing…" : "Let the agent pick"}</button>
            </div>
          </form>
          <label class="check">
            <input type="checkbox" id="login-item" ${state.loginItemEnabled ? "checked" : ""} />
            Open Warden at login / when this computer starts
          </label>
          <p class="kicker" style="margin-top:28px">Sample locks</p>
          <ul class="samples">
            ${(state.sampleTasks || []).map((t) => `<li><button type="button" data-sample="${escapeHtml(t)}">${escapeHtml(t)}</button></li>`).join("")}
          </ul>
        </div>
      </div>
    </div>`;
}

function lockingView() {
  return $`
    <div class="app">
      <div class="center">
        <div class="stack" style="text-align:center">
          <p class="kicker">Sealing session</p>
          <div class="progress"><span></span></div>
          <p class="mono">${escapeHtml(LOCKING_STEPS[lockStep] || LOCKING_STEPS.at(-1))}</p>
          <p>Locked task: <span style="color:#e4e4e7">${escapeHtml(state.task)}</span></p>
        </div>
      </div>
    </div>`;
}

function sessionView() {
  const events = (state.blockedEvents || []).slice().reverse();
  return $`
    <div class="app">
      <header class="header">
        <div class="live"><span class="dot"></span> Computer locked <span class="badge">${formatDuration(state.elapsedMs)}</span></div>
        <div class="row">
          <span class="muted mono">Esc = friction · ${state.blockedAttempts} blocked · ${state.escapeAttempts} escapes</span>
          <button class="btn sm" id="break">Break lock</button>
          <button class="btn primary sm" id="done">Done</button>
        </div>
      </header>
      <div class="taskbar">
        <p class="task"><span class="kicker" style="display:inline;margin:0 8px 0 0">Task</span>${escapeHtml(state.task)}</p>
        <p class="muted">${state.pacEnabled ? "System PAC armed" : "Tab watchdog + extension armed"} · blocks apply only while locked</p>
      </div>
      <div class="desk">
        <section class="panel">
          <label for="notes">Session desk</label>
          <textarea id="notes" placeholder="This is the writable surface. The rest of the machine is locked. Open a real Chrome tab to YouTube and it dies.">${escapeHtml(state.notes || "")}</textarea>
          <p class="empty">${(state.notes || "").trim() ? "Notes stay on this machine for the session. They don't count as a debrief." : "Desk is empty. That's fine for a minute — not for the whole lock."}</p>
        </section>
        <section class="panel">
          <label>Live blocks (real Chrome / Safari tabs)</label>
          <div class="feed">
            ${
              events.length
                ? events
                    .map(
                      (e) => `<div class="hit"><strong>${escapeHtml(e.name || e.host)}</strong><span class="empty">${escapeHtml(e.source || "block")} · ${escapeHtml(e.host)}</span></div>`,
                    )
                    .join("")
                : `<p class="empty">No blocked tabs yet. Open a new Chrome or Safari tab to youtube.com — LockIn will kill the navigation system-wide.</p>`
            }
          </div>
        </section>
      </div>
    </div>`;
}

function recapView() {
  const recap = state.recap || {};
  return $`
    <div class="app">
      <header class="header">
        <div class="brand"><span class="mark">L</span> LockIn</div>
        <span class="badge">${recap.abandoned ? "Broken lock" : "Session sealed"}</span>
      </header>
      <div class="center">
        <div class="stack">
          <h1>${recap.abandoned ? "You broke the lock." : "Debrief accepted."}</h1>
          <p>${escapeHtml(recap.abandoned ? "That's data, not a sermon. The machine is yours again — and the task is unfinished. Next lock, I'll remember this." : recap.verdict || "")}</p>
          <div class="card">
            <header>
              <div class="kicker">Locked task</div>
              <p style="color:#e4e4e7;margin:6px 0 0">${escapeHtml(recap.task || "")}</p>
            </header>
            <div class="stats">
              <div><strong>${formatDuration(recap.durationMs || 0)}</strong><p>Time locked</p></div>
              <div><strong>${recap.blockedAttempts || 0}</strong><p>Blocked sites</p></div>
              <div><strong>${recap.escapeAttempts || 0}</strong><p>Escape tries</p></div>
            </div>
            <footer>
              ${
                recap.abandoned
                  ? `<p class="empty">No debrief on file. You left before Warden could grade the work.</p>`
                  : `<p class="empty" style="text-transform:uppercase;letter-spacing:.14em;font-size:11px">Your explanation</p><p style="color:#e4e4e7">${escapeHtml(recap.explanation || "")}</p>`
              }
            </footer>
          </div>
          <button class="btn primary grow" style="margin-top:22px;width:100%" id="new-lock">New lock</button>
        </div>
      </div>
    </div>`;
}

function doneModal() {
  return $`
    <div class="modal-back" id="done-back">
      <div class="modal">
        <h2 style="margin:0 0 8px">Debrief required</h2>
        <p>You don't get to click Done and walk. Write what you did on <span style="color:#e4e4e7">${escapeHtml(state.task)}</span>. Warden will reject a fake.</p>
        <label for="debrief">What did you do?</label>
        <textarea id="debrief" rows="6" ${state.reviewing ? "disabled" : ""}>${escapeHtml(explanation)}</textarea>
        <p class="empty">${explanation.trim() ? "Mention the actual task. “I did the work” is an automatic no." : "Empty debrief. The agent will not accept a blank."}</p>
        ${state.reviewError ? `<div class="alert"><h3>Warden rejected this</h3><p>${escapeHtml(state.reviewError)}</p></div>` : ""}
        ${state.reviewing ? `<p class="kicker">Reviewing your debrief against the locked task…</p>` : ""}
        <div class="actions">
          <button class="btn" id="keep-working" ${state.reviewing ? "disabled" : ""}>Keep working</button>
          <button class="btn primary" id="submit-debrief" ${state.reviewing ? "disabled" : ""}>${state.reviewing ? "Judging…" : "Submit debrief"}</button>
        </div>
      </div>
    </div>`;
}

function escapeModal() {
  return $`
    <div class="modal-back">
      <div class="modal danger">
        <h2 style="margin:0 0 8px;color:#fecaca">Break the lock?</h2>
        <p>Escape is logged. This is attempt ${state.escapeAttempts || 1}. Quitting voids the session — there is no debrief, no credit.</p>
        ${
          escapeStep === 1
            ? `<label for="quit-phrase">Type I QUIT to keep going</label>
               <input id="quit-phrase" class="mono" autocomplete="off" value="${escapeHtml(escapePhrase)}" />
               <p class="${escapePhraseError ? "" : "empty"}" style="${escapePhraseError ? "color:#f87171" : ""}">${escapeHtml(escapePhraseError || "One-click quit is how you end up on YouTube.")}</p>`
            : ""
        }
        ${
          escapeStep === 2
            ? `<div class="hold"><div class="count">${holdLeft}</div><p>Sit with it. The task is still waiting.</p></div>`
            : ""
        }
        ${
          escapeStep === 3
            ? `<p>Last chance. Abandoning wipes the lock and marks this session as broken. Stay if you still owe the task a real ending.</p>`
            : ""
        }
        <div class="actions">
          <button class="btn" id="stay">Stay locked</button>
          ${escapeStep === 1 ? `<button class="btn danger" id="escape-continue">Continue</button>` : ""}
          ${escapeStep === 3 ? `<button class="btn danger" id="abandon">Abandon session</button>` : ""}
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
      setupError = result?.error || "Could not lock.";
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
  document.getElementById("notes")?.addEventListener("input", (e) => {
    state.notes = e.target.value;
    window.lockin.setNotes(e.target.value);
  });
  document.getElementById("done")?.addEventListener("click", () => {
    doneOpen = true;
    state.reviewError = null;
    window.lockin.beginDone();
    render();
  });
  document.getElementById("break")?.addEventListener("click", openEscape);
  document.getElementById("keep-working")?.addEventListener("click", () => {
    if (state.reviewing) return;
    doneOpen = false;
    render();
  });
  document.getElementById("submit-debrief")?.addEventListener("click", async () => {
    explanation = document.getElementById("debrief")?.value || explanation;
    const result = await window.lockin.submitDebrief(explanation);
    if (result?.ok) {
      doneOpen = false;
    }
  });
  document.getElementById("debrief")?.addEventListener("input", (e) => {
    explanation = e.target.value;
  });
  document.getElementById("stay")?.addEventListener("click", closeEscape);
  document.getElementById("escape-continue")?.addEventListener("click", () => {
    if (escapePhrase.trim().toUpperCase() !== "I QUIT") {
      escapePhraseError = "Type I QUIT exactly. No shortcuts.";
      render();
      return;
    }
    escapeStep = 2;
    holdLeft = 5;
    render();
    holdTimer = setInterval(() => {
      holdLeft -= 1;
      if (holdLeft <= 0) {
        clearInterval(holdTimer);
        escapeStep = 3;
      }
      render();
    }, 1000);
  });
  document.getElementById("quit-phrase")?.addEventListener("input", (e) => {
    escapePhrase = e.target.value;
  });
  document.getElementById("abandon")?.addEventListener("click", async () => {
    closeEscape();
    await window.lockin.abandon();
  });
  document.getElementById("new-lock")?.addEventListener("click", async () => {
    setupTask = "";
    explanation = "";
    await window.lockin.reset();
  });
}

function openEscape() {
  escapeOpen = true;
  escapeStep = 1;
  escapePhrase = "";
  escapePhraseError = null;
  window.lockin.beginEscape();
  render();
}

function closeEscape() {
  escapeOpen = false;
  escapeStep = 1;
  if (holdTimer) clearInterval(holdTimer);
  window.lockin.stay();
  render();
}

function applyState(next) {
  Object.assign(state, next);
  if (state.phase === "setup" && !setupTask && state.stats?.sessions > 0 && state.suggestedTask) {
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
  if (state.phase === "recap") {
    doneOpen = false;
    escapeOpen = false;
  }
  if (state.phase === "locked" && !clockTimer) {
    clockTimer = setInterval(() => {
      if (state.startedAt) {
        state.elapsedMs = Date.now() - state.startedAt;
        if (!doneOpen && !escapeOpen) render();
        else {
          const badge = document.querySelector(".badge");
          if (badge) badge.textContent = formatDuration(state.elapsedMs);
        }
      }
    }, 250);
  }
  if (state.phase !== "locked" && clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
  render();
}

window.lockin.onState(applyState);
window.lockin.getState().then(applyState);
window.lockin.onEscape(() => {
  if (state.phase === "locked") openEscape();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.phase === "locked" && !escapeOpen) {
    e.preventDefault();
    openEscape();
  }
});
