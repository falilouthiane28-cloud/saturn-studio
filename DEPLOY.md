# Déployer Saturn Studio sur un VPS

Guide complet : du serveur vide à l'app en ligne en HTTPS. Architecture visée
(celle de la page « Héberger » du projet) : **VPS Node + PM2 + nginx**.
Pas de serverless (Vercel) : l'app écrit sur disque (tokens Google, données
live, livrables) → il lui faut un serveur persistant.

---

## 0. Prérequis
- **Le repo est sur GitHub** (méthode `git clone`). Le commit `main` est prêt ;
  termine le push (`git push -u origin main`, cf. étape PAT).
- **Un nom de domaine** (recommandé pour HTTPS + OAuth Google). Sinon, l'IP du
  VPS marche pour tester, mais Google OAuth exige une URI de redirection stable.

## 1. Créer le VPS
Recommandation (rapport qualité/prix) :
- **Hetzner** CX22 (2 vCPU / 4 Go / ~4,50 €/mois) — idéal.
- ou **DigitalOcean** Droplet « Basic Regular » 2 Go/2 vCPU (~12 $/mois).
- ou **Contabo / OVH** équivalents.

À la création : **Ubuntu 24.04 LTS**, et ajoute ta **clé SSH** (sinon mot de
passe root envoyé par mail). Note l'**IP publique**.

> ⚠️ La création du compte et le paiement, c'est toi. Prends **≥ 2 Go de RAM** :
> le `npm run build` de Next peut manquer de mémoire en dessous (voir swap étape 4).

Fais pointer ton domaine vers l'IP : enregistrement **DNS A** `@` → `IP_DU_VPS`.

## 2. Première connexion + utilisateur non-root
```bash
ssh root@IP_DU_VPS
adduser saturn && usermod -aG sudo saturn
rsync --archive --chown=saturn:saturn ~/.ssh /home/saturn   # copie ta clé SSH
# reconnecte-toi en tant que saturn :
exit && ssh saturn@IP_DU_VPS
```

## 3. Pare-feu
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 4. (si RAM < 4 Go) Ajouter du swap pour le build
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 5. Installer Node LTS, git, PM2, nginx
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
node -v   # doit afficher v20+ 
```

## 6. Cloner le repo
```bash
cd ~
git clone https://github.com/falilouthiane28-cloud/saturn-studio.git
cd saturn-studio/naiom-platform
```
> La structure du repo préserve `saturn-studio/.claude/agents/` en frère de
> l'app → `PATHS.agents` se résout correctement, ne déplace rien.

## 7. Variables d'environnement (secrets)
```bash
cp .env.production.example .env.local
nano .env.local
```
Renseigne :
- `ANTHROPIC_API_KEY` = **vraie** clé `sk-ant-…` (sinon chat/orchestration KO).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (déjà les tiens).
- `GOOGLE_REDIRECT_URI` = `https://TON-DOMAINE/api/integrations/google/callback`.
- `TIKTOK_ACCESS_TOKEN`.

## 8. Installer les dépendances + build de production
```bash
npm ci
npm run build      # ✓ vérifié : compile proprement (~33 s en local)
```

## 9. Lancer avec PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # exécute la commande sudo qu'il affiche → survit au reboot
pm2 logs saturn-studio   # vérifier que ça tourne (Ctrl-C pour quitter)
```
L'app écoute maintenant sur `127.0.0.1:3000` (pas exposée directement).

## 10. nginx (reverse proxy)
```bash
sudo cp ~/saturn-studio/deploy/nginx-saturn-studio.conf /etc/nginx/sites-available/saturn-studio
sudo nano /etc/nginx/sites-available/saturn-studio   # remplace TON-DOMAINE
sudo ln -s /etc/nginx/sites-available/saturn-studio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
Teste : `http://TON-DOMAINE` doit afficher la landing.

## 11. HTTPS (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d TON-DOMAINE
```
Certbot réécrit la conf pour le 443 + renouvellement auto.

## 12. Autoriser l'URI de redirection Google en prod
Google Cloud → *Identifiants → ton client OAuth → URIs de redirection
autorisés* → ajoute :
```
https://TON-DOMAINE/api/integrations/google/callback
```
Puis, dans l'app en ligne : *Connexions → Connecter Google*.

---

## Mettre à jour (après un `git push`)
```bash
cd ~/saturn-studio && git pull
cd naiom-platform && npm ci && npm run build
pm2 reload saturn-studio
```

## Notes importantes
- **Données persistées sur disque** : `src/data/google-tokens.json`,
  `live-*.json`, et les dossiers de livrables vivent sur le serveur (hors git).
  Pense à les **sauvegarder** ; ne recrée pas le serveur sans les récupérer.
- **Mémoire du build** : si `npm run build` est tué (OOM) sur un petit VPS,
  ajoute le swap (étape 4) ou build en local puis `rsync` le dossier `.next`.
- **Régénération des avatars** : `scripts/build_avatars.py` lit des images
  sources locales (Windows) — inutile au runtime, les webp sont déjà dans
  `public/agents/`. À ne lancer que pour changer les mascottes.
