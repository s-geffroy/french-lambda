# french-lambda

Worker heberge sur le VPS multi-applications : du travail de fond, **aucune
surface HTTP**.

## Ou est le travail

`src/worker.py`, fonction `cycle()`. Tout le reste est la charpente :

| element | role |
|---|---|
| boucle | rappelle `cycle()` toutes les `WORKER_INTERVAL` secondes |
| battement | `/tmp/heartbeat`, touche a chaque tour, lu par le healthcheck |
| arret propre | SIGTERM honore, sommeil fractionne, fin du cycle en cours |
| `/state` | volume `french-lambda_state`, ce qui doit survivre a un redemarrage |

## Cycle de developpement

```bash
sudo -iu french-lambda
cd /srv/apps/french-lambda
claude
```

Puis, apres modification :

```bash
tests/test_smoke.sh      # un cycle, un battement, un arret propre
sudo appctl validate
sudo appctl rebuild
sudo appctl status       # le conteneur doit passer 'healthy'
sudo appctl logs -f      # c'est ici qu'on voit si le travail se fait
```

Un worker n'a pas d'URL a ouvrir : **les logs sont l'interface**. `status` dit
que la boucle tourne, `logs` dit que le travail se fait. Les deux sont
necessaires.

## Reglages

| variable | defaut | role |
|---|---|---|
| `WORKER_INTERVAL` | `30` | secondes entre deux cycles |
| `WORKER_STATE` | `/state` | repertoire d'etat (volume persistant) |
| `WORKER_HEARTBEAT` | `/tmp/heartbeat` | fichier de battement |

Le seuil du healthcheck (180 s dans `compose.yaml`) doit rester superieur a
deux fois `WORKER_INTERVAL`.

## Exposition

`app.yaml` le declare en `none` : le conteneur ne parle qu'au reseau interne de
l'application. Pour ouvrir une page de metriques ou une sonde :

```bash
sudo /opt/infra/scripts/app-exposure.py french-lambda --set worker=tailnet --port worker=9100
```

`app.yaml` et les labels Traefik sont mis a jour ensemble.

## Secrets

Les secrets reels vont dans `/etc/app-secrets/french-lambda/` (root uniquement),
jamais dans ce depot :

```bash
printf '%s\n' "<la cle>" | sudo tee /etc/app-secrets/french-lambda/api_key
sudo chmod 0444 /etc/app-secrets/french-lambda/api_key   # lisible dans le conteneur
```

et dans `compose.yaml` :

```yaml
    secrets:
      - api_key
    environment:
      API_KEY_FILE: /run/secrets/api_key

secrets:
  api_key:
    file: /etc/app-secrets/french-lambda/api_key
```

`0444` et non `0400` : le mode est reporte tel quel dans le conteneur, ou le
worker tourne en utilisateur non privilegie. Sur l'hote, c'est le repertoire
(0700 root) qui protege le secret.

## Site « Le Français lambda et ses entreprises »

Le dépôt porte aussi un site statique, publié par GitHub Pages, qui recense
les entreprises qu'un Français moyen croise au quotidien : marque → entreprise
exploitante → chaîne de contrôle → actionnaires (avec leur nationalité).
Il est indépendant du worker : rien ne tourne sur le VPS pour lui.

| chemin | rôle |
|---|---|
| `docs/data/categories.json` | postes de vie, catégories, moments de la journée, listes de référence |
| `docs/data/groupes.json` | entreprises, groupes, familles, États, fonds : siège, statut, actionnaires, parent |
| `docs/data/marques.json` | marques et services, rattachés à leur exploitant |
| `docs/index.html`, `docs/js/` | le site : journée type, liste, graphe, soleil, flux, carte, classement |
| `scripts/validate_data.py` | contrôle de cohérence, exécuté par GitHub Actions avant chaque publication |
| `scripts/check_site.mjs` | charge le code du site sur les données (vues, modèle, filtres, chaque fiche) : un plantage bloque la publication |
| `.github/workflows/pages.yml` | validation puis déploiement sur GitHub Pages |
| `scripts/veille.py`, `.github/workflows/veille.yml` | relevé trimestriel des fiches à revérifier, publié en issue « Veille » |
| `.github/ISSUE_TEMPLATE/correction.yml` | formulaire « Signaler une erreur », ouvert depuis chaque fiche du site |

Corriger ou ajouter une entrée : éditer les JSON, pousser sur `main`. Le
workflow refuse de publier si un identifiant est en double, une référence
cassée, une nationalité d'actionnaire absente ou une source manquante.

Tenir les données à jour :

- un visiteur signale une erreur depuis la fiche concernée : l'issue arrive
  avec l'étiquette `correction` et l'identifiant de la fiche ;
- le 1er janvier, avril, juillet et octobre, le workflow `veille` ouvre une
  issue qui liste les rachats et OPA non finalisés, les groupes douteux par
  nombre de marques touchées et les fiches vérifiées il y a plus de six mois.
  Il se lance aussi à la main : `sudo appctl run gh workflow run veille -R s-geffroy/french-lambda` ;
- une fiche porte « à confirmer » sur le site tant que sa note contient un mot
  de doute (`confirmer`, `non vérifié`, `en cours`, `annoncé`…) : on retire le
  mot quand le fait est établi, avec sa source.
