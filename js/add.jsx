/* ProjectorApp — moteur IA multi-fournisseurs + écran « Coller un README »
   Fournisseurs réels : OpenRouter (cloud) et Ollama (local), appelés
   directement depuis le navigateur. « Intégré » = assistant de l'éditeur
   (aperçu uniquement ; indisponible dans un déploiement autonome). */
import { useState } from 'react';
import { CATEGORIES, CAT_KEYWORDS } from './data.js';
import { Icon, StatusBadge, KindBadge, catOf, accentOf, tint, CAT_BY_ID } from './components.jsx';

const PROVIDERS = [
  { id: "builtin", label: "Intégré (aperçu)" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama" },
];

const AI_KEY = "projector.ai.v1";
const AI_DEFAULTS = {
  provider: "builtin", orKey: "", orModel: "meta-llama/llama-3.3-70b-instruct:free",
  ollamaUrl: "http://localhost:11434", ollamaModel: "llama3.2",
};
function getAIConfig() {
  try { return { ...AI_DEFAULTS, ...JSON.parse(localStorage.getItem(AI_KEY) || "{}") }; }
  catch (e) { return { ...AI_DEFAULTS }; }
}
function setAIConfig(c) { try { localStorage.setItem(AI_KEY, JSON.stringify(c)); } catch (e) {} }

function deriveRepo(url) {
  if (!url) return "";
  const m = url.trim().replace(/\/+$/, "").match(/([^\/]+?)(\.git)?$/);
  return m ? m[1] : url.trim();
}
function titleCase(slug) {
  const s = String(slug).replace(/[-_]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Nouveau projet";
}
function extractJSON(text) {
  if (!text) return null;
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
function guessCat(text) {
  const s = (text || "").toLowerCase();
  let best = null, score = 0;
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS || {})) {
    const n = kws.reduce((acc, k) => acc + (s.includes(k) ? 1 : 0), 0);
    if (n > score) { score = n; best = cat; }
  }
  return best || "creation";
}

/* Appel LLM unifié — dispatch selon le fournisseur */
async function callLLM(prompt, cfg) {
  cfg = cfg || getAIConfig();
  if (cfg.provider === "openrouter") {
    if (!cfg.orKey) throw new Error("Clé OpenRouter manquante");
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.orKey.trim(),
        "HTTP-Referer": location.origin, "X-Title": "ProjectorApp",
      },
      body: JSON.stringify({ model: cfg.orModel || AI_DEFAULTS.orModel, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) throw new Error("OpenRouter " + r.status);
    const j = await r.json();
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  }
  if (cfg.provider === "ollama") {
    const base = (cfg.ollamaUrl || AI_DEFAULTS.ollamaUrl).replace(/\/+$/, "");
    const r = await fetch(base + "/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.ollamaModel || AI_DEFAULTS.ollamaModel, messages: [{ role: "user", content: prompt }], stream: false }),
    });
    if (!r.ok) throw new Error("Ollama " + r.status);
    const j = await r.json();
    return (j.message && j.message.content) || "";
  }
  // builtin (aperçu)
  if (!(window.claude && window.claude.complete))
    throw new Error("Assistant intégré indisponible — choisissez OpenRouter ou Ollama.");
  return await window.claude.complete({ messages: [{ role: "user", content: prompt }] });
}

/* Fiche heuristique (repli sans IA / sans README) */
function fallbackFiche({ repo, url, desc, lang, isPrivate, branch }) {
  const text = `${repo} ${desc || ""}`;
  return {
    id: "user-" + repo.toLowerCase() + "-" + Date.now().toString(36),
    name: titleCase(repo), repo, branch: branch || "main", private: !!isPrivate,
    cat: guessCat(text), kind: lang || "Projet", year: String(new Date().getFullYear()),
    tagline: (desc || "Projet GitHub.").slice(0, 110),
    pitch: desc || "Fiche à compléter — ajoutez un README pour une présentation détaillée.",
    features: [], tech: lang ? [lang] : [], shots: [], userAdded: true, source: "fallback",
  };
}

/* Génération IA — partagée par le README collé, la synchro et le rafraîchissement */
async function buildFiche({ url, readme, cfg }) {
  const repo = deriveRepo(url) || "nouveau-projet";
  const catList = CATEGORIES.map(c => `${c.id} (${c.label})`).join(", ");
  const prompt =
`Tu es l'éditeur d'un portfolio de développeur. À partir du README d'un dépôt GitHub, rédige une fiche de présentation élégante et concise, EN FRANÇAIS.

Dépôt : ${url || "(URL non fournie)"}
Nom probable : ${titleCase(repo)}

README :
"""
${(readme || "").slice(0, 6000)}
"""

Choisis la collection la plus adaptée parmi : ${catList}.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :
{
  "name": "nom court de l'app",
  "tagline": "accroche d'une ligne, max 90 caractères",
  "pitch": "2 à 3 phrases qui décrivent ce que fait l'app et sa valeur",
  "features": ["3 à 5 fonctionnalités clés, courtes (max 8 mots chacune)"],
  "cat": "un des identifiants de collection ci-dessus (ex: sante)",
  "kind": "type de plateforme, ex: 'Web · PWA', 'Bureau Linux', 'Mobile'",
  "tech": ["3 à 5 technologies clés"]
}`;

  const raw = await callLLM(prompt, cfg);
  const data = extractJSON(raw);
  if (!data || !data.name) throw new Error("parse");
  const cat = CAT_BY_ID[data.cat] ? data.cat : guessCat(readme + " " + repo);
  return {
    id: "user-" + repo.toLowerCase() + "-" + Date.now().toString(36),
    name: String(data.name).slice(0, 40), repo, branch: "main", private: true,
    cat, kind: data.kind || "Web", year: String(new Date().getFullYear()),
    tagline: String(data.tagline || "").slice(0, 110),
    pitch: String(data.pitch || ""),
    features: Array.isArray(data.features) ? data.features.slice(0, 6).map(String) : [],
    tech: Array.isArray(data.tech) ? data.tech.slice(0, 6).map(String) : [],
    shots: [], userAdded: true, source: "ai",
  };
}

/* Contrôle de configuration IA réutilisable (Coller / Synchro) */
const AIConfig = ({ cfg, onChange }) => {
  const set = (k, v) => { const n = { ...cfg, [k]: v }; onChange(n); setAIConfig(n); };
  const [freeModels, setFreeModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  // Récupère les modèles gratuits (:free) depuis l'API OpenRouter
  async function refreshModels() {
    if (!cfg.orKey) return;
    setLoadingModels(true); setModelsError("");
    try {
      const r = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: "Bearer " + cfg.orKey.trim() }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      const free = (j.data || [])
        .filter(m => m.id.endsWith(":free"))
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, "fr"));
      setFreeModels(free);
      if (free.length === 0) setModelsError("Aucun modèle gratuit trouvé.");
    } catch (e) {
      setModelsError("Impossible de récupérer les modèles : " + e.message);
    } finally {
      setLoadingModels(false);
    }
  }

  return (
    <>
      <label className="field-label">Moteur de génération</label>
      <div className="seg">
        {PROVIDERS.map(pr => (
          <button key={pr.id} className={cfg.provider === pr.id ? "on" : ""} onClick={() => set("provider", pr.id)}>{pr.label}</button>
        ))}
      </div>
      {cfg.provider === "openrouter" && (
        <div className="fade-in">
          <input className="input" style={{ marginTop: 10 }} type="password" value={cfg.orKey}
            onChange={e => set("orKey", e.target.value)} placeholder="Clé API OpenRouter (sk-or-…)" />
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "stretch" }}>
            <input className="input" style={{ flex: 1 }} value={cfg.orModel}
              onChange={e => set("orModel", e.target.value)} placeholder="Modèle (ex: meta-llama/llama-3.3-70b-instruct:free)" />
            <button onClick={refreshModels} disabled={!cfg.orKey || loadingModels}
              title="Actualiser la liste des modèles gratuits"
              style={{ flex: "0 0 auto", padding: "0 14px", borderRadius: 12,
                border: "1px solid var(--line-2)", background: "rgba(255,255,255,.45)",
                cursor: cfg.orKey && !loadingModels ? "pointer" : "not-allowed",
                color: "var(--ink-2)", fontSize: 17, display: "flex", alignItems: "center" }}>
              {loadingModels
                ? <span className="spin" style={{ width: 13, height: 13, borderColor: "rgba(27,24,21,.2)", borderTopColor: "var(--ink-2)" }} />
                : "↻"}
            </button>
          </div>
          {modelsError && <p className="hint" style={{ color: "var(--accent)" }}>{modelsError}</p>}
          {freeModels.length > 0 && (
            <select className="input" style={{ marginTop: 8 }}
              value={freeModels.some(m => m.id === cfg.orModel) ? cfg.orModel : ""}
              onChange={e => { if (e.target.value) set("orModel", e.target.value); }}>
              <option value="">— {freeModels.length} modèles gratuits disponibles —</option>
              {freeModels.map(m => (
                <option key={m.id} value={m.id}>{m.name || m.id}</option>
              ))}
            </select>
          )}
          <p className="hint">Appel direct à l'API OpenRouter depuis le navigateur. La clé reste sur cet appareil.</p>
        </div>
      )}
      {cfg.provider === "ollama" && (
        <div className="fade-in">
          <input className="input" style={{ marginTop: 10 }} value={cfg.ollamaUrl}
            onChange={e => set("ollamaUrl", e.target.value)} placeholder="URL Ollama (http://localhost:11434)" />
          <input className="input" style={{ marginTop: 8 }} value={cfg.ollamaModel}
            onChange={e => set("ollamaModel", e.target.value)} placeholder="Modèle local (ex: llama3.2)" />
          <p className="hint">100 % local. Lancez Ollama avec <span className="mono">OLLAMA_ORIGINS=*</span> pour autoriser l'appel navigateur (CORS).</p>
        </div>
      )}
      {cfg.provider === "builtin" && (
        <p className="hint">Assistant de l'éditeur — pour l'aperçu uniquement. En déploiement autonome, choisissez OpenRouter ou Ollama.</p>
      )}
    </>
  );
};

/* Carte d'aperçu réutilisable */
const PreviewCard = ({ p }) => {
  const accent = accentOf(p);
  return (
    <div className="preview-card" style={{ "--accent": accent }}>
      <div className="pc-cover" style={{ background: tint(accent, 18), color: accent }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 52, lineHeight: .8 }}>{p.name[0].toLowerCase()}</span>
      </div>
      <div className="pc-body">
        <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: accent }}>
          {catOf(p).label}
        </div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, letterSpacing: "-.01em", margin: "8px 0 0" }}>{p.name}</div>
        <div className="ink2" style={{ fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.45, margin: "6px 0 0" }}>{p.tagline}</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", margin: "14px 0 0" }}>{p.pitch}</p>
        {p.features && p.features.length > 0 && (
          <ul className="feat-list" style={{ marginTop: 12 }}>
            {p.features.map((f, i) => (
              <li key={i} style={{ fontSize: 13, padding: "8px 0" }}><span className="mk">{String(i + 1).padStart(2, "0")}</span><span>{f}</span></li>
            ))}
          </ul>
        )}
        <div className="tech-wrap" style={{ marginTop: 14 }}>{p.tech.map(t => <span className="tech" key={t}>{t}</span>)}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 14 }}><StatusBadge p={p} /><KindBadge p={p} /></div>
      </div>
    </div>
  );
};

/* Écran « Coller un README » */
const PasteScreen = ({ onAdd, onOpen }) => {
  const [url, setUrl] = useState("");
  const [readme, setReadme] = useState("");
  const [cfg, setCfg] = useState(getAIConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);

  const canGen = readme.trim().length > 30 && !loading;

  async function generate() {
    setLoading(true); setError(""); setDraft(null);
    try { setDraft(await buildFiche({ url, readme, cfg })); }
    catch (e) { setError("Échec de la génération : " + e.message); }
    finally { setLoading(false); }
  }

  if (draft) {
    return (
      <div className="fade-in">
        <div style={{ padding: "8px 22px 0" }}>
          <span className="kicker" style={{ color: accentOf(draft) }}>✦ Fiche générée</span>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: 30, fontWeight: 500, letterSpacing: "-.02em", margin: "10px 0 4px" }}>Aperçu de la fiche</h1>
          <p className="hint">Relisez, puis ajoutez-la à votre portfolio.</p>
        </div>
        <div className="pad">
          <PreviewCard p={draft} />
          <button className="cta" onClick={() => { onAdd(draft); onOpen(draft); }}><Icon name="plus" size={18} /> Ajouter à mon portfolio</button>
          <button className="cta ghost" onClick={() => setDraft(null)}>Recommencer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in pad" style={{ paddingTop: 4 }}>
      <p className="hint" style={{ marginTop: 0 }}>
        Collez l'adresse d'un dépôt et son README — l'IA en rédige la fiche, choisit la collection, les fonctionnalités et les technologies.
      </p>
      <label className="field-label">Adresse du dépôt</label>
      <input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/nouhailler/mon-app" />
      <label className="field-label">README du dépôt</label>
      <textarea className="textarea" value={readme} onChange={e => setReadme(e.target.value)} placeholder="# Mon App&#10;&#10;Collez ici le contenu du README…" />
      <AIConfig cfg={cfg} onChange={setCfg} />
      {error && <p className="hint" style={{ color: "var(--accent)" }}>{error}</p>}
      <button className="gen-btn" disabled={!canGen} onClick={generate}>
        {loading ? <><span className="spin" /> Rédaction de la fiche…</> : <><Icon name="spark" size={17} /> Générer la fiche</>}
      </button>
      {!canGen && !loading && <p className="hint" style={{ textAlign: "center" }}>Collez un README pour activer la génération.</p>}
      <div className="bottom-space" />
    </div>
  );
};

export { buildFiche, fallbackFiche, callLLM, guessCat, deriveRepo, titleCase, getAIConfig, setAIConfig, AIConfig, PreviewCard, PasteScreen, PROVIDERS };
