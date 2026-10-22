#!/usr/bin/env python3
"""Relevé de veille : ce qu'il faut revérifier dans docs/data/.

Bibliothèque standard uniquement. Écrit un rapport Markdown sur la sortie
standard ; le workflow veille.yml en fait une issue chaque trimestre.

    python3 scripts/veille.py [--cpp DOSSIER]

--cpp lit les fichiers de France-System-2026 dans un dossier local au lieu de
les télécharger (tests, ou travail hors ligne).
"""
import json
import re
import sys
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data"
SITE = "https://s-geffroy.github.io/french-lambda/"
# Même détection que le site (docs/js/data.js) : ces mots affichent « à confirmer ».
DOUTE = re.compile(r"confirmer|incertain|non v[ée]rifi|non rev[ée]rifi|de m[ée]moire|en cours|annoncée?(?![a-zà-ÿs])|[àa] v[ée]rifier", re.I)
OPERATION = re.compile(r"annonc|en cours|finalis|attendue?|prévue?|OPA|rachat|cession|sign[ée]", re.I)
LIMITE = 40
# France-System-2026 (dépôt s-geffroy/cpp) : registre fondé sur des sources
# primaires, qui relie certains de ses acteurs à nos groupes. Il sert de
# référence : ses chiffres sont signalés ici, jamais recopiés dans nos JSON.
CPP = "https://s-geffroy.github.io/cpp/"
ECART_MAX = 0.5
# Nos chaînes simplifiées (« État français (via TSA) ») et nos cumuls de
# détenteurs (« CDC et CNP Assurances ») ne se comparent pas aux liens
# directs, un détenteur à la fois, de France-System-2026.
SIMPLIFIE = re.compile(r"\bvia\b|\bet\b|\bdont\b|concert|\+", re.I)


def load(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def mois_ecoules(date_, ref):
    """Mois écoulés depuis "AAAA", "AAAA-MM" ou "AAAA-MM-JJ" (une année seule compte pour décembre)."""
    parts = date_.split("-")
    a, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 12
    return (ref.year - a) * 12 + ref.month - m


def fr(x):
    return f"{x:g}".replace(".", ",")


def charger_cpp(dossier=None):
    """Correspondances et liens de France-System-2026, depuis le site ou un dossier local."""
    def lire(nom):
        if dossier:
            return json.loads((Path(dossier) / f"{nom}.json").read_text(encoding="utf-8"))
        req = urllib.request.Request(f"{CPP}assets/donnees/{nom}.json", headers={"User-Agent": "french-lambda-veille"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)

    return lire("ajout_correspondances_french_lambda")["correspondances"], lire("ajout_liens")


def section_cpp(groupes, dossier=None):
    out = ["", "## Écarts avec France-System-2026", ""]
    try:
        corr, liens = charger_cpp(dossier)
    except Exception as e:  # le relevé doit sortir même si l'autre site ne répond pas
        return out + [f"France-System-2026 injoignable ({type(e).__name__} : {e}) : comparaison non faite."]
    g = {x["id"]: x for x in groupes}
    vers_cpp = {c["french_lambda_id"]: c for c in corr}
    # Lien direct le plus récent pour chaque couple (détenteur, société).
    directs = {}
    for l in liens:
        if l.get("type") != "equity_ownership":
            continue
        cle = (l["source_actor"], l["target_actor"])
        if cle not in directs or l.get("date_observation", "") > directs[cle].get("date_observation", ""):
            directs[cle] = l

    ecarts, non_comparables, concordants = [], [], 0
    for c in corr:
        societe = g.get(c["french_lambda_id"])
        if not societe:
            continue
        for a in societe.get("actionnaires", []):
            dc = vers_cpp.get(a.get("id"))
            if not dc:
                continue
            l = directs.get((dc["actor_id"], c["actor_id"]))
            tete = f"[{societe['nom']}]({SITE}#vue=liste&sel=g:{societe['id']}) — {a['nom']}"
            ref = (
                f"France-System-2026 {fr(l['detention_capital_pct'])} % au {l.get('date_observation', '?')} — {l['citation']['url']}"
                if l and l.get("detention_capital_pct") is not None else ""
            )
            if SIMPLIFIE.search(a["nom"]):
                non_comparables.append(f"- {tete} : chaîne ou cumul simplifiés chez nous{' ; ' + ref if ref else ''}")
            elif not l:
                non_comparables.append(f"- {tete} : aucun lien direct dans France-System-2026")
            elif l.get("detention_capital_pct") is None:
                non_comparables.append(f"- {tete} : part non publiée dans France-System-2026")
            elif a.get("part_pct") is None:
                non_comparables.append(f"- {tete} : part non renseignée chez nous ; {ref}")
            elif abs(a["part_pct"] - l["detention_capital_pct"]) > ECART_MAX:
                voisines = [x["french_lambda_id"] for x in (c, dc) if x.get("rapport") == "entite_voisine"]
                ecarts.append(
                    f"- {tete} : nous {fr(a['part_pct'])} % ({a.get('part_date') or 'date inconnue'}), {ref}"
                    + (f" (pour le compte de : {l['pour_compte']})" if l.get("pour_compte") else "")
                    + (f" — correspondance « entité voisine » pour {', '.join(voisines)}" if voisines else "")
                )
            else:
                concordants += 1

    out += [
        "Référence : registre fondé sur des sources primaires. Rien n'est recopié automatiquement :",
        "chaque écart est à examiner, et toute correction se fait à la main, avec sa source.",
        "",
        f"{len(corr)} groupes reliés · {concordants} parts concordantes (écart ≤ {fr(ECART_MAX)} point) · "
        f"{len(ecarts)} écarts · {len(non_comparables)} non comparables",
        "",
        "### Écarts de plus de 0,5 point",
        "",
    ]
    out += ecarts or ["Aucun."]
    out += ["", "### Non comparables", ""] + (non_comparables or ["Aucun."])
    rompus = [c for c in corr if c["french_lambda_id"] not in g]
    out += ["", "### Identifiants cités par France-System-2026 qui n'existent plus ici", ""]
    out += [f"- `{c['french_lambda_id']}` ← {CPP}acteurs/#{c['actor_id']} : lien cassé côté France-System-2026" for c in rompus] or [
        f"Aucun : les {len(corr)} identifiants reliés existent."
    ]
    return out


def main():
    groupes, marques = load("groupes"), load("marques")
    g = {x["id"]: x for x in groupes}

    def chaine(i):
        vus = []
        while i and i not in vus:
            vus.append(i)
            i = g[i].get("groupe_parent")
        return vus

    douteux = lambda x: bool(DOUTE.search(x.get("note") or "") or DOUTE.search(x.get("description") or ""))
    impact = Counter()
    for m in marques:
        for i in chaine(m["groupe"]):
            impact[i] += 1
    gd = sorted((x for x in groupes if douteux(x)), key=lambda x: -impact[x["id"]])
    md = [m for m in marques if douteux(m)]
    flag = sum(1 for m in marques if douteux(m) or any(douteux(g[i]) for i in chaine(m["groupe"])))
    ops = [x for x in gd + md if OPERATION.search(x.get("note") or "")]
    today = date.today()
    vieux = sorted(
        (x for x in groupes if x.get("verifie_le") and mois_ecoules(x["verifie_le"], today) >= 6),
        key=lambda x: (x["verifie_le"], -impact[x["id"]]),
    )

    parts = [(g_, a) for g_ in groupes for a in g_.get("actionnaires", []) if a.get("part_pct") is not None and a.get("type") != "flottant"]
    vieilles = sorted(
        ((g_, a) for g_, a in parts if not a.get("part_date") or mois_ecoules(a["part_date"], today) >= 24),
        key=lambda t: (t[1].get("part_date") or "", -impact[t[0]["id"]]),
    )

    nom = lambda x: x.get("nom") or x.get("marque")
    lien = lambda x, t: f"[{nom(x)}]({SITE}#vue=liste&sel={t}:{x['id']})"
    out = [
        f"Relevé du {today.isoformat()} : {len(marques)} marques, {len(groupes)} groupes.",
        "",
        f"- Marques affichées « à confirmer » : **{flag}** ({flag * 100 // max(len(marques), 1)} %)",
        f"- Groupes douteux : {len(gd)} · notes de marques douteuses : {len(md)}",
        f"- Groupes vérifiés il y a 6 mois ou plus : {len(vieux)}",
        f"- Pourcentages non datés ou mesurés il y a 2 ans ou plus : {len(vieilles)} sur {len(parts)}",
        "",
        "## Opérations à surveiller",
        "Rachats, OPA et cessions décrits comme non finalisés : vérifier s'ils ont abouti.",
        "",
    ]
    out += [f"- {lien(x, 'g' if 'nom' in x else 'm')} — {x['note']}" for x in ops[:LIMITE]] or ["Aucune."]
    if len(ops) > LIMITE:
        out.append(f"- … et {len(ops) - LIMITE} autres")
    out += ["", "## Groupes douteux, par nombre de marques touchées", ""]
    out += [f"- {lien(x, 'g')} ({impact[x['id']]} marques) — {x.get('note') or x.get('description') or ''}" for x in gd[:LIMITE]] or ["Aucun."]
    out += ["", "## Pourcentages à rafraîchir", "Non datés d'abord, puis du plus ancien au plus récent.", ""]
    out += [f"- {lien(g_, 'g')} — {a['nom']} : {a['part_pct']} % ({a.get('part_date') or 'date inconnue'})" for g_, a in vieilles[:LIMITE]] or ["Aucun."]
    if len(vieilles) > LIMITE:
        out.append(f"- … et {len(vieilles) - LIMITE} autres")
    out += ["", "## Fiches les plus anciennes", ""]
    out += [f"- {lien(x, 'g')} — vérifié le {x['verifie_le']} ({impact[x['id']]} marques)" for x in vieux[:LIMITE]] or ["Aucune fiche de plus de 6 mois."]
    dossier = sys.argv[sys.argv.index("--cpp") + 1] if "--cpp" in sys.argv else None
    out += section_cpp(groupes, dossier)
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
