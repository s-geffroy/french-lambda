---
description: Revue complete de l'application par son equipe Claude (sous-agents et skills de .claude/), apres quelques questions sur l'objectif et le perimetre. Ne modifie rien ; livre docs/revue-<date>.md.
argument-hint: "[objectif ou perimetre, ex. « avant mise en prod, securite et tests »]"
---

Fais une revue complète de cette application en t'appuyant sur son équipe Claude : les sous-agents de .claude/agents/ et les skills qu'ils préchargent, listés dans .claude/team.yaml.

Précisions données avec la commande (peut être vide) : $ARGUMENTS

## 0. Règles

- C'est une revue, pas une correction : ne modifie aucun fichier de code, de configuration ou de specs. Le seul fichier que tu écris est le livrable de l'étape 6.
- Ne lis jamais .env ni aucun secret, et ne recopie aucune valeur sensible dans le rapport.

## 1. Comprendre

- Lis specs/ (s'il existe), README.md, CLAUDE.md, app.yaml, compose.yaml et .claude/team.yaml.
- Parcours l'arborescence et repère les points d'entrée.
- Regarde le dernier rapport docs/revue-*.md s'il en existe un : la revue d'aujourd'hui dira ce qui a été corrigé depuis.
- Donne-moi en 10 lignes : ce que fait l'application, sa pile technique, comment elle est servie, et ce qui te paraît le plus risqué.

## 2. Me poser des questions

Avant de déléguer quoi que ce soit, pose-moi tes questions avec l'outil de questions (AskUserQuestion) : une seule série, quatre questions au plus, avec des choix concrets tirés de ce que tu viens de lire. Ne repose pas ce que les précisions ci-dessus disent déjà.

- **Objectif** : avant une mise en production, état des lieux, après un gros changement, ou un problème précis (lequel ?).
- **Priorités** : les domaines de l'étape 3 à creuser en premier (choix multiple). Ne propose que ceux qui ont un objet ici.
- **Profondeur** : rapide (trois domaines prioritaires, un agent chacun) ou complète (tous les domaines).
- **Déjà connu** : des problèmes connus à ne pas remonter, ou des zones hors périmètre.

Si tu manques encore d'une information pour bien répartir le travail (un environnement que tu ne vois pas, une contrainte d'hébergement…), demande-la dans la même série. Ensuite, tiens-t'en à mes réponses.

## 3. Constituer l'équipe de revue

- Liste les sous-agents disponibles (nom, description, skills préchargés).
- Associe chacun aux domaines retenus, en n'utilisant que les agents qui existent.
- Un domaine retenu sans agent adapté, tu le traites toi-même, plus brièvement, en le signalant.
- Un domaine sans objet ici (pas de données personnelles, pas d'interface…), tu l'écartes en une phrase.
- Montre-moi ce plan d'affectation, puis lance la revue sans attendre.

Domaines :
- Fonctionnel : conformité aux specs, règles métier, cas limites.
- Code : structure, lisibilité, dette technique, erreurs non gérées.
- Tests : ce qui est testé, ce qui ne l'est pas, ce qu'il faut automatiser en premier.
- Interface et expérience : ergonomie, performances, mobile, accessibilité.
- Sécurité : entrées, authentification, en-têtes, dépendances, secrets dans le dépôt.
- Données : données personnelles, conservation, RGPD, sauvegardes.
- Exploitation : build, image Docker, configuration, journaux, reprise après incident.
- Documentation : README, specs, CLAUDE.md à jour avec le code.
- Visibilité (si l'application est publique) : référencement, contenus.

## 4. Déléguer

- Lance les sous-agents en parallèle quand leurs domaines sont indépendants.
- Donne à chacun le résumé de l'étape 1, mes réponses de l'étape 2, les fichiers à regarder et un périmètre précis.
- Rappelle-lui d'utiliser ses skills quand ils s'appliquent.
- Exige des constats vérifiables, pas des généralités : fichier et ligne, problème, impact, correction proposée, gravité (bloquant / important / mineur).

## 5. Consolider

- Supprime les doublons entre agents, ainsi que ce que j'ai déclaré connu ou hors périmètre.
- Vérifie toi-même dans le code chaque constat « bloquant » ou « important » avant de le garder ; écarte ce qui est faux et dis-le.
- Distingue ce qui est constaté de ce qui est supposé.

## 6. Livrable : docs/revue-<AAAA-MM-JJ>.md

1. Objectif et périmètre retenus (mes réponses), résumé en 10 lignes, état général.
2. Top 10 des actions, par ordre de priorité (gain / effort).
3. Constats par domaine, avec l'agent qui les a remontés.
4. Depuis la revue précédente (s'il y en a une) : ce qui est corrigé, ce qui reste.
5. Domaines écartés ou traités sans agent, et pourquoi.
6. Ce qui n'a pas pu être vérifié, et pourquoi.
7. Les agents ou skills qui ont manqué pour cette revue : l'administrateur les ajoute avec `workon agents`.

Ne commite pas. Montre-moi le résumé et le top 10, et on en discute avant toute correction.
