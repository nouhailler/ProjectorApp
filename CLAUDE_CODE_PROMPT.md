# Prompt pour Claude Code

> Copiez-collez ce message à Claude Code, une fois lancé dans le dossier `ProjectorApp/`.

---

Tu travailles dans **ProjectorApp**, mon portfolio mobile qui présente mes dépôts GitHub
(`@nouhailler`). C'est une application **React 18 + Vite 6**, déployée sur Netlify en tant
que **PWA** (manifest + Workbox). Aucun backend.

**Commence par lire `README.md`** (architecture, modèle de données, clés localStorage,
fournisseurs IA) pour bien comprendre l'existant, puis parcours les fichiers `js/*.jsx`
et `js/data.js` avant de toucher quoi que ce soit.

Pour tester en local : `npm run dev` → `http://localhost:5173`.

---

## Ce qui est implémenté

### Application & navigation
- Catalogue socle de 33 projets (`js/data.js`) classés en 7 collections.
- **Accueil** : carrousel « En vedette » + section **Récemment ajoutés** (fiches userAdded) + rails par collection.
- **Index** : recherche plein-texte + filtres par collection.
- **Fiche détail** : pitch, fonctionnalités clés, stack, galerie de captures, CTA **« Ouvrir l'application »** (primaire, conditionnel sur `p.live`), lien GitHub (secondaire `ghost`), bouton Rafraîchir, **éditeur de captures** (userAdded uniquement).

### Synchro GitHub (`js/sync.jsx`)
- `listRepos` : liste les dépôts via l'API GitHub (publics sans token, publics + privés avec token `repo`) ; expose `homepage` (champ « Website » du dépôt).
- `detectShots` : scanne l'arbre Git récursif, filtre les images > 12 Ko, exclut icônes/logos/builds.
- `extractReadmeImages` : parse `![](url)` et `<img src>` dans le README ; **résout les chemins relatifs** (`assets/img.png` → URL `raw.githubusercontent.com` absolue).
- Détection des fiches obsolètes (`pushed_at` vs baseline) + badge de count sur l'onglet Ajouter.
- Bouton « Rafraîchir les N obsolètes » en un clic.
- `refreshFiche` : régénère tagline, pitch, features, tech depuis le README ; conserve les captures existantes ; lit `meta.homepage` → `live` (préserve le hardcode du socle si le repo n'a pas de homepage GitHub).
- `runItems` (nouvelles fiches) : initialise `fiche.live` depuis `r.homepage`.

### Génération IA (`js/add.jsx`)
- `callLLM` route vers 4 fournisseurs : **OpenRouter**, **Ollama**, **Claude (Anthropic)**, **Intégré** (éditeur uniquement).
- `AIConfig` : sélecteur de fournisseur + champs clé/modèle par fournisseur + bouton ↻ pour charger les modèles gratuits OpenRouter.
- `buildFiche` : prompt structuré → JSON validé → fiche complète.
- `fallbackFiche` : repli sans IA (description GitHub + heuristiques).
- `PasteScreen` : génération manuelle depuis un README collé.

### Affichage des captures
- **`LiveBadge`** (`components.jsx`) : pastille « En ligne » (icône globe, couleur d'accent), affichée sur `Card` et `Row` quand `p.live` est défini. Cohérente avec `StatusBadge` / `KindBadge`.
- `Cover` et `Shot` tentent le chargement direct, puis `fetchPrivateShot` si l'image échoue.
- **`fetchPrivateShot`** : convertit une URL `raw.githubusercontent.com` en appel `api.github.com/repos/.../contents/...?ref=branch` avec `Accept: application/vnd.github.raw+json` — contourne le blocage CORS de raw.githubusercontent.com pour les requêtes authentifiées.
- Nécessite le token GitHub mémorisé en localStorage (`projector.ghToken`).
- Éditeur de captures dans `DetailScreen` (userAdded) : ajout d'URL, suppression, touche Entrée.

### PWA & déploiement
- `vite-plugin-pwa` (Workbox) : cache-first pour les assets, network-only pour les API tierces.
- `netlify.toml` : build `npm run build`, publish `dist/`, headers `Cache-Control` pour le SW.
- Icônes 192 × 512 + favicon.

---

## Contraintes à respecter

- Esthétique **éditoriale** : papier chaud `#F4EFE6`, encre `#1B1815`, accent par collection ; typos Instrument Serif / Newsreader / Manrope / JetBrains Mono. Le design system vit dans le `<style>` de `index.html`.
- Le **socle** `js/data.js` reste la source vérifiée ; la synchro ne fait qu'**ajouter / rafraîchir** par-dessus (fusion dé-dupliquée par dépôt dans `js/app.jsx`). Lors de la fusion, les champs optionnels présents dans le socle mais absents de la fiche localStorage (ex. `live`) sont **hérités automatiquement** au moment du render.
- **Pas de secret en dur.** Tokens et clés API restent en localStorage (côté utilisateur).

---

## Pistes restantes

- **Proxy backend léger** : pour masquer le token GitHub si l'app est déployée publiquement, ou pour contourner les CORS de certains modèles.
- **Partage de fiche** : générer un lien partageable (URL avec state encodé ou page statique générée).
- **Mode hors-ligne riche** : précacher le catalogue socle et les fiches utilisateur pour une consultation complète sans réseau.
- **Édition manuelle de fiche** : permettre de corriger le nom, la tagline, le pitch d'une fiche userAdded directement dans l'app.
