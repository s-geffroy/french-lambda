#!/usr/bin/env python3
"""Relevé de veille : ce qu'il faut revérifier dans docs/data/.

Bibliothèque standard uniquement. Écrit un rapport Markdown sur la sortie
standard ; le workflow veille.yml en fait une issue chaque trimestre.
"""
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data"
SITE = "https://s-geffroy.github.io/french-lambda/"
# Même détection que le site (docs/js/data.js) : ces mots affichent « à confirmer ».
DOUTE = re.compile(r"confirmer|incertain|non v[ée]rifi|non rev[ée]rifi|de m[ée]moire|en cours|annoncée?(?![a-zà-ÿs])|[àa] v[ée]rifier", re.I)
OPERATION = re.compile(r"annonc|en cours|finalis|attendue?|prévue?|OPA|rachat|cession|sign[ée]", re.I)
LIMITE = 40


def load(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def mois_ecoules(date_, ref):
    """Mois écoulés depuis "AAAA", "AAAA-MM" ou "AAAA-MM-JJ" (une année seule compte pour décembre)."""
    parts = date_.split("-")
    a, m = int(parts[0]), int(parts[1]) if len(parts) > 1 else 12
    return (ref.year - a) * 12 + ref.month - m


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
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
