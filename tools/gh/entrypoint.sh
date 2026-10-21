#!/bin/sh
# Le jeton vient du secret Docker, jamais d'une variable du .env ni d'un argument.
set -eu

secret=/run/secrets/gh_token
if [ ! -r "$secret" ]; then
  echo "gh : secret $secret illisible (absent, ou mode different de 0444 sur l'hote)" >&2
  exit 1
fi
GH_TOKEN=$(tr -d ' \r\n' < "$secret")
export GH_TOKEN

# git passe par gh pour s'authentifier en HTTPS ; le depot monte est le notre.
git config --global --add safe.directory /work
git config --global credential.https://github.com.helper '!gh auth git-credential'

case "${1:-}" in
  git) shift; exec git "$@" ;;
  *)   exec gh "$@" ;;
esac
