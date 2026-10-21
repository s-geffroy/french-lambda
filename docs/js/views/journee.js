import { esc } from "../fiche.js";

const MAX = 40;

// Frise : chaque moment de la journée et les marques qu'on y croise.
export function render(el, brands, ctx) {
  const { ref } = ctx.model;
  el.innerHTML = `<h2>Une journée du Français lambda</h2>
    <p class="intro">Chaque moment de la vie courante et les marques qu'on y croise, directement ou sans le savoir. La pastille indique le poste de vie ; cliquer une marque ouvre sa fiche.</p>
    ${legende(ctx)}<div class="frise"></div>`;
  const frise = el.querySelector(".frise");
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
      <div class="marques">${list.map((b, i) => btn(b, ctx, i >= MAX)).join("")}
      ${list.length > MAX ? `<button class="lien plus" data-more>Voir les ${list.length - MAX} autres</button>` : ""}</div></div>`;
    frise.append(div);
  }
  if (!frise.children.length) frise.innerHTML = '<p class="muted">Aucune marque pour ces filtres.</p>';
  el.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.sel) ctx.select(t.dataset.sel);
    if (t.hasAttribute("data-more")) {
      t.parentElement.querySelectorAll("[hidden]").forEach((x) => (x.hidden = false));
      t.remove();
    }
  };
}

const btn = (b, ctx, hidden) =>
  `<button class="marque-btn" ${hidden ? "hidden" : ""} style="--c:${ctx.color(b.macroObj?.id)}" data-sel="m:${esc(b.id)}" title="${esc(b.top.nom)}">${esc(b.marque)}</button>`;

export function legende(ctx) {
  return `<div class="legende">${ctx.model.ref.macros
    .map((m) => `<span><i class="pastille" style="background:var(--s${m.slot})"></i>${esc(m.label)}</span>`)
    .join("")}</div>`;
}
