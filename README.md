# ProjectorApp

Portfolio mobile **éditorial** qui présente les projets GitHub de `@nouhailler` —
applications Linux, web et mobiles. Conçu pour fonctionner comme une application mobile installable (PWA).

- **Accueil** : projet en vedette + section « Récemment ajoutés » + collections par rails
- **Index** : recherche plein-texte + filtres par collection
- **Fiche détail** : pitch, fonctionnalités clés, stack technique, galerie de captures, lien GitHub, éditeur de captures
- **Onglet Ajouter** :
  - **Synchroniser GitHub** — interroge l'API GitHub *en direct*, détecte les nouveaux dépôts et les fiches à rafraîchir, récupère README + captures, génère la fiche par IA
  - **Coller un README** — génération manuelle à partir d'un README collé

Aucun backend : tout tourne dans le navigateur (API GitHub + appels LLM directs).

Déployé en production sur Netlify en tant que **PWA** (installable, mode hors-ligne).

---

## Lancer en local

```bash
npm install
npm run dev        # serveur de développement → http://localhost:5173
npm run build      # build production dans dist/
npm run preview    # prévisualisation du build
```

> `ProjectorApp.html` est l'ancienne version Babel (conservée). L'application active utilise `index.html` + Vite.

---

## Architecture

| Fichier | Rôle |
|---|---|
| `index.html` | Shell HTML + design system CSS complet (variables, typographies, composants) |
| `vite.config.js` | Config Vite : plugin React, vite-plugin-pwa (Workbox), NetworkOnly pour les API tierces |
| `js/data.js` | **Catalogue socle** (33 projets vérifiés), 7 collections, mots-clés heuristiques |
| `js/components.jsx` | Atomes UI : `Icon`, `StatusBadge`, `KindBadge`, `Cover`, `Shot`, `Card`, `Row` |
| `js/screens.jsx` | Écrans : `HomeScreen`, `IndexScreen`, `DetailScreen`, `FeaturedHero` |
| `js/add.jsx` | **Moteur IA** : `callLLM` (4 fournisseurs), `buildFiche`, `fallbackFiche`, `AIConfig`, `PasteScreen` |
| `js/sync.jsx` | **GitHub** : `listRepos`, `fetchReadme`, `detectShots`, `extractReadmeImages`, `refreshFiche`, `SyncScreen`, `AddHub` |
| `js/app.jsx` | Racine : navigation, fusion socle ↔ fiches utilisateur, persistance |
| `assets/` | Icônes PWA, favicon, captures du socle |

Stack : **React 18** + **Vite 6** + **vite-plugin-pwa** (Workbox).  
Typographies : Instrument Serif, Newsreader, Manrope, JetBrains Mono (via CDN Bunny Fonts).

### Modèle d'un projet

```js
{
  id, name, repo, branch, private,
  cat,                                       // id de collection (voir CATEGORIES dans data.js)
  kind,                                      // "Web · PWA", "Bureau Linux", "Mobile"…
  year, tagline, pitch,
  features: [string],                        // fonctionnalités clés
  tech: [string],
  shots: [url],                              // raw.githubusercontent.com ou blob: pour dépôts privés
  featured?: bool,
  userAdded?: bool, source?: "ai"|"ai-refresh"|"fallback", baseline?: string
}
```

### Persistance (localStorage)

| Clé | Contenu |
|---|---|
| `projector.userProjects.v1` | Fiches ajoutées / rafraîchies (priment sur le socle, dé-dupliquées par dépôt) |
| `projector.ghToken` | Token GitHub (si « Mémoriser ») |
| `projector.baseline.v1` | `pushed_at` par dépôt → détection des mises à jour |
| `projector.ai.v1` | Config IA (fournisseur, clé, modèle) |

---

## Génération IA — fournisseurs

`callLLM(prompt, cfg)` dans `js/add.jsx` route vers l'un des 4 fournisseurs :

| Fournisseur | Endpoint | Notes |
|---|---|---|
| **OpenRouter** | `https://openrouter.ai/api/v1/chat/completions` | Clé `sk-or-…`. Bouton ↻ pour charger la liste des modèles gratuits (`:free`). |
| **Ollama** | `{baseUrl}/api/chat` | Local. Lancer avec `OLLAMA_ORIGINS=*` pour le CORS navigateur. |
| **Claude (Anthropic)** | `https://api.anthropic.com/v1/messages` | Clé `sk-ant-…`. Header `anthropic-dangerous-direct-browser-access: true` pour l'appel navigateur direct. |
| **Intégré** | `window.claude.complete` | Uniquement dans l'éditeur d'origine — pas disponible en déploiement autonome. |

---

## Captures d'écran (detectShots + extractReadmeImages)

Pour chaque dépôt synchronisé, l'app tente deux stratégies dans l'ordre :

1. **`detectShots`** (dépôts publics) : scanne l'arbre Git récursif (`/git/trees`), filtre les fichiers image > 12 Ko, exclut icônes/logos/builds, trie par pertinence (dossiers `screenshot`, `docs`, `media`…).
2. **`extractReadmeImages`** (repli) : parse le README à la recherche de balises `![](url)` et `<img src>`. Les chemins relatifs (`assets/img.png`) sont résolus en URL `raw.githubusercontent.com` absolues. Utilisé pour les dépôts privés (detectShots n'y a pas accès) et quand l'arbre ne contient pas d'images.

Pour l'affichage, `Cover` et `Shot` tentent d'abord l'URL directe. Si elle échoue et qu'un token GitHub est mémorisé, ils passent par **`fetchPrivateShot`** :

- `raw.githubusercontent.com` ne supporte pas le CORS pour les requêtes authentifiées (pas de `Access-Control-Allow-Headers: Authorization` sur le preflight) — un `fetch()` direct avec `Authorization` est donc bloqué silencieusement par le navigateur.
- La solution : convertir l'URL raw en `https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}` avec `Accept: application/vnd.github.raw+json`, qui supporte explicitement le CORS + auth et retourne les octets bruts → blob URL.

> Le token GitHub doit être coché **« Mémoriser »** dans l'écran de synchro pour être disponible au moment du rendu des cartes.

---

## Déploiement

Le projet est déployé sur **Netlify** en connexion directe avec ce dépôt GitHub.

```toml
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"
```

Le Service Worker (Workbox) met en cache les assets statiques en cache-first et les API tierces en network-only.
