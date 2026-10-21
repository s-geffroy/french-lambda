// Chargement des données et index : marque -> groupe exploitant -> chaîne de
// contrôle (groupe_parent) -> contrôleur ultime.

export async function loadData() {
  const [ref, groupes, marques] = await Promise.all(
    ["categories", "groupes", "marques"].map((f) =>
      fetch(`data/${f}.json`).then((r) => {
        if (!r.ok) throw new Error(`data/${f}.json : HTTP ${r.status}`);
        return r.json();
      })
    )
  );
  return buildModel(ref, groupes, marques);
}

function buildModel(ref, groupes, marques) {
  const byId = (list) => new Map(list.map((x) => [x.id, x]));
  const g = byId(groupes);
  const cat = byId(ref.categories);
  const macro = byId(ref.macros);

  const chainCache = new Map();
  // Remonte groupe_parent jusqu'au sommet ; s'arrête sur un cycle ou un id inconnu.
  function chain(groupId) {
    if (chainCache.has(groupId)) return chainCache.get(groupId);
    const out = [];
    const seen = new Set();
    let cur = g.get(groupId);
    while (cur && !seen.has(cur.id)) {
      out.push(cur);
      seen.add(cur.id);
      cur = cur.groupe_parent ? g.get(cur.groupe_parent) : null;
    }
    chainCache.set(groupId, out);
    return out;
  }

  // Une fiche dont la note (ou celle d'un groupe de sa chaîne) exprime un doute.
  const DOUTE = /confirmer|incertain|non v[ée]rifi|non rev[ée]rifi|de m[ée]moire|en cours|annonc[ée]|[àa] v[ée]rifier/i;
  const douteux = (x) => DOUTE.test(x?.note || "") || DOUTE.test(x?.description || "");
  for (const x of groupes) x.aConfirmer = douteux(x);

  const brands = marques.map((m) => {
    const ch = chain(m.groupe);
    const top = ch[ch.length - 1] || { id: m.groupe, nom: m.groupe };
    const c = cat.get(m.categorie);
    return {
      ...m,
      groupeObj: g.get(m.groupe),
      chain: ch,
      top,
      catObj: c,
      macroObj: c ? macro.get(c.macro) : null,
      pays: top.pays_siege || "??",
      paysAct: paysActionnaire(top, g),
      aConfirmer: douteux(m) || ch.some((x) => x.aConfirmer),
      search: [m.marque, m.sous_categorie, ...ch.map((x) => x.nom), c?.label]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    };
  });

  // Marques par groupe, en comptant toute la descendance (Iliad compte Free).
  const brandsUnder = new Map();
  for (const b of brands)
    for (const x of b.chain) {
      if (!brandsUnder.has(x.id)) brandsUnder.set(x.id, []);
      brandsUnder.get(x.id).push(b);
    }

  return { ref, groupes, g, cat, macro, brands, chain, brandsUnder };
}

// Nationalité de l'actionnaire principal du contrôleur ultime (hors flottant) ;
// à défaut, le pays du siège du contrôleur lui-même.
function paysActionnaire(top, g) {
  const acts = (top.actionnaires || []).filter((a) => a.type !== "flottant");
  if (!acts.length) return top.pays_siege || "??";
  const a = acts.reduce((m, x) => ((x.part_pct ?? 0) > (m.part_pct ?? 0) ? x : m), acts[0]);
  const p = a.pays && a.pays !== "XX" ? a.pays : g.get(a.id)?.pays_siege;
  return p || top.pays_siege || "??";
}

export const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function applyFilters(model, f) {
  const q = f.q ? norm(f.q) : "";
  return model.brands.filter(
    (b) =>
      (!q || b.search.includes(q)) &&
      (!f.macro || b.macroObj?.id === f.macro) &&
      (!f.cat || b.categorie === f.cat) &&
      (!f.nature || b.nature === f.nature) &&
      (!f.statut || b.top.statut === f.statut) &&
      (!f.pays || b.pays === f.pays) &&
      (!f.groupe || b.chain.some((x) => x.id === f.groupe))
  );
}

const PAYS = new Intl.DisplayNames(["fr"], { type: "region" });
export function paysLabel(code) {
  try {
    return code && code !== "??" ? PAYS.of(code) : "Inconnu";
  } catch {
    return code;
  }
}
