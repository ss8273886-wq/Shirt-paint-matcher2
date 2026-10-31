import { createClient } from "@supabase/supabase-js";
import "./style.css";

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
};
const configured = Boolean(config.url && config.key);
const supabase = configured ? createClient(config.url, config.key) : null;
const app = document.querySelector("#app");

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function renderLogin(message = "") {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-card">
        <div class="eyebrow">Private cloud matcher</div>
        <h1>Shirt & Pant Matcher</h1>
        <p class="muted">Sign in with your email. Your list will sync across your devices.</p>
        ${message ? `<p class="notice" role="status">${escapeHtml(message)}</p>` : ""}
        <form id="login-form">
          <label for="email">Email address</label>
          <input id="email" name="email" type="email" autocomplete="email"
                 placeholder="you@example.com" maxlength="254" required />
          <button class="primary" type="submit">Send sign-in link</button>
        </form>
        <p class="tiny">We will email you a secure sign-in link. No password needed.</p>
      </section>
    </main>`;

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    const email = new FormData(event.currentTarget).get("email").trim().toLowerCase();
    if (!email || email.length > 254) return;
    button.disabled = true;
    button.textContent = "Sending…";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    renderLogin(error ? `Could not send link: ${error.message}` : "Check your email for the secure sign-in link.");
  });
}

function renderMatcher(user, initialData) {
  let data = {
    pants: Array.isArray(initialData?.pants) ? initialData.pants : [""],
    shirts: Array.isArray(initialData?.shirts) ? initialData.shirts : [""],
  };
  data.pants = normalizeRows(data.pants);
  data.shirts = normalizeRows(data.shirts);

  let saveTimer;
  let saving = false;
  let dirty = false;
  let lastSavedSnapshot = JSON.stringify(data);
  let remoteChannel;

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">Private cloud matcher</div>
          <h1>Shirt & Pant Matcher</h1>
          <p class="muted">Signed in as ${escapeHtml(user.email || "your account")}</p>
        </div>
        <button id="signout" class="quiet" type="button">Sign out</button>
      </header>

      <section class="summary" aria-live="polite">
        <div><strong id="match-count">0</strong><span>matching pair(s)</span></div>
        <div class="save-state" id="save-state">Loading saved list…</div>
      </section>

      <section class="columns">
        <section class="panel">
          <h2>👖 Pants</h2>
          <p class="hint">Enter pant numbers first. A new row appears as you type.</p>
          <div id="pants-list"></div>
          <button class="add-row" data-add="pants" type="button">+ Add pant</button>
        </section>
        <section class="panel">
          <h2>👕 Shirts</h2>
          <p class="hint">Enter shirt numbers. A new row appears as you type.</p>
          <div id="shirts-list"></div>
          <button class="add-row" data-add="shirts" type="button">+ Add shirt</button>
        </section>
      </section>

      <section class="results">
        <h2>Matched pairs</h2>
        <div id="pairs" class="empty">No matches yet.</div>
      </section>
      <div class="actions">
        <button id="clear" class="danger" type="button">Clear all</button>
      </div>
      <p class="tiny center">Your list is private to this account and saved in the cloud.</p>
    </main>`;

  const listElement = (group) => document.getElementById(`${group}-list`);

  function normalizeRows(rows) {
    const safe = rows
      .filter((value) => typeof value === "string")
      .map((value) => value.slice(0, 24));
    while (safe.length && safe[safe.length - 1] === "") safe.pop();
    return [...safe, ""];
  }

  function setSaveState(text, state = "") {
    const element = document.querySelector("#save-state");
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
  }

  function renderRows(group) {
    const container = listElement(group);
    container.replaceChildren();
    data[group].forEach((value, index) => {
      const row = document.createElement("div");
      row.className = "item";
      row.dataset.group = group;
      row.dataset.index = String(index);

      const label = document.createElement("label");
      label.htmlFor = `${group}-${index}`;
      label.textContent = String(index + 1);

      const input = document.createElement("input");
      input.id = `${group}-${index}`;
      input.type = "text";
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.maxLength = 24;
      input.placeholder = "e.g. 9085";
      input.value = value;
      input.setAttribute("aria-label", `${group === "pants" ? "Pant" : "Shirt"} ${index + 1} number`);
      input.addEventListener("input", () => {
        data[group][index] = input.value.slice(0, 24);
        if (index === data[group].length - 1 && input.value.trim()) {
          data[group].push("");
          renderRows(group);
          document.getElementById(`${group}-${index}`).focus();
        }
        updateMatches();
        scheduleSave();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        document.getElementById(`${group}-${index + 1}`)?.focus();
      });

      row.append(label, input);
      container.append(row);
    });
  }

  function updateMatches() {
    const pants = data.pants.map((value) => value.trim());
    const shirts = data.shirts.map((value) => value.trim());
    const shirtSet = new Set(shirts.filter(Boolean));
    const matches = new Set(pants.filter((value) => value && shirtSet.has(value)));

    document.querySelectorAll(".item").forEach((row) => {
      const value = data[row.dataset.group][Number(row.dataset.index)]?.trim();
      row.classList.toggle("matched", Boolean(value && matches.has(value)));
    });

    let count = 0;
    const pairRows = [];
    pants.forEach((pant, pantIndex) => {
      if (!pant || !matches.has(pant)) return;
      shirts.forEach((shirt, shirtIndex) => {
        if (shirt !== pant) return;
        count += 1;
        pairRows.push(`<div class="pair"><span>Pant ${pantIndex + 1} ↔ Shirt ${shirtIndex + 1}</span><strong>${escapeHtml(pant)}</strong></div>`);
      });
    });
    document.querySelector("#match-count").textContent = String(count);
    const pairs = document.querySelector("#pairs");
    pairs.className = pairRows.length ? "pairs" : "empty";
    pairs.innerHTML = pairRows.length ? pairRows.join("") : "No matches yet. Matching numbers appear here.";
  }

  function snapshot() {
    return {
      pants: data.pants.filter((value) => value.trim()),
      shirts: data.shirts.filter((value) => value.trim()),
    };
  }

  function scheduleSave() {
    dirty = true;
    setSaveState("Unsaved changes", "pending");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 450);
  }

  async function saveNow() {
    if (!dirty || saving) return;
    saving = true;
    const payload = snapshot();
    const payloadSnapshot = JSON.stringify(payload);
    setSaveState("Saving to cloud…", "pending");
    const { error } = await supabase.from("matcher_data").upsert({
      user_id: user.id,
      pants: payload.pants,
      shirts: payload.shirts,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    saving = false;

    if (error) {
      setSaveState("Save failed — check connection and retry", "error");
      console.error("Cloud save failed:", error.message);
      return;
    }

    lastSavedSnapshot = payloadSnapshot;
    dirty = JSON.stringify(snapshot()) !== payloadSnapshot;
    setSaveState(dirty ? "Saving latest changes…" : "Saved to cloud ✓", dirty ? "pending" : "saved");
    if (dirty) saveNow();
  }

  async function clearAll() {
    if (!window.confirm("Clear all shirt and pant numbers from your cloud list?")) return;
    clearTimeout(saveTimer);
    data = { pants: [""], shirts: [""] };
    renderRows("pants");
    renderRows("shirts");
    updateMatches();
    scheduleSave();
  }

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.add;
      data[group].push("");
      renderRows(group);
      document.getElementById(`${group}-${data[group].length - 1}`).focus();
    });
  });
  document.querySelector("#clear").addEventListener("click", clearAll);
  document.querySelector("#signout").addEventListener("click", async () => {
    await supabase.auth.signOut();
  });

  renderRows("pants");
  renderRows("shirts");
  updateMatches();
  setSaveState("Saved list loaded ✓", "saved");

  // Keep multiple open devices in sync when another device saves.
  remoteChannel = supabase.channel(`matcher-${user.id}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "matcher_data", filter: `user_id=eq.${user.id}`,
    }, (payload) => {
      if (dirty || saving || !payload.new) return;
      data = {
        pants: normalizeRows(payload.new.pants || []),
        shirts: normalizeRows(payload.new.shirts || []),
      };
      renderRows("pants");
      renderRows("shirts");
      updateMatches();
      setSaveState("Synced from another device ✓", "saved");
    })
    .subscribe();

  window.addEventListener("beforeunload", () => {
    clearTimeout(saveTimer);
    if (remoteChannel) supabase.removeChannel(remoteChannel);
  });
}

async function start() {
  if (!configured) {
    app.innerHTML = `
      <main class="auth-shell"><section class="auth-card">
        <h1>Setup required</h1>
        <p>Add your Supabase project URL and publishable/anon key to a <code>.env</code> file. Follow README.md.</p>
      </section></main>`;
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    renderLogin("Could not check your session. Refresh and try again.");
    return;
  }
  if (session) {
    await loadUserData(session.user);
  } else {
    renderLogin();
  }

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "SIGNED_IN" && nextSession) {
      loadUserData(nextSession.user);
    } else if (event === "SIGNED_OUT") {
      renderLogin();
    }
  });
}

async function loadUserData(user) {
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><h1>Loading your list…</h1></section></main>`;
  const { data, error } = await supabase
    .from("matcher_data")
    .select("pants, shirts")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    app.innerHTML = `<main class="auth-shell"><section class="auth-card">
      <h1>Could not load your list</h1><p class="notice">${escapeHtml(error.message)}</p>
      <button class="primary" onclick="location.reload()">Retry</button>
    </section></main>`;
    return;
  }
  renderMatcher(user, data);
}

start();
