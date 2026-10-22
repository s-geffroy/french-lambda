#!/usr/bin/env python3
"""Valide docs/data/*.json avant publication.

Bibliothèque standard uniquement : le script tourne tel quel dans GitHub
Actions. Code de sortie 1 au premier jeu d'erreurs, avec la liste complète.

    python3 scripts/validate_data.py [--avant REF]

--avant compare à la version publiée précédente (un commit git, par exemple
origin/main) : un identifiant de groupe publié qui disparaît doit figurer dans
docs/data/alias.json, et une entrée d'alias publiée ne se retire jamais.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "docs" / "data"
ISO2 = re.compile(r"^[A-Z]{2}$")
DATE = re.compile(r"^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
JOUR = re.compile(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
SIREN = re.compile(r"^\d{9}$")
LEI = re.compile(r"^[A-Z0-9]{18}\d{2}$")
MOTIFS = {"renommage", "fusion", "scission", "suppression"}
TYPES_ACT = {"personne", "famille", "etat", "public", "fonds", "groupe", "flottant", "salaries", "societaires", "autre"}


def load(name):
    with open(DATA / f"{name}.json", encoding="utf-8") as f:
        return json.load(f)


def luhn(n):
    """Clé de Luhn du SIREN (La Poste, 356000000, fait exception : somme des chiffres multiple de 5)."""
    if n == "356000000":
        return True
    t = 0
    for i, c in enumerate(reversed(n)):
        d = int(c) * (2 if i % 2 else 1)
        t += d - 9 if d > 9 else d
    return t % 10 == 0


def lei_ok(c):
    """Clé ISO 17442 (ISO 7064 MOD 97-10), comme un IBAN."""
    return int("".join(str(int(x, 36)) for x in c)) % 97 == 1


def identifiants(ou, x, err):
    """siren et lei facultatifs : format, clé de contrôle."""
    s, l = x.get("siren"), x.get("lei")
    if s is not None and not (isinstance(s, str) and SIREN.match(s) and luhn(s)):
        err(f"{ou} : siren {s!r} invalide (9 chiffres, clé de Luhn)")
    if l is not None and not (isinstance(l, str) and LEI.match(l) and lei_ok(l)):
        err(f"{ou} : lei {l!r} invalide (20 caractères, clé ISO 17442)")


def version_publiee(ref, nom):
    """Contenu de docs/data/<nom>.json au commit ref ; None s'il n'y existait pas."""
    r = subprocess.run(["git", "show", f"{ref}:docs/data/{nom}.json"], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 else None


def main():
    ref, groupes, marques = load("categories"), load("groupes"), load("marques")
    errors = []
    err = errors.append

    cats = {c["id"] for c in ref["categories"]}
    macros = {m["id"] for m in ref["macros"]}
    moments = {m["id"] for m in ref["moments"]}
    saisons = {x["id"] for x in ref.get("saisons", [])}
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
        identifiants(f"groupe {gid}", g, err)
        total = 0.0
        for a in g.get("actionnaires", []):
            if not a.get("nom"):
                err(f"groupe {gid} : actionnaire sans nom")
            if a.get("type") not in TYPES_ACT:
                err(f"groupe {gid} : actionnaire {a.get('nom')} type inconnu {a.get('type')}")
            p = a.get("pays")
            if not p or not (ISO2.match(p)):
                err(f"groupe {gid} : actionnaire {a.get('nom')} sans nationalité ISO (pays={p!r})")
            identifiants(f"groupe {gid} : actionnaire {a.get('nom')}", a, err)
            d = a.get("part_date")
            if d is not None and not (isinstance(d, str) and DATE.match(d)):
                err(f"groupe {gid} : actionnaire {a.get('nom')} part_date {d!r} n'est pas AAAA, AAAA-MM ou AAAA-MM-JJ")
            if d and a.get("part_pct") is None:
                err(f"groupe {gid} : actionnaire {a.get('nom')} a une part_date sans part_pct")
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
            elif a.get("id"):
                # Un actionnaire relié à un groupe porte les mêmes identifiants que lui.
                for k in ("siren", "lei"):
                    if a.get(k) and a[k] != gids[a["id"]].get(k):
                        err(f"groupe {gid} : actionnaire {a['id']} {k} {a[k]} différent de celui du groupe {a['id']}")
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
        bad = set(m.get("saisons", [])) - saisons
        if bad:
            err(f"marque {mid} : saisons inconnues {sorted(bad)}")
        if not m.get("sources"):
            err(f"marque {mid} : aucune source")

    # Un SIREN désigne une seule personne morale : deux groupes ne le partagent pas.
    par_siren = {}
    for g in groupes:
        if g.get("siren"):
            par_siren.setdefault(g["siren"], []).append(g["id"])
    for s_, ids in par_siren.items():
        if len(ids) > 1:
            err(f"siren {s_} : porté par plusieurs groupes {ids}")

    # Contrat d'identifiants : un groupe publié ne disparaît pas sans laisser d'adresse.
    alias = load("alias")
    if not isinstance(alias, dict):
        err("alias.json : doit être un objet {ancien-id: {nouvel, date, motif}}")
        alias = {}
    for anc, a in alias.items():
        ou = f"alias {anc}"
        if not isinstance(a, dict):
            err(f"{ou} : entrée qui n'est pas un objet")
            continue
        if set(a) - {"nouvel", "date", "motif", "note"}:
            err(f"{ou} : champs inconnus {sorted(set(a) - {'nouvel', 'date', 'motif', 'note'})}")
        if not SLUG.match(anc):
            err(f"{ou} : identifiant non conforme")
        if anc in gids:
            err(f"{ou} : l'ancien identifiant est aussi un groupe actif")
        nouv = a.get("nouvel", "absent")
        if nouv == "absent":
            err(f"{ou} : champ nouvel manquant (null si supprimé sans successeur)")
        elif nouv is not None and nouv not in gids:
            err(f"{ou} -> {nouv} : le nouvel identifiant n'existe pas dans groupes.json (s'il a été renommé à son tour, pointer vers l'identifiant actuel)")
        if a.get("motif") not in MOTIFS:
            err(f"{ou} : motif {a.get('motif')!r} hors liste {sorted(MOTIFS)}")
        elif (a["motif"] == "suppression") != (nouv is None):
            err(f"{ou} : nouvel est null si et seulement si le motif est suppression")
        if a.get("motif") == "scission" and not a.get("note"):
            err(f"{ou} : une scission indique les autres entités dans note")
        if not (isinstance(a.get("date"), str) and JOUR.match(a["date"])):
            err(f"{ou} : date {a.get('date')!r} n'est pas AAAA-MM-JJ")
    for anc in alias:
        vus, cur = [], anc
        while cur in alias and isinstance(alias[cur], dict):
            if cur in vus:
                err(f"alias {anc} : cycle {' -> '.join(vus + [cur])}")
                break
            vus.append(cur)
            cur = alias[cur].get("nouvel")
    if "--avant" in sys.argv:
        ref = sys.argv[sys.argv.index("--avant") + 1]
        avant = version_publiee(ref, "groupes")
        if avant is None:
            err(f"--avant {ref} : groupes.json illisible à cette version")
        else:
            for gid in sorted({g["id"] for g in avant} - set(gids) - set(alias)):
                err(f"groupe {gid} : identifiant publié supprimé sans entrée dans alias.json")
        anc_alias = version_publiee(ref, "alias")
        # L'ancien format ({"alias": [...]}) ne comptait aucune entrée publiée.
        if isinstance(anc_alias, dict) and not isinstance(anc_alias.get("alias"), list):
            for anc in sorted(set(anc_alias) - set(alias)):
                err(f"alias {anc} : une entrée publiée ne se retire jamais")

    if errors:
        print(f"{len(errors)} erreur(s) :", *errors, sep="\n  ")
        return 1
    print(f"OK : {len(groupes)} groupes, {len(marques)} marques, {len(cats)} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
