import { paysLabel } from "./data.js?v=dev";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Date de la mesure d'une part : "2025", "2026-03" ou "2026-03-31".
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function datePart(d) {
  if (!d) return "date inconnue";
  const [a, m, j] = d.split("-");
  return [j && String(+j), m && MOIS[+m - 1], a].filter(Boolean).join(" ");
}
const part = (a) =>
  a.part_pct == null ? "" : ` ${a.part_pct.toLocaleString("fr-FR")} % <span class="date-part" title="date à laquelle cette part a été mesurée">${esc(datePart(a.part_date))}</span>`;

const STATUT = (ctx, id) => ctx.model.ref.statuts.find((s) => s.id === id)?.label || id || "—";

function actionnaires(ctx, g) {
  if (!g.actionnaires?.length) return "";
  return (
    '<div class="act">' +
    g.actionnaires
      .map((a) => {
        const nom = a.id && ctx.model.g.has(a.id)
          ? `<button class="lien" data-sel="g:${esc(a.id)}">${esc(a.nom)}</button>`
          : esc(a.nom);
        const pays = a.pays || ctx.model.g.get(a.id)?.pays_siege;
        return nom + part(a) +
          (pays && pays !== "XX" ? ` <span class="tag">${esc(paysLabel(pays))}</span>` : "");
      })
      .join(" · ") +
    "</div>"
  );
}

function chaine(ctx, groups) {
  return (
    '<ol class="chaine">' +
    groups
      .map(
        (g) => `<li><button class="lien" data-sel="g:${esc(g.id)}"><b>${esc(g.nom)}</b></button>
          <span class="tag">${esc(paysLabel(g.pays_siege))}</span> <span class="tag">${esc(STATUT(ctx, g.statut))}</span>
          ${actionnaires(ctx, g)}</li>`
      )
      .join("") +
    "</ol>"
  );
}

// Ouvre une issue GitHub pré-remplie : le formulaire est
// .github/ISSUE_TEMPLATE/correction.yml, ses champs se remplissent par leur id.
const DEPOT = "https://github.com/s-geffroy/french-lambda";
function signaler(sel, nom) {
  const q = new URLSearchParams({ template: "correction.yml", title: `Correction : ${nom}`, fiche: `${sel} (${nom})` });
  return `<p class="signaler"><a href="${DEPOT}/issues/new?${esc(q.toString())}" target="_blank" rel="noopener">Signaler une erreur sur cette fiche</a></p>`;
}

function sources(list) {
  if (!list?.length) return "";
  return (
    '<p class="sources">Sources : ' +
    list.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60))}</a>`).join(" · ") +
    "</p>"
  );
}

// France-System-2026 (dépôt s-geffroy/cpp) relie certains de ses acteurs à nos
// groupes. Son registre sert de référence : on renvoie vers lui, on ne recopie
// rien. Chargé une fois ; s'il ne répond pas, la fiche s'affiche sans le lien.
const CPP = "https://s-geffroy.github.io/cpp/";
let correspondancesCpp;
function chargerCpp() {
  correspondancesCpp ??= fetch(`${CPP}assets/donnees/ajout_correspondances_french_lambda.json`)
    .then((r) => (r.ok ? r.json() : { correspondances: [] }))
    .then((d) => new Map((d.correspondances || []).map((c) => [c.french_lambda_id, c])))
    .catch(() => new Map());
  return correspondancesCpp;
}

function lienCpp(el, id) {
  chargerCpp().then((m) => {
    const c = m.get(id);
    const zone = c && el.querySelector?.(`.cpp[data-g="${id}"]`); // id : slug vérifié par validate_data.py
    if (!zone) return;
    zone.innerHTML = `<a href="${CPP}acteurs/#${encodeURIComponent(c.actor_id)}" target="_blank" rel="noopener">Participations vérifiées sur France-System-2026</a>` +
      (c.rapport === "entite_voisine" && c.note ? `<br><span class="muted">${esc(c.note)}</span>` : "");
    zone.hidden = false;
  });
}

export function renderFiche(el, ctx) {
  const [type, id] = ctx.state.sel.split(":");
  const { model } = ctx;
  let html;
  if (type === "m") {
    const b = model.brands.find((x) => x.id === id);
    if (!b) return false;
    html = `<h3>${esc(b.marque)}</h3>
      ${b.aConfirmer ? '<p><span class="tag doute">à confirmer</span> une information de cette chaîne n\'a pas pu être revérifiée</p>' : ""}
      <p class="muted">${esc(b.sous_categorie)} — ${esc(b.catObj?.label)}</p>
      <dl>
        <dt>Nature</dt><dd>${esc(model.ref.natures.find((n) => n.id === b.nature)?.label)}</dd>
        ${b.part_marche ? `<dt>Part de marché</dt><dd>${esc(b.part_marche)}</dd>` : ""}
        <dt>Contrôle</dt><dd>${esc(b.top.nom)} (${esc(paysLabel(b.pays))})</dd>
        <dt>Actionnaire principal</dt><dd>${esc(paysLabel(b.paysAct))}</dd>
      </dl>
      ${b.note ? `<p>${esc(b.note)}</p>` : ""}
      ${b.chain.filter((x) => x.note).map((x) => `<p class="muted"><b>${esc(x.nom)}</b> : ${esc(x.note)}</p>`).join("")}
      <h4>Qui est derrière</h4>
      ${chaine(ctx, b.chain)}
      <p><button class="lien" data-groupe="${esc(b.top.id)}">Toutes les marques de ${esc(b.top.nom)}</button></p>
      ${sources(b.sources)}
      ${signaler(ctx.state.sel, b.marque)}`;
  } else {
    const g = model.g.get(id);
    if (!g) return false;
    const under = model.brandsUnder.get(id) || [];
    const parents = model.chain(id).slice(1);
    const filles = model.groupes.filter((x) => x.groupe_parent === id);
    const detient = model.groupes.filter((x) => x.actionnaires?.some((a) => a.id === id) && x.groupe_parent !== id);
    html = `<h3>${esc(g.nom)}</h3>
      ${g.aConfirmer ? '<p><span class="tag doute">à confirmer</span></p>' : ""}
      <p class="muted">${esc(g.description)}</p>
      ${g.note ? `<p>${esc(g.note)}</p>` : ""}
      <dl>
        <dt>Siège</dt><dd>${esc(paysLabel(g.pays_siege))}</dd>
        <dt>Statut</dt><dd>${esc(STATUT(ctx, g.statut))}</dd>
        <dt>Marques</dt><dd>${under.length}</dd>
      </dl>
      ${g.actionnaires?.length ? `<h4>Actionnaires</h4>${actionnaires(ctx, g)}` : ""}
      <p class="cpp" data-g="${esc(id)}" hidden></p>
      ${parents.length ? `<h4>Contrôlé par</h4>${chaine(ctx, parents)}` : ""}
      ${filles.length ? `<h4>Filiales</h4><p>${filles.map((f) => `<button class="lien" data-sel="g:${esc(f.id)}">${esc(f.nom)}</button>`).join(" · ")}</p>` : ""}
      ${detient.length ? `<h4>Participations</h4><p>${detient.map((f) => `<button class="lien" data-sel="g:${esc(f.id)}">${esc(f.nom)}</button>`).join(" · ")}</p>` : ""}
      ${under.length ? `<h4>Marques</h4><div class="marques">${under
        .slice(0, 80)
        .map((b) => `<button class="marque-btn" style="--c:${ctx.color(b.macroObj?.id)}" data-sel="m:${esc(b.id)}">${esc(b.marque)}</button>`)
        .join("")}${under.length > 80 ? `<span class="plus muted">+${under.length - 80}</span>` : ""}</div>
        <p><button class="lien" data-groupe="${esc(id)}">Filtrer toutes les vues sur ce groupe</button></p>` : ""}
      ${sources(g.sources)}
      ${signaler(ctx.state.sel, g.nom)}`;
  }
  el.innerHTML = `<button class="ghost ferme" type="button" aria-label="Fermer">×</button>` + html;
  if (type === "g") lienCpp(el, id);
  el.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.classList.contains("ferme")) ctx.select("");
    else if (t.dataset.sel) ctx.select(t.dataset.sel);
    else if (t.dataset.groupe) ctx.filterGroupe(t.dataset.groupe);
  };
  return true;
}
