# Outil jetable : GitHub CLI + git, lance par 'sudo appctl run gh ...'.
# Aucun service permanent : profil 'cli' dans compose.yaml.
FROM alpine:3.22

RUN apk add --no-cache git github-cli ca-certificates openssh-client

# Clés d'hôte de GitHub figées dans l'image : SSH ne fait confiance qu'à elles.
COPY github_known_hosts /etc/ssh/ssh_known_hosts
RUN chmod 0644 /etc/ssh/ssh_known_hosts

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh

# Meme UID/GID que l'utilisateur proprietaire du depot sur l'hote : ce que
# l'outil ecrit dans /work reste a lui.
RUN addgroup -g 1019 app && adduser -D -u 1018 -G app app
USER app
WORKDIR /work

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
