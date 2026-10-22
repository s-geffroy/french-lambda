// Contrôle du site avant publication : charge les modules comme le navigateur,
// construit le modèle à partir de docs/data et produit chaque fiche.
// validate_data.py vérifie les données ; ce script vérifie que le code les lit
// sans planter (une erreur ici donnerait une page blanche en ligne).
//
// Usage : node scripts/check_site.mjs   (Node 20+, aucune dépendance)
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const erreurs = [];
const err = (m) => erreurs.push(m);

// Le site lit ses JSON par fetch relatif à la page : on sert docs/ depuis le disque.
// Les correspondances de France-System-2026 sont remplacées par une donnée de
// test : on vérifie que la fiche sait les afficher, sans dépendre du réseau.
let CPP_TEST;
globalThis.fetch = async (u) => {
  if (/^https?:/.test(String(u))) {
    if (String(u).includes("ajout_correspondances_french_lambda.json")) return { ok: true, status: 200, json: async () => CPP_TEST };
    return { ok: false, status: 404, json: async () => ({}) };
  }
  const chemin = DOCS + String(u).split("?")[0];
  return { ok: true, status: 200, json: async () => JSON.parse(readFileSync(chemin, "utf-8")) };
};

// Même URL que les imports internes (« ./data.js?v=dev ») : une seule instance par module.
const mod = (chemin) => import(pathToFileURL(DOCS + chemin).href + "?v=dev");
const { loadData, applyFilters } = await mod("js/data.js");
const { renderFiche } = await mod("js/fiche.js");

// Chaque vue déclarée dans app.js existe, s'importe et exporte render().
const app = readFileSync(DOCS + "js/app.js", "utf-8");
const vues = [...app.match(/const VUES = \{([\s\S]*?)\};/)[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
const fichiers = readdirSync(DOCS + "js/views").map((f) => f.replace(/\.js$/, ""));
if (!vues.length) err("app.js : liste VUES introuvable");
for (const v of vues) {
  if (!fichiers.includes(v)) { err(`vue ${v} déclarée dans app.js sans fichier views/${v}.js`); continue; }
  try {
    const m = await mod(`js/views/${v}.js`);
    if (typeof m.render !== "function") err(`views/${v}.js n'exporte pas render()`);
  } catch (e) {
    err(`views/${v}.js ne s'importe pas : ${e.message}`);
  }
}

const model = await loadData();
const { brands, groupes } = model;
if (!brands.length || !groupes.length) err("modèle vide");
for (const b of brands) {
  const ou = `marque ${b.id}`;
  if (!b.top?.id) err(`${ou} : pas de contrôleur ultime`);
  if (b.chain?.[0]?.id !== b.groupe) err(`${ou} : la chaîne ne part pas de son exploitant`);
  if (!b.catObj || !b.macroObj) err(`${ou} : catégorie ou poste de vie introuvable`);
  if (!b.pays || !b.paysAct) err(`${ou} : pays du siège ou de l'actionnaire manquant`);
  if (typeof b.search !== "string" || !b.search) err(`${ou} : texte de recherche vide`);
}

// Chaque filtre, sur chacune de ses valeurs, s'applique sans erreur.
const valeurs = {
  macro: model.ref.macros.map((x) => x.id),
  cat: model.ref.categories.map((x) => x.id),
  nature: model.ref.natures.map((x) => x.id),
  statut: model.ref.statuts.map((x) => x.id),
  pays: [...new Set(brands.map((b) => b.pays))],
  groupe: [...new Set(brands.map((b) => b.top.id))],
  q: ["danone", "électricité", "zzz-introuvable"],
};
for (const [k, vs] of Object.entries(valeurs))
  for (const v of vs) {
    try {
      const n = applyFilters(model, { [k]: v }).length;
      if (n > brands.length) err(`filtre ${k}=${v} : plus de résultats que de marques`);
    } catch (e) {
      err(`filtre ${k}=${v} : ${e.message}`);
    }
  }

CPP_TEST = { correspondances: [{ actor_id: "FR-ACT-TEST", french_lambda_id: groupes[0].id, rapport: "entite_voisine", note: "note-test" }] };

// Chaque fiche, marque ou groupe, se construit.
const ctx = { model, state: { sel: "" }, color: () => "#000" };
const fiches = [...brands.map((b) => "m:" + b.id), ...groupes.map((g) => "g:" + g.id)];
for (const sel of fiches) {
  const el = {};
  ctx.state.sel = sel;
  try {
    if (!renderFiche(el, ctx) || !el.innerHTML) err(`fiche ${sel} vide`);
    else if (/undefined|NaN|\[object Object\]/.test(el.innerHTML)) err(`fiche ${sel} : valeur mal rendue (undefined, NaN…)`);
  } catch (e) {
    err(`fiche ${sel} : ${e.message}`);
  }
}

// Fiche d'un groupe relié à France-System-2026 : le lien et la note apparaissent.
{
  const zone = { hidden: true, innerHTML: "" };
  const id = groupes[0].id;
  const el = { querySelector: (s) => (s === `.cpp[data-g="${id}"]` ? zone : null) };
  ctx.state.sel = "g:" + id;
  renderFiche(el, ctx);
  await new Promise((r) => setTimeout(r, 10));
  if (zone.hidden || !zone.innerHTML.includes("acteurs/#FR-ACT-TEST") || !zone.innerHTML.includes("note-test"))
    err(`lien France-System-2026 absent de la fiche g:${id}`);
}

if (erreurs.length) {
  console.log(`${erreurs.length} erreur(s) :\n  ` + erreurs.slice(0, 50).join("\n  "));
  process.exit(1);
}
console.log(`OK : ${vues.length} vues, ${brands.length} marques, ${fiches.length} fiches construites`);
