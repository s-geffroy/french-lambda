import { esc } from "../fiche.js?v=dev";
import { paysLabel, norm } from "../data.js?v=dev";

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
let rech = "";

// Vue de référence : tout est lisible ici, sans couleur ni survol.
export function render(el, brands, ctx) {
  el.innerHTML = `<h2>Liste</h2>
    <p class="intro">Cliquer un en-tête pour trier, une ligne pour ouvrir la fiche. La recherche porte sur la marque, son type, sa catégorie et toute la chaîne de groupes qui la contrôle.</p>
    <div class="recherche-liste">
      <input type="search" name="rech" placeholder="Chercher dans la liste : Starbucks, Nestlé, yaourt…" aria-label="Chercher dans la liste">
      <label>Regrouper : <select name="mode">
        <option value="table">Aucun (tableau)</option>
        <option value="groupe">Par contrôleur ultime</option>
        <option value="cat">Par catégorie</option></select></label>
      <span class="compte muted"></span>
    </div>
    <div class="corps scroll-x"></div>`;
  const sel = el.querySelector("[name=mode]");
  sel.value = mode;
  sel.onchange = () => {
    mode = sel.value;
    corps();
  };
  const champ = el.querySelector("[name=rech]");
  champ.value = rech;
  let frappe;
  champ.oninput = () => {
    clearTimeout(frappe);
    frappe = setTimeout(() => {
      rech = champ.value;
      corps();
    }, 150);
  };
  // Seul le corps est redessiné : le champ garde le focus pendant la frappe.
  const corps = () => {
    const q = norm(rech.trim());
    const vus = q ? brands.filter((b) => b.search.includes(q)) : brands;
    el.querySelector(".compte").textContent = `${vus.length} marque${vus.length > 1 ? "s" : ""}${q ? ` sur ${brands.length}` : ""}`;
    const c = el.querySelector(".corps");
    c.innerHTML = !vus.length
      ? '<p class="muted">Aucune marque ne correspond.</p>'
      : mode === "table" ? table(vus) : groupes(vus, ctx, mode);
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
  const m = new Map();
  for (const b of brands) {
    const k = key(b);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(b);
  }
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
