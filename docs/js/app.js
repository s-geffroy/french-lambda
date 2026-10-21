import { loadData, applyFilters, paysLabel } from "./data.js";
import { renderFiche } from "./fiche.js";
import { need } from "./lib.js";

// Chaque vue n'est téléchargée qu'à sa première ouverture, avec ses bibliothèques.
const VUES = {
  journee: [],
  liste: [],
  graphe: ["d3"],
  soleil: ["d3"],
  flux: ["d3", "sankey"],
  carte: ["d3", "topojson"],
  classement: ["d3"],
  methode: [],
};
const loadVue = (v) => Promise.all([import(`./views/${v}.js`), need(...VUES[v])]).then(([m]) => m);
const FILTRES = ["q", "macro", "cat", "nature", "statut", "pays", "groupe"];

const $ = (s) => document.querySelector(s);
const state = readHash();
let model;

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const s = { vue: p.get("vue") || "journee", sel: p.get("sel") || "" };
  for (const k of FILTRES) s[k] = p.get(k) || "";
  if (!VUES[s.vue]) s.vue = "journee";
  return s;
}

function writeHash() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v) p.set(k, v);
  history.replaceState(null, "", "#" + p.toString());
}

function fillSelect(name, items) {
  const sel = $(`#filtres [name=${name}]`);
  for (const it of items) sel.append(new Option(it.label, it.id));
}

let frappe;
function setupFilters() {
  const { ref } = model;
  fillSelect("macro", ref.macros);
  fillSelect("cat", ref.categories);
  fillSelect("nature", ref.natures);
  fillSelect("statut", ref.statuts);
  const pays = [...new Set(model.brands.map((b) => b.pays))]
    .map((id) => ({ id, label: paysLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  fillSelect("pays", pays);

  const form = $("#filtres");
  for (const k of FILTRES) if (form.elements[k]) form.elements[k].value = state[k];
  form.addEventListener("input", (e) => {
    if (!e.target.name) return;
    state[e.target.name] = e.target.value;
    if (e.target.name === "macro") {
      // Une catégorie hors du poste choisi n'a plus de sens.
      const c = model.cat.get(state.cat);
      if (c && state.macro && c.macro !== state.macro) form.elements.cat.value = state.cat = "";
    }
    // La recherche attend une courte pause de frappe avant de redessiner.
    clearTimeout(frappe);
    if (e.target.name === "q") frappe = setTimeout(update, 180);
    else update();
  });
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("reset", () => {
    for (const k of FILTRES) state[k] = "";
    setTimeout(update);
  });
  $("#filtre-groupe").addEventListener("click", () => {
    state.groupe = "";
    update();
  });
}

function setupTabs() {
  $("#tabs").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.vue;
    if (v) {
      state.vue = v;
      update();
    }
  });
}

function setupTheme() {
  $("#theme").addEventListener("click", () => {
    const root = document.documentElement;
    const dark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
    update();
  });
}

// API partagée par les vues.
const ctx = {
  get model() { return model; },
  get state() { return state; },
  select(sel) {
    state.sel = sel;
    writeHash();
    showFiche();
  },
  filterGroupe(id) {
    state.groupe = id;
    update();
  },
  goto(vue, patch = {}) {
    Object.assign(state, patch, { vue });
    update();
  },
  color(macroId) {
    const m = model.macro.get(macroId);
    return m ? `var(--s${m.slot})` : "var(--axis)";
  },
  css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  },
  tip: {
    show(ev, html) {
      const t = $("#tip");
      t.innerHTML = html;
      t.hidden = false;
      const x = Math.min(ev.clientX + 14, innerWidth - t.offsetWidth - 8);
      const y = Math.min(ev.clientY + 14, innerHeight - t.offsetHeight - 8);
      t.style.left = x + "px";
      t.style.top = y + "px";
    },
    hide() { $("#tip").hidden = true; },
  },
};

function showFiche() {
  const el = $("#fiche");
  const ok = state.sel && renderFiche(el, ctx);
  el.hidden = !ok;
  $("main").classList.toggle("avec-fiche", !!ok);
}

function renderStats(brands) {
  const groupesTop = new Set(brands.map((b) => b.top.id));
  const etranger = brands.filter((b) => b.pays !== "FR").length;
  const pct = brands.length ? Math.round((100 * etranger) / brands.length) : 0;
  $("#stats").innerHTML = [
    [brands.length, "marques & services"],
    [new Set(brands.map((b) => b.groupe)).size, "entreprises exploitantes"],
    [groupesTop.size, "contrôleurs ultimes"],
    [pct + " %", "contrôlés depuis l'étranger"],
    [brands.filter((b) => b.aConfirmer).length, "fiches à confirmer"],
  ]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`)
    .join("");
}

let rendu = 0;
async function update() {
  const tour = ++rendu;
  writeHash();
  for (const b of document.querySelectorAll("#tabs button"))
    b.setAttribute("aria-selected", b.dataset.vue === state.vue);
  const chip = $("#filtre-groupe");
  chip.hidden = !state.groupe;
  if (state.groupe) chip.textContent = "Groupe : " + (model.g.get(state.groupe)?.nom || state.groupe);

  const brands = applyFilters(model, state);
  renderStats(brands);
  ctx.tip.hide();
  const el = $("#vue");
  if (el.dataset.vue !== state.vue) {
    el.dataset.vue = state.vue;
    el.innerHTML = '<p class="muted">Chargement…</p>';
  }
  try {
    const vue = await loadVue(state.vue);
    // Un clic plus récent a déjà pris la main : ce rendu est périmé.
    if (tour !== rendu) return;
    el.innerHTML = "";
    await vue.render(el, brands, ctx);
  } catch (err) {
    if (tour !== rendu) return;
    console.error(err);
    el.innerHTML = `<p>Cette vue n'a pas pu s'afficher : ${err.message}</p>`;
  }
  showFiche();
}

async function main() {
  try {
    model = await loadData();
  } catch (err) {
    $("#vue").innerHTML = `<p>Impossible de charger les données : ${err.message}</p>`;
    return;
  }
  const dates = model.groupes.map((g) => g.verifie_le).filter(Boolean).sort();
  $("#maj").textContent = dates.at(-1) || "—";
  setupFilters();
  setupTabs();
  setupTheme();
  addEventListener("hashchange", () => {
    Object.assign(state, readHash());
    update();
  });
  // Sur mobile, la barre d'adresse qui se replie au défilement change la
  // hauteur : seule une vraie variation de largeur justifie de redessiner.
  let rt, largeur = innerWidth;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (Math.abs(innerWidth - largeur) < 40 || ["journee", "liste", "methode"].includes(state.vue)) return;
      largeur = innerWidth;
      update();
    }, 250);
  });
  update();
}

main();
