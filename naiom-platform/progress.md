# Journal d'avancement — Saturn Studio

## Refonte navigation / dashboard (22 sept. 2026)
- ✅ **Bug de chevauchement corrigé.** Avant : le Studio empilait DEUX couches de chrome — la pilule flottante `AppNav` (`fixed`, sur fond transparent) + une `TopBar` collante translucide. Au scroll, les bannières des cartes remontaient autour du logo et sous la TopBar → collision « très peu pro ».
- ✅ **Nouvelle Studio bar** (`.studio-bar` dans `theme.css`, `AppNav.tsx` réécrit) : UNE seule barre pleine largeur, collante EN FLUX, matériau translucide (blur + saturate, bord haut clair, fallbacks `prefers-reduced-transparency`/`-motion`). Logo à gauche, onglets défilables au centre (pilule violette active), actions globales (notifications, thème, réglages) à droite — jadis dans la TopBar, désormais cohérentes sur toutes les pages internes.
- ✅ `TopBar.tsx` retiré du dashboard ; statut (« N agents en ligne », emails urgents) replié dans l'en-tête de contenu. Spacers `h-[76px]` supprimés (calendrier, settings) car la barre est maintenant en flux.
- ✅ Vérifié en live : desktop + mobile (375px) + scroll + zéro erreur console. Le contenu passe proprement sous la barre, plus aucune collision.
- ℹ️ La landing garde sa pilule flottante (`LandingNav`) : la Studio bar est donc distincte du site vitrine, comme demandé.
- 🔎 Reste à traiter (à valider avec l'utilisateur) : contraste des avatars « sombres » (Fallou/Basse, casque noir peu lisible en petit sur fond sombre) ; auto-scroll de l'onglet actif sur mobile ; micro-animations (Phase 5).

## État actuel (22 sept. 2026)
- ✅ **App propre et fonctionnelle** : `C:\Users\fallo\dev\naiom-platform`, servie sur **http://localhost:3000**.
- ✅ Rendu conforme à la cible : hero « Salut, on est Saturn Studio ! », **« 6 employés IA en ligne · 0 livrables »**, CTA « Entrer dans le studio », zéro erreur console.
- ✅ 6 agents partout (landing, `/#equipe`, dashboard, routes `/agents/<slug>`), compte dérivé de la vraie liste.
- ⚠️ `ANTHROPIC_API_KEY` = placeholder 17 car. → chat + orchestration inactifs tant que non remplacée par une vraie clé `sk-ant-...` dans `dev\naiom-platform\.env.local`.

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
- [ ] Remplacer `ANTHROPIC_API_KEY` par une vraie clé pour activer chat + orchestration.
- [ ] Décider du sort des doublons `Documents` (les relancer = bug ; option : les supprimer à nouveau ou les ignorer). Une coquille vide `Emma-ecommerce\...\naiom-platform` d'un ancien nettoyage peut subsister, verrouillée par un handle OS — part au reboot.
- [ ] Corriger les icônes de marque manquantes dans `src/app/install/page.tsx` (`Apify`, `Fireflies`) — cf. piège lucide-react.
