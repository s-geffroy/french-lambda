import { esc } from "../fiche.js";

const MAX = 40;

// Frise : chaque moment de la journée et les marques qu'on y croise.
export function render(el, brands, ctx) {
  const { ref } = ctx.model;
  el.innerHTML = `<h2>Une journée du Français lambda</h2>
    <p class="intro">Chaque moment de la vie courante et les marques qu'on y croise, directement ou sans le savoir. La pastille indique le poste de vie ; cliquer une marque ouvre sa fiche.</p>
    ${legende(ctx)}<div class="frise"></div>`;
  const frise = el.querySelector(".frise");
  const reste = new Map();
  for (const m of ref.moments) {
    const list = brands.filter((b) => b.moments?.includes(m.id));
    if (!list.length) continue;
    // Les plus « gros » groupes d'abord : c'est eux qu'on croise le plus.
    const poids = (b) => ctx.model.brandsUnder.get(b.top.id)?.length || 0;
    list.sort((a, b) => (a.macroObj?.slot ?? 9) - (b.macroObj?.slot ?? 9) || poids(b) - poids(a));
    const div = document.createElement("div");
    div.className = "moment";
    div.innerHTML = `<div class="h">${esc(m.heure)}</div>
      <div class="c"><h3>${esc(m.label)} <span class="muted">· ${list.length}</span></h3>
      <div class="marques">${list.slice(0, MAX).map((b) => btn(b, ctx)).join("")}
      ${list.length > MAX ? `<button class="lien plus" data-more="${m.id}">Voir les ${list.length - MAX} autres</button>` : ""}</div></div>`;
    // Le reste n'entre dans le DOM que si on le demande.
    reste.set(m.id, list.slice(MAX));
    frise.append(div);
  }
  if (!frise.children.length) frise.innerHTML = '<p class="muted">Aucune marque pour ces filtres.</p>';
  el.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.sel) ctx.select(t.dataset.sel);
    if (t.dataset.more) {
      t.insertAdjacentHTML("beforebegin", reste.get(t.dataset.more).map((b) => btn(b, ctx)).join(""));
      t.remove();
    }
  };
}

const btn = (b, ctx) =>
  `<button class="marque-btn" style="--c:${ctx.color(b.macroObj?.id)}" data-sel="m:${esc(b.id)}" title="${esc(b.top.nom)}">${esc(b.marque)}</button>`;

export function legende(ctx) {
  return `<div class="legende">${ctx.model.ref.macros
    .map((m) => `<span><i class="pastille" style="background:var(--s${m.slot})"></i>${esc(m.label)}</span>`)
    .join("")}</div>`;
}
