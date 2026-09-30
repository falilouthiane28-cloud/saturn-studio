# Saturn Studio

Studio de 6 employés IA (Next.js 16, React 19, AI SDK). En ligne : https://209-74-71-111.sslip.io

**À lire avant toute intervention :**
- [`memory.md`](memory.md) : règles dures (6 agents, violet, français, Instagram en brouillon seulement, Orbi sans jambes) et pièges techniques.
- [`projet.md`](projet.md) : stack, emplacement, architecture, production.
- [`progress.md`](progress.md) : où on en est et prochaines étapes.

## Lancer en local
```bash
npm run dev                          # http://localhost:3000
node --test src/lib/instagram/tests/ # tests du pack Instagram (Node 24)
```

## Déployer
```bash
ssh -i ~/.ssh/spaceship_vps -p 22022 root@209.74.71.111
cd /srv/saturn && git pull && docker compose up -d --build
```
Secrets uniquement dans `.env.local` sur le serveur, jamais dans git.

## Montage vidéo
Le rendu se fait sur le PC : lancer `C:\Users\fallo\dev\video-studio\demarrer.bat`.
