# Prompt pour Claude Code

> Copiez-collez ce message à Claude Code, une fois lancé dans le dossier `ProjectorApp/`.

---

Tu travailles dans **ProjectorApp**, mon portfolio mobile qui présente mes dépôts GitHub
(`@nouhailler`). C'est un site statique : **HTML + modules JS**, en **React 18 transpilé
par Babel dans le navigateur** (via CDN). Aucun build, aucun backend pour l'instant.

**Commence par lire `README.md`** (architecture, modèle de données, clés localStorage,
fournisseurs IA, limites connues), puis parcours les fichiers `js/*.jsx` et `js/data.js`
pour bien comprendre l'existant avant de toucher quoi que ce soit.

Pour tester : sers le dossier en HTTP (`python3 -m http.server 8000`) et ouvre
`ProjectorApp.html` (ne pas ouvrir en `file://`).

## Ce qui marche déjà
- Catalogue de mes projets (socle « vérifié » dans `js/data.js`) classé en 7 collections.
- Accueil (vedette + rails), Index (recherche + filtres), fiche détail (pitch,
  fonctionnalités clés, stack, galerie de captures, lien GitHub).
- **Synchro GitHub dynamique** (`js/sync.jsx`) : liste mes dépôts via l'API, détecte les
  **nouveaux** et les **mises à jour** (`pushed_at`), récupère README + captures
  (`detectShots`), génère/rafraîchit la fiche par IA.
- **Génération IA multi-fournisseurs** (`js/add.jsx`, `callLLM`) : OpenRouter, Ollama,
  et « intégré » (ce dernier ne marche que dans l'éditeur d'origine, pas en autonome).

## Contraintes à respecter
- Garde l'esthétique **éditoriale** : papier chaud `#F4EFE6`, encre `#1B1815`, accent par
  collection ; typos Instrument Serif / Newsreader / Manrope / JetBrains Mono. Le design
  system vit dans le `<style>` de `ProjectorApp.html` (variables CSS).
- Le **socle** `js/data.js` reste la source vérifiée ; la synchro ne fait qu'**ajouter /
  rafraîchir** par-dessus (fusion dé-dupliquée par dépôt dans `js/app.jsx`).
- Pas de secret en dur. Les tokens/clés restent côté utilisateur (localStorage) ou dans
  un `.env` si on introduit un build.

## Ce que j'aimerais faire ensuite (on en discute, propose un plan avant de coder)
1. **Passer en build de production** : migrer vers **Vite + React** (fin du Babel
   navigateur), garder la même structure de composants, scripts `dev`/`build`/`preview`.
2. **Captures des dépôts privés** : étendre `detectShots`/l'affichage pour charger les
   images privées via `fetch` authentifié → `blob:` (au lieu des URLs `raw` publiques).
3. **Déploiement** : publier sur Netlify en **PWA** (manifest + service worker, icône, mode
   hors-ligne pour le catalogue déjà chargé).
4. **Liste des modèles OpenRouter** : bouton « actualiser » qui récupère les modèles
   gratuits (`:free`) au lieu d'une saisie manuelle.
5. **Rafraîchir tout** : action « tout synchroniser » + indicateur des fiches obsolètes.
6. (Optionnel) **Petit proxy backend** pour masquer le token GitHub et les clés IA si je
   déploie l'app publiquement.

Propose-moi d'abord un plan court pour le point que je choisirai, puis implémente par
petites étapes vérifiables. Conserve un code lisible et commenté en français comme l'existant.
