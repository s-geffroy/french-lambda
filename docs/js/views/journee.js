import { esc } from "../fiche.js?v=dev";

const PAR_CAT = 14;
let mode = "jour";

// Frise du quotidien (moments de la journée) ou de l'année (saisons et
// fêtes). Dans chaque moment, une ligne par catégorie : le fast-food du midi
// ne se perd plus derrière les marques des gros groupes.
export function render(el, brands, ctx) {
  const { ref } = ctx.model;
  const annee = mode === "annee";
  const temps = annee ? ref.saisons || [] : ref.moments;
  const champ = annee ? "saisons" : "moments";
  el.innerHTML = `<h2>${annee ? "Une année du Français lambda" : "Une journée du Français lambda"}</h2>
    <div class="bascule" role="group" aria-label="Échelle de temps">
      <button type="button" data-mode="jour" aria-pressed="${!annee}">Une journée</button>
      <button type="button" data-mode="annee" aria-pressed="${annee}">Au fil de l'année</button>
    </div>
    <p class="intro">${annee
      ? "Saisons et fêtes : ce qu'on achète à Noël, à Pâques, à la rentrée ou l'été, et qui le vend."
      : "Chaque moment de la vie courante et les marques qu'on y croise, directement ou sans le savoir."} La pastille indique le poste de vie ; cliquer une marque ouvre sa fiche.</p>
    ${legende(ctx)}<div class="frise"></div>`;

  const frise = el.querySelector(".frise");
  const reste = new Map();
  const poids = (b) => ctx.model.brandsUnder.get(b.top.id)?.length || 0;
  for (const t of temps) {
    const list = brands.filter((b) => b[champ]?.includes(t.id));
    if (!list.length) continue;
    const parCat = new Map();
    for (const b of list) {
      if (!parCat.has(b.categorie)) parCat.set(b.categorie, []);
      parCat.get(b.categorie).push(b);
    }
    const cats = [...parCat].sort(
      (a, b) => (a[1][0].macroObj?.slot ?? 9) - (b[1][0].macroObj?.slot ?? 9) || b[1].length - a[1].length
    );
    const div = document.createElement("div");
    div.className = "moment";
    div.innerHTML = `<div class="h">${esc(t.heure || t.quand)}</div>
      <div class="c"><h3>${esc(t.label)} <span class="muted">· ${list.length}</span></h3>
      <div class="cats">${cats
        .map(([cat, bs]) => {
          const direct = (b) => (b.nature === "direct" ? 0 : 1);
          bs.sort((a, b) => direct(a) - direct(b) || poids(b) - poids(a) || a.marque.localeCompare(b.marque, "fr"));
          const cle = t.id + "/" + cat;
          reste.set(cle, bs.slice(PAR_CAT));
          return `<div class="cat"><span>${esc(ctx.model.cat.get(cat)?.label || cat)}</span><div class="marques">${bs
            .slice(0, PAR_CAT)
            .map((b) => btn(b, ctx))
            .join("")}${bs.length > PAR_CAT ? `<button class="lien plus" data-more="${esc(cle)}">+ ${bs.length - PAR_CAT}</button>` : ""}</div></div>`;
        })
        .join("")}</div></div>`;
    frise.append(div);
  }
  if (!frise.children.length)
    frise.innerHTML = `<p class="muted">${annee && !brands.some((b) => b.saisons?.length) ? "Les saisons et fêtes arrivent bientôt." : "Aucune marque pour ces filtres."}</p>`;

  el.onclick = (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.mode) {
      mode = t.dataset.mode;
      render(el, brands, ctx);
    } else if (t.dataset.sel) ctx.select(t.dataset.sel);
    else if (t.dataset.more) {
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
