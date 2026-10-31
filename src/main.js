import { createClient } from "@supabase/supabase-js";
import "./style.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const TABLE = "shared_matcher_data";
const ROW_ID = 1;

const app = document.querySelector("#app");
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let data = { pants: [""], shirts: [""] };
let saveTimer;
let saving = false;
let dirty = false;
let remoteChannel;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function normalizeRows(values) {
  const rows = Array.isArray(values)
    ? values.filter((value) => typeof value === "string").map((value) => value.slice(0, 24)).slice(0, 500)
    : [];
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  return [...rows, ""];
}

function snapshot() {
  return {
    pants: data.pants.filter((value) => value.trim()),
    shirts: data.shirts.filter((value) => value.trim()),
  };
}

function setStatus(message, state = "") {
  const status = document.querySelector("#save-state");
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function render() {
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <div class="eyebrow">Shared inventory matcher</div>
          <h1>Shirt & Pant Matcher</h1>
          <p class="muted">Everyone using this link sees and edits the same list.</p>
        </div>
        <span class="shared-label">Shared</span>
      </header>

      <section class="summary" aria-live="polite">
        <div><strong id="match-count">0</strong><span>matching pair(s)</span></div>
        <div class="save-state" id="save-state">Connecting to cloud…</div>
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
        <div class="results-heading">
          <h2>Matched pairs</h2>
          <button id="pack-matches" class="pack-button" type="button" disabled>✓ Packed — remove matches</button>
        </div>
        <p class="hint">After you pack matched items, use the button to remove those numbers from both lists.</p>
        <div id="pairs" class="empty">No matches yet.</div>
      </section>
      <div class="actions">
        <button id="clear" class="danger" type="button">Clear all shared data</button>
      </div>
      <p class="tiny center">Shared public list: anyone with this website link can view, add, edit, or remove entries.</p>
    </main>`;

  renderRows("pants");
  renderRows("shirts");
  updateMatches();
  bindActions();
}

function renderRows(group) {
  const container = document.getElementById(`${group}-list`);
  if (!container) return;
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

function matchedValues() {
  const pants = data.pants.map((value) => value.trim());
  const shirts = new Set(data.shirts.map((value) => value.trim()).filter(Boolean));
  return new Set(pants.filter((value) => value && shirts.has(value)));
}

function updateMatches() {
  const matches = matchedValues();
  document.querySelectorAll(".item").forEach((row) => {
    const value = data[row.dataset.group][Number(row.dataset.index)]?.trim();
    row.classList.toggle("matched", Boolean(value && matches.has(value)));
  });

  const pairs = [];
  data.pants.forEach((pant, pantIndex) => {
    const code = pant.trim();
    if (!code || !matches.has(code)) return;
    data.shirts.forEach((shirt, shirtIndex) => {
      if (shirt.trim() === code) {
        pairs.push(`<div class="pair"><span>Pant ${pantIndex + 1} ↔ Shirt ${shirtIndex + 1}</span><strong>${escapeHtml(code)}</strong></div>`);
      }
    });
  });

  document.querySelector("#match-count").textContent = String(pairs.length);
  const pairContainer = document.querySelector("#pairs");
  pairContainer.className = pairs.length ? "pairs" : "empty";
  pairContainer.innerHTML = pairs.length ? pairs.join("") : "No matches yet. Matching numbers appear here.";
  document.querySelector("#pack-matches").disabled = matches.size === 0;
}

function scheduleSave() {
  dirty = true;
  setStatus("Unsaved changes", "pending");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 500);
}

async function saveNow() {
  if (!dirty || saving || !supabase) return;
  saving = true;
  const payload = snapshot();
  const savedSnapshot = JSON.stringify(payload);
  setStatus("Saving to cloud…", "pending");

  const { error } = await supabase.from(TABLE).upsert({
    id: ROW_ID,
    pants: payload.pants,
    shirts: payload.shirts,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  saving = false;
  if (error) {
    setStatus("Save failed — check connection and retry", "error");
    console.error("Cloud save failed:", error.message);
    return;
  }

  dirty = JSON.stringify(snapshot()) !== savedSnapshot;
  setStatus(dirty ? "Saving latest changes…" : "Saved to cloud ✓", dirty ? "pending" : "saved");
  if (dirty) saveNow();
}

async function packMatches() {
  const matches = matchedValues();
  if (!matches.size) return;
  const codes = [...matches];
  const confirmed = window.confirm(
    `Remove ${codes.length} matched code(s) from BOTH lists after packing?\n\n${codes.join(", ")}`
  );
  if (!confirmed) return;

  data.pants = normalizeRows(data.pants.filter((value) => !matches.has(value.trim())));
  data.shirts = normalizeRows(data.shirts.filter((value) => !matches.has(value.trim())));
  renderRows("pants");
  renderRows("shirts");
  updateMatches();
  scheduleSave();
}

async function clearAll() {
  if (!window.confirm("Delete ALL pants and shirts from the shared cloud list? This affects everyone using this link.")) return;
  data = { pants: [""], shirts: [""] };
  renderRows("pants");
  renderRows("shirts");
  updateMatches();
  scheduleSave();
}

function bindActions() {
  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.dataset.add;
      data[group].push("");
      renderRows(group);
      document.getElementById(`${group}-${data[group].length - 1}`).focus();
    });
  });
  document.querySelector("#pack-matches").addEventListener("click", packMatches);
  document.querySelector("#clear").addEventListener("click", clearAll);
}

async function loadSharedData() {
  if (!supabase) {
    app.innerHTML = `<main class="auth-shell"><section class="auth-card">
      <h1>Setup required</h1>
      <p>Cloudflare is missing the build variables <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Add them in Pages build settings, then redeploy.</p>
    </section></main>`;
    return;
  }

  const { data: row, error } = await supabase
    .from(TABLE)
    .select("pants, shirts")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    app.innerHTML = `<main class="auth-shell"><section class="auth-card">
      <h1>Could not load shared list</h1>
      <p class="notice">${escapeHtml(error.message)}</p>
      <button class="primary" onclick="location.reload()">Retry</button>
    </section></main>`;
    return;
  }

  data = row
    ? { pants: normalizeRows(row.pants), shirts: normalizeRows(row.shirts) }
    : { pants: [""], shirts: [""] };

  render();
  setStatus("Shared list loaded ✓", "saved");

  // Keep open devices in sync. Ignore remote updates while this device has unsaved edits.
  remoteChannel = supabase.channel("shared-matcher-updates")
    .on("postgres_changes", {
      event: "*", schema: "public", table: TABLE,
    }, (payload) => {
      if (dirty || saving || !payload.new || payload.new.id !== ROW_ID) return;
      data = {
        pants: normalizeRows(payload.new.pants),
        shirts: normalizeRows(payload.new.shirts),
      };
      render();
      setStatus("Synced from another device ✓", "saved");
    })
    .subscribe();

  window.addEventListener("beforeunload", () => {
    clearTimeout(saveTimer);
    if (remoteChannel) supabase.removeChannel(remoteChannel);
  });
}

loadSharedData();
