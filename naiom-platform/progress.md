# Journal d'avancement — Saturn Studio

## Connecteurs des agents (26 sept. 2026) — étape 1 ✅
- ✅ Couche d'outils côté serveur (`src/lib/tools/`), permissions par agent, journal des appels.
- ✅ Outils : YouTube (ma chaîne, recherche), Instagram (reels par hashtag / par compte, via Apify), TikTok (tendances via Apify), Gmail (boîte, **envoi sur approbation**), Drive, Fireflies.
- ✅ Carte d'approbation dans le chat pour toute action d'écriture ; testé : refus → email jamais envoyé (vérifié dans le journal).
- ✅ Testé sur comptes réels : Léa (vrais chiffres YouTube), Nina (top TikTok #skincareroutine, 42 s).
- ⚠️ `TIKTOK_ACCESS_TOKEN` refusé par l'API officielle TikTok (`access_token_invalid`) → publication TikTok impossible en l'état.
- 🔜 **Étape 2** : publication sur les réseaux (LinkedIn conseillé en premier ; Instagram = compte Business + revue Meta ; TikTok = Content Posting API ; X = API payante ; ou hub type PostEverywhere). En attente du choix de l'utilisateur.

## Mise en ligne sécurisée (26 sept. 2026) ✅
- ✅ VPS Spaceship + Docker, **https://209-74-71-111.sslip.io** (Caddy + Let's Encrypt), port 3000 fermé, pare-feu ufw.
- ✅ Page de connexion de l'app (remplace l'authentification HTTP de Caddy, qui ouvrait une popup sur l'accueil à cause du prefetch). Anti force brute (5 essais / 15 min), redirections relatives, déconnexion.
- 🔜 Ajouter dans Google Cloud Console l'URI `https://209-74-71-111.sslip.io/api/integrations/google/callback`, puis reconnecter Google sur le serveur.
- 🔜 Nom de domaine propre (ex. acheté chez Spaceship) → une ligne à changer dans le Caddyfile.

## Refonte UI (25-26 sept. 2026) ✅
- ✅ Agents renommés : Ousmane → **Fallou**, Cheikh → **Basse** (UI, prompts, PDF, docs).
- ✅ Thème clair par défaut, fondu au basculement.
- ✅ Footer unique (`SiteFooter`), liens morts retirés ; logo officiel partout.
- ✅ Bannières des mascottes sans couture (dégradé du décor + figurine en fondu).
- ✅ Mobile : barre d'onglets en bas + feuille « Plus », sélecteur des 6 agents, cartes équipe lisibles en sombre.
- ✅ Emojis d'interface → icônes Lucide ; registre d'icônes (103 au lieu de toute la lib).
- ✅ Bugs corrigés : rotateur du hero vide, nav mobile hors écran, en-tête de fiche agent transparent.

## Refonte navigation / dashboard (22 sept. 2026)
- ✅ **Bug de chevauchement corrigé.** Avant : le Studio empilait DEUX couches de chrome — la pilule flottante `AppNav` (`fixed`, sur fond transparent) + une `TopBar` collante translucide. Au scroll, les bannières des cartes remontaient autour du logo et sous la TopBar → collision « très peu pro ».
- ✅ **Nouvelle Studio bar** (`.studio-bar` dans `theme.css`, `AppNav.tsx` réécrit) : UNE seule barre pleine largeur, collante EN FLUX, matériau translucide (blur + saturate, bord haut clair, fallbacks `prefers-reduced-transparency`/`-motion`). Logo à gauche, onglets défilables au centre (pilule violette active), actions globales (notifications, thème, réglages) à droite — jadis dans la TopBar, désormais cohérentes sur toutes les pages internes.
- ✅ `TopBar.tsx` retiré du dashboard ; statut (« N agents en ligne », emails urgents) replié dans l'en-tête de contenu. Spacers `h-[76px]` supprimés (calendrier, settings) car la barre est maintenant en flux.
- ✅ Vérifié en live : desktop + mobile (375px) + scroll + zéro erreur console. Le contenu passe proprement sous la barre, plus aucune collision.
- ℹ️ La landing garde sa pilule flottante (`LandingNav`) : la Studio bar est donc distincte du site vitrine, comme demandé.
- ✅ (traité depuis) contraste des avatars sombres, onglet actif mobile, micro-animations.

## État actuel (22 sept. 2026)
- ✅ **App propre et fonctionnelle** : `C:\Users\fallo\dev\naiom-platform`, servie sur **http://localhost:3000**.
- ✅ Rendu conforme à la cible : hero « Salut, on est Saturn Studio ! », **« 6 employés IA en ligne · 0 livrables »**, CTA « Entrer dans le studio », zéro erreur console.
- ✅ 6 agents partout (landing, `/#equipe`, dashboard, routes `/agents/<slug>`), compte dérivé de la vraie liste.
- ✅ (résolu depuis) vraie clé Anthropic en place, chat actif.

## Chronologie
1. **Signalement** : « retour des agents fantômes / 14 employés IA », hero cassé, erreur React.
2. **Audit** : le vrai projet `dev\naiom-platform` était **déjà propre** (6 agents, compte dérivé, hero OK, 0 erreur). Vérifié en live.
3. **Cause identifiée** : un serveur `next dev` tournait depuis une **copie périmée** dans `Documents\AGENTS AI CLAUDE\Emma-ecommerce\...\naiom-platform` — c'est cette version buggée (14 agents via `ACTIVE_SLUGS`) qui s'affichait, pas l'app dev.
4. **Nettoyage (autorisé)** : suppression des 6 copies périmées de `Documents` (~1,2 Go). Le serveur de la copie Emma a été arrêté au passage. `img/` et `supabase_schema.sql` conservés.
5. **Restauration par l'utilisateur** : les 6 dossiers d'agents ont été **remis** dans `Documents` (à nouveau la version buggée à 14 agents — à ne pas lancer).
6. **Remise en service** : redémarrage propre du serveur dev sur le port 3000. Un 500 Turbopack (`next/font/google` Archivo) est apparu après purge partielle de `.next` → **corrigé par purge complète** `.next` + `node_modules/.cache` et suppression des serveurs en double. Landing = 200, rendu conforme.

## Important à retenir
- **Rien n'a été détruit dans le vrai projet.** `dev\naiom-platform` et les 6 modules `.claude/agents/*.md` sont intacts depuis le début.
- Les dossiers de `Documents\AGENTS AI CLAUDE\<Agent>` sont des **doublons périmés** : les lancer réintroduit les agents fantômes. La version de référence est `dev\naiom-platform`.

## Prochaines étapes (suggestions)
- [x] Vraie clé Anthropic en place.
- [ ] Décider du sort des doublons `Documents` (les relancer = bug ; option : les supprimer à nouveau ou les ignorer). Une coquille vide `Emma-ecommerce\...\naiom-platform` d'un ancien nettoyage peut subsister, verrouillée par un handle OS — part au reboot.
- [ ] Corriger les icônes de marque manquantes dans `src/app/install/page.tsx` (`Apify`, `Fireflies`) — cf. piège lucide-react.
