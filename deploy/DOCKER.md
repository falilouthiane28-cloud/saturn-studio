# Déploiement Docker — Saturn Studio (+ VPSKIT)

Fichiers fournis (racine du repo) : `Dockerfile`, `.dockerignore`,
`docker-compose.yml`. Image basée `node:20-slim`, `next start` en prod.

## Où VPSKIT aide
Sur le VPS (Ubuntu), lance VPSKIT et utilise :
- **1) setup** → installe **Docker**, crée un utilisateur non-root, pare-feu.
- **5) security** → durcissement SSH/firewall.
Puis déploie l'app avec `docker compose` ci-dessous (méthode transparente).
VPSKIT reste facultatif : ces étapes se font aussi à la main.

## 1. Récupérer le code + secrets
```bash
git clone https://github.com/falilouthiane28-cloud/saturn-studio.git
cd saturn-studio
cp naiom-platform/.env.production.example naiom-platform/.env.local
nano naiom-platform/.env.local   # vraie clé ANTHROPIC + GOOGLE_REDIRECT_URI de prod + TikTok
```

## 2. Build + run
```bash
docker compose up -d --build
docker compose logs -f          # vérifier le démarrage (Ctrl-C pour quitter)
```
L'app écoute sur **127.0.0.1:3000** (pas exposée directement).

## 3. Façade HTTPS
- Soit **nginx** : utilise `deploy/nginx-saturn-studio.conf` (cf. DEPLOY.md §10-11 + certbot).
- Soit **Caddy** (installé par VPSKIT) : un reverse_proxy vers `127.0.0.1:3000`
  suffit, HTTPS automatique. Exemple `/etc/caddy/Caddyfile` :
  ```
  ton-domaine.com {
      reverse_proxy 127.0.0.1:3000
  }
  ```

## 4. Google OAuth en prod
Ajoute dans Google Cloud l'URI autorisée :
`https://ton-domaine/api/integrations/google/callback`
(doit être identique à `GOOGLE_REDIRECT_URI` du `.env.local`).

## Mettre à jour
```bash
cd saturn-studio && git pull
docker compose up -d --build     # rebuild + redéploie
```

## Données persistantes (volumes)
Tokens Google, données live et livrables vivent dans des **volumes Docker
nommés** (`saturn_data`, `saturn_content`, …) → conservés entre les redeploys.
Sauvegarde/restauration d'un volume :
```bash
docker run --rm -v saturn_data:/d -v $PWD:/b busybox tar czf /b/saturn_data.tgz -C /d .
```

## Notes
- Les **secrets ne sont pas dans l'image** (exclus par `.dockerignore`) : ils
  sont injectés au runtime via `env_file`. Ne commite jamais `.env.local`.
- `.claude/agents` est cuit dans l'image (frère de l'app) → `PATHS.agents` OK.
- Si le build échoue sur une dépendance native, remplace `node:20-slim` par
  `node:20` (image complète) dans le `Dockerfile`.
