#!/usr/bin/env python3
"""Valide docs/data/*.json avant publication.

Bibliothèque standard uniquement : le script tourne tel quel dans GitHub
Actions. Code de sortie 1 au premier jeu d'erreurs, avec la liste complète.
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data"
ISO2 = re.compile(r"^[A-Z]{2}$")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
TYPES_ACT = {"personne", "famille", "etat", "public", "fonds", "groupe", "flottant", "salaries", "societaires", "autre"}


def load(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def main():
    ref, groupes, marques = load("categories"), load("groupes"), load("marques")
    errors = []
    err = errors.append

    cats = {c["id"] for c in ref["categories"]}
    macros = {m["id"] for m in ref["macros"]}
    moments = {m["id"] for m in ref["moments"]}
    natures = {n["id"] for n in ref["natures"]}
    statuts = {s["id"] for s in ref["statuts"]}
    for c in ref["categories"]:
        if c["macro"] not in macros:
            err(f"categorie {c['id']} : macro inconnue {c['macro']}")

    gids = {}
    for g in groupes:
        gid = g.get("id", "?")
        if gid in gids:
            err(f"groupe {gid} : id en double")
        gids[gid] = g
        if not SLUG.match(gid):
            err(f"groupe {gid} : id non conforme")
        for k in ("nom", "pays_siege", "statut"):
            if not g.get(k):
                err(f"groupe {gid} : champ {k} manquant")
        if g.get("pays_siege") and not ISO2.match(g["pays_siege"]):
            err(f"groupe {gid} : pays_siege {g['pays_siege']!r} n'est pas un code ISO alpha-2")
        if g.get("statut") and g["statut"] not in statuts:
            err(f"groupe {gid} : statut inconnu {g['statut']}")
        if not g.get("sources"):
            err(f"groupe {gid} : aucune source")
        total = 0.0
        for a in g.get("actionnaires", []):
            if not a.get("nom"):
                err(f"groupe {gid} : actionnaire sans nom")
            if a.get("type") not in TYPES_ACT:
                err(f"groupe {gid} : actionnaire {a.get('nom')} type inconnu {a.get('type')}")
            p = a.get("pays")
            if not p or not (ISO2.match(p)):
                err(f"groupe {gid} : actionnaire {a.get('nom')} sans nationalité ISO (pays={p!r})")
            pct = a.get("part_pct")
            if pct is not None:
                if not isinstance(pct, (int, float)) or not 0 <= pct <= 100:
                    err(f"groupe {gid} : part invalide {pct!r} pour {a.get('nom')}")
                else:
                    total += pct
        if total > 100.5:
            err(f"groupe {gid} : parts cumulées {total:.1f} % > 100 %")

    for g in groupes:
        gid = g["id"]
        if g.get("groupe_parent") and g["groupe_parent"] not in gids:
            err(f"groupe {gid} : groupe_parent inconnu {g['groupe_parent']}")
        for a in g.get("actionnaires", []):
            if a.get("id") and a["id"] not in gids:
                err(f"groupe {gid} : actionnaire id inconnu {a['id']}")
        seen, cur = set(), g
        while cur and cur.get("groupe_parent"):
            if cur["id"] in seen:
                err(f"groupe {gid} : cycle dans groupe_parent")
                break
            seen.add(cur["id"])
            cur = gids.get(cur["groupe_parent"])

    mids = set()
    for m in marques:
        mid = m.get("id", "?")
        if mid in mids:
            err(f"marque {mid} : id en double")
        mids.add(mid)
        for k in ("marque", "groupe", "categorie", "sous_categorie", "nature"):
            if not m.get(k):
                err(f"marque {mid} : champ {k} manquant")
        if m.get("groupe") not in gids:
            err(f"marque {mid} : groupe inconnu {m.get('groupe')}")
        if m.get("categorie") not in cats:
            err(f"marque {mid} : categorie inconnue {m.get('categorie')}")
        if m.get("nature") not in natures:
            err(f"marque {mid} : nature inconnue {m.get('nature')}")
        bad = set(m.get("moments", [])) - moments
        if bad or not m.get("moments"):
            err(f"marque {mid} : moments invalides {sorted(bad) or 'vide'}")
        if not m.get("sources"):
            err(f"marque {mid} : aucune source")

    if errors:
        print(f"{len(errors)} erreur(s) :", *errors, sep="\n  ")
        return 1
    print(f"OK : {len(groupes)} groupes, {len(marques)} marques, {len(cats)} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
