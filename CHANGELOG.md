# Changelog

Tous les changements notables de ProjectorApp sont documentés ici.

---

## [1.2.1] — 2026-06-06

### Corrigé
- **Images dépôts privés** : `raw.githubusercontent.com` bloque silencieusement les requêtes `fetch()` avec header `Authorization` (pas de `Access-Control-Allow-Headers` sur le preflight OPTIONS). Ajout de `fetchPrivateShot` dans `components.jsx` qui convertit l'URL raw en appel `api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}` avec `Accept: application/vnd.github.raw+json` — ce endpoint supporte explicitement CORS + auth Bearer et retourne les octets bruts du fichier → blob URL.
- `Cover` et `Shot` n'utilisent cette route que pour les URLs `raw.githubusercontent.com` (les URLs externes ajoutées manuellement continuent d'être chargées directement).

---

## [1.2.0] — 2026-06-06

### Ajouté
- **Claude (Anthropic) — 4e fournisseur IA** : appel direct `POST /v1/messages` depuis le navigateur via le header `anthropic-dangerous-direct-browser-access: true`. Clé `sk-ant-…` et modèle configurables, stockés en localStorage.
- **Section « Récemment ajoutés »** sur l'écran d'accueil : rail horizontal regroupant toutes les fiches générées par l'utilisateur (`userAdded`), affiché avant les collections.
- **Extraction des captures depuis le README** (`extractReadmeImages`) : parse `![alt](url)` et `<img src>` ; résout désormais les **chemins relatifs** (`assets/img.png` → URL `raw.githubusercontent.com` absolue). Utilisé en repli quand `detectShots` ne trouve rien (dépôts privés, pas de dossier d'images).
- **Éditeur de captures dans la fiche détail** (dépôts `userAdded`) : champ URL + bouton `+` (ou Entrée) pour ajouter une capture, bouton `✕` pour supprimer. Persisté en localStorage.
- **Auth fetch universel pour les images** : `Cover` et `Shot` tentent un fetch authentifié (token GitHub localStorage) si l'image échoue, quelle que soit la visibilité du dépôt — couvre les dépôts privés *et* le rate-limit GitHub sur les publics.

### Modifié
- `extractReadmeImages` accepte désormais `owner`, `repo`, `branch` pour résoudre les URLs relatives.
- `Shot` : suppression du prop `isPrivate` devenu inutile (l'auth fetch est maintenant universel).
- `vite.config.js` : ajout de `api.anthropic.com` dans le pattern NetworkOnly du service worker.
- `CLAUDE_CODE_PROMPT.md` : mis à jour pour refléter l'état actuel de l'application.

---

## [1.1.0] — 2026-05-XX

### Ajouté
- **PWA Netlify** : manifest (`name`, `short_name`, `icons`, `display: standalone`), service worker Workbox (cache-first assets, network-only API), icônes 192 × 512 px + favicon 32 px.
- **`netlify.toml`** : commande de build, dossier `dist/`, headers `Cache-Control: no-cache` pour le SW et `Content-Type` pour le manifest.
- **Actualisation des modèles OpenRouter** : bouton `↻` dans `AIConfig` qui récupère les modèles gratuits (`:free`) via l'API OpenRouter et les présente dans un `<select>`.
- **Rafraîchir tout** : bouton « Rafraîchir les N obsolètes » dans `SyncScreen` pour relancer uniquement les fiches dont le `pushed_at` a changé.
- **Badge de count** sur l'onglet Ajouter : nombre de fiches obsolètes détectées à la dernière synchro.

### Modifié
- `detectShots` et `refreshFiche` : `extractReadmeImages` utilisé en repli quand aucune image n'est trouvée dans l'arbre Git.

---

## [1.0.0] — 2026-05-XX

### Refactorisé — migration Vite
- Suppression de Babel navigateur (CDN) et des `window.*` globals.
- Migration vers **Vite 6 + @vitejs/plugin-react** : ES modules natifs, HMR, build `dist/` haché.
- `index.html` remplace `ProjectorApp.html` comme point d'entrée Vite (l'original est conservé à titre d'archive).
- `package.json` avec scripts `dev`, `build`, `preview`.
- Tous les fichiers `js/*.jsx` convertis en ES modules avec `import`/`export` explicites.

---

## [0.5.0] — avant migration Vite

### Ajouté
- **Synchro GitHub dynamique** (`js/sync.jsx`) : `listRepos`, `fetchReadme`, `detectShots`, `refreshFiche`, détection des nouveaux dépôts et des mises à jour par `pushed_at` (baseline).
- **Génération IA** (`js/add.jsx`, `callLLM`) : OpenRouter, Ollama, Intégré (éditeur).
- Écran `PasteScreen` : génération de fiche depuis un README collé.
- Persistance des fiches utilisateur (`projector.userProjects.v1`) et de la baseline (`projector.baseline.v1`).

### Présent dès le début
- Catalogue socle de 33 projets dans `js/data.js` (7 collections).
- Écrans `HomeScreen` (vedette + rails), `IndexScreen` (recherche + filtres), `DetailScreen`.
- Design system éditorial : papier `#F4EFE6`, encre `#1B1815`, accents par collection, typographies Instrument Serif / Newsreader / Manrope / JetBrains Mono.
- `Cover` : capture ou monogramme de repli.
