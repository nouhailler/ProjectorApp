# ProjectorApp

Portfolio mobile **éditorial** qui présente les projets GitHub de `@nouhailler` —
applications Linux, web et mobiles. Conçu comme une application mobile (fonctionne
aussi très bien en plein écran sur téléphone), avec :

- un **Accueil** magazine : projet en vedette + collections en rails ;
- un **Index** : recherche plein-texte + filtres par collection ;
- une **fiche détail** : pitch, **fonctionnalités clés**, **stack technique**, galerie de captures, lien GitHub ;
- un onglet **Ajouter** avec deux mécaniques :
  - **Synchroniser GitHub** — interroge l'API GitHub *en direct*, détecte les **nouveaux dépôts** et les **fiches à rafraîchir** (dépôt modifié), récupère le README + les captures, et **génère la fiche par IA** ;
  - **Coller un README** — génération manuelle d'une fiche à partir d'un README collé.

Aucun backend : tout tourne dans le navigateur (API GitHub publique + appel LLM direct).

---

## Lancer en local

C'est un site statique. N'importe quel serveur de fichiers suffit :

```bash
# Python
python3 -m http.server 8000
# ou Node
npx serve .
```

Puis ouvrir `http://localhost:8000/ProjectorApp.html`.

> ⚠️ Ouvrir le fichier en `file://` peut bloquer le chargement des modules `js/*.jsx`
> (politique CORS du navigateur). Passez toujours par un serveur HTTP local.

---

## Architecture

| Fichier | Rôle |
|---|---|
| `ProjectorApp.html` | Shell HTML + **design system CSS** (variables, typographies, composants) + chargement des scripts |
| `js/data.js` | **Catalogue** des projets (socle vérifié), définition des 7 **collections**, mots-clés de classement heuristique |
| `js/components.jsx` | Atomes UI : `Icon`, `StatusBadge`, `KindBadge`, `Cover` (capture ↔ monogramme), `Shot`, `Card`, `Row` |
| `js/screens.jsx` | Écrans `HomeScreen`, `IndexScreen`, `DetailScreen`, `FeaturedHero` |
| `js/add.jsx` | **Moteur IA** : `callLLM` (multi-fournisseurs), `buildFiche`, `fallbackFiche`, `AIConfig`, `PreviewCard`, `PasteScreen` |
| `js/sync.jsx` | **GitHub** : `listRepos`, `fetchReadme`, `detectShots`, `refreshFiche`, `SyncScreen`, `AddHub` |
| `js/app.jsx` | Racine : navigation par onglets, fusion socle ↔ fiches utilisateur, persistance |
| `assets/shots/` | Captures importées des dépôts (socle) |

Stack : **React 18** + **Babel standalone** (transpilation dans le navigateur, via CDN).
Typographies : Instrument Serif (wordmark), Newsreader (titres), Manrope (UI), JetBrains Mono (slugs/tags).

### Modèle d'un projet

```js
{
  id, name, repo, branch, private,          // identité
  cat,                                       // id de collection (voir CATEGORIES)
  kind,                                      // "Web · PWA", "Bureau Linux", "Mobile"…
  year, tagline, pitch,
  features: [string],                        // fonctionnalités clés
  tech: [string],                            // stack
  shots: [url],                              // captures (URLs raw GitHub ou assets/)
  featured?: bool,
  userAdded?: bool, source?: "ai"|"ai-refresh"|"fallback", baseline?: pushed_at
}
```

### Persistance (localStorage)

| Clé | Contenu |
|---|---|
| `projector.userProjects.v1` | Fiches ajoutées / rafraîchies (priment sur le socle, dé-dupliquées par dépôt) |
| `projector.ghToken` | Token GitHub (si « mémoriser ») |
| `projector.baseline.v1` | `pushed_at` par dépôt → détection des mises à jour |
| `projector.ai.v1` | Config IA (fournisseur, clé, modèle) |

---

## Génération IA — fournisseurs

`callLLM(prompt, cfg)` dans `js/add.jsx` route vers :

- **OpenRouter** — `POST https://openrouter.ai/api/v1/chat/completions` (clé `sk-or-…`, modèle au choix). Appel navigateur direct.
- **Ollama** — `POST {baseUrl}/api/chat` (local). ⚠️ Lancer Ollama avec `OLLAMA_ORIGINS=*` pour autoriser l'appel depuis le navigateur (CORS).
- **Intégré** — `window.claude.complete`. **Disponible uniquement dans l'éditeur de design.** Dans un déploiement autonome, ce mode n'existe pas → utiliser OpenRouter ou Ollama.

---

## Limites connues / pistes

- **Captures des dépôts privés** : `detectShots` n'émet des URLs `raw.githubusercontent` que pour les dépôts **publics** (les privés exigeraient un proxy authentifié ou un `fetch` token → `blob:`). À implémenter pour couvrir le privé.
- **Babel navigateur** : pratique pour itérer, mais à **précompiler** (Vite) pour la production.
- **Token en localStorage** : acceptable pour un usage perso sur appareil de confiance ; pour un déploiement partagé, passer par un petit proxy backend.

Voir `CLAUDE_CODE_PROMPT.md` pour la suite.
