import { esc } from "../fiche.js";
import { paysLabel } from "../data.js";

const COLS = [
  ["marque", "Marque", (b) => b.marque],
  ["poste", "Catégorie", (b) => b.catObj?.label || b.categorie],
  ["sous", "Type", (b) => b.sous_categorie],
  ["groupe", "Exploitant", (b) => b.groupeObj?.nom || b.groupe],
  ["top", "Contrôle ultime", (b) => b.top.nom],
  ["pays", "Siège", (b) => paysLabel(b.pays)],
  ["act", "Nationalité actionnaire", (b) => paysLabel(b.paysAct)],
];
let tri = { col: "poste", dir: 1 };
let mode = "table";

// Vue de référence : tout est lisible ici, sans couleur ni survol.
export function render(el, brands, ctx) {
  el.innerHTML = `<h2>Liste</h2>
    <p class="intro">${brands.length} marques. Cliquer un en-tête pour trier, une ligne pour ouvrir la fiche.</p>
    <p><label>Regrouper : <select name="mode">
      <option value="table">Aucun (tableau)</option>
      <option value="groupe">Par contrôleur ultime</option>
      <option value="cat">Par catégorie</option></select></label></p>
    <div class="corps scroll-x"></div>`;
  const sel = el.querySelector("[name=mode]");
  sel.value = mode;
  sel.onchange = () => {
    mode = sel.value;
    corps();
  };
  const corps = () => {
    const c = el.querySelector(".corps");
    c.innerHTML = mode === "table" ? table(brands) : groupes(brands, ctx, mode);
  };
  corps();
  el.onclick = (e) => {
    const th = e.target.closest("th[data-col]");
    if (th) {
      tri = { col: th.dataset.col, dir: tri.col === th.dataset.col ? -tri.dir : 1 };
      corps();
      return;
    }
    const t = e.target.closest("[data-sel]");
    if (t) ctx.select(t.dataset.sel);
  };
}

function table(brands) {
  const get = COLS.find((c) => c[0] === tri.col)[2];
  const rows = [...brands].sort((a, b) => tri.dir * String(get(a)).localeCompare(String(get(b)), "fr") || a.marque.localeCompare(b.marque, "fr"));
  return `<table><thead><tr>${COLS.map(
    ([k, l]) => `<th data-col="${k}" ${k === tri.col ? `aria-sort="${tri.dir > 0 ? "ascending" : "descending"}"` : ""}>${l}${k === tri.col ? (tri.dir > 0 ? " ▲" : " ▼") : ""}</th>`
  ).join("")}</tr></thead><tbody>${rows
    .map(
      (b) => `<tr data-sel="m:${esc(b.id)}" style="cursor:pointer">${COLS.map(([, , f], i) =>
        i === 0 ? `<td><i class="pastille" style="background:var(--s${b.macroObj?.slot ?? 1})"></i><b>${esc(f(b))}</b>${b.aConfirmer ? ' <span class="tag doute" title="à confirmer">?</span>' : ""}</td>` : `<td>${esc(f(b))}</td>`
      ).join("")}</tr>`
    )
    .join("")}</tbody></table>`;
}

function groupes(brands, ctx, by) {
  const key = by === "groupe" ? (b) => b.top.id : (b) => b.categorie;
  const label = by === "groupe" ? (id) => ctx.model.g.get(id)?.nom || id : (id) => ctx.model.cat.get(id)?.label || id;
  const m = d3.group(brands, key);
  const keys = [...m.keys()].sort((a, b) => (by === "groupe" ? m.get(b).length - m.get(a).length : 0) || label(a).localeCompare(label(b), "fr"));
  return keys
    .map(
      (k) => `<div class="groupe-bloc"><h3>${by === "groupe" ? `<button class="lien" data-sel="g:${esc(k)}">${esc(label(k))}</button>` : esc(label(k))} <span class="muted">· ${m.get(k).length}</span></h3>
      <div class="marques">${m
        .get(k)
        .sort((a, b) => a.marque.localeCompare(b.marque, "fr"))
        .map((b) => `<button class="marque-btn" style="--c:${ctx.color(b.macroObj?.id)}" data-sel="m:${esc(b.id)}">${esc(b.marque)}</button>`)
        .join("")}</div></div>`
    )
    .join("");
}
