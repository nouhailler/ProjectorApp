/* ProjectorApp — synchronisation dynamique avec l'API GitHub
   • Liste les dépôts en direct, détecte les nouveaux et les mises à jour
   • Détecte les captures d'écran dans l'arbre Git
   • Génère / rafraîchit les fiches (IA, repli description)
   Aucun backend : appels directs à l'API REST GitHub depuis le navigateur. */
import { useState, useMemo } from 'react';
import { OWNER } from './data.js';
import { Icon } from './components.jsx';
import { buildFiche, fallbackFiche, getAIConfig, AIConfig, PasteScreen } from './add.jsx';

const GH_TOKEN_KEY = "projector.ghToken";
const BASELINE_KEY = "projector.baseline.v1";

function getBaselines() { try { return JSON.parse(localStorage.getItem(BASELINE_KEY) || "{}"); } catch (e) { return {}; } }
function setBaselines(m) { try { localStorage.setItem(BASELINE_KEY, JSON.stringify(m)); } catch (e) {} }

async function ghGet(url, token, accept) {
  const headers = { Accept: accept || "application/vnd.github+json" };
  if (token && token.trim()) headers.Authorization = "Bearer " + token.trim();
  const r = await fetch(url, { headers });
  if (!r.ok) { const e = new Error("GitHub " + r.status); e.status = r.status; throw e; }
  return r;
}
async function listRepos(owner, token) {
  const url = (token && token.trim())
    ? "https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=updated"
    : `https://api.github.com/users/${owner}/repos?per_page=100&type=owner&sort=updated`;
  const arr = await (await ghGet(url, token)).json();
  return arr.map(x => ({
    name: x.name, owner: (x.owner && x.owner.login) || owner, desc: x.description || "",
    private: x.private, lang: x.language || "", branch: x.default_branch || "main",
    url: x.html_url, pushed: x.pushed_at, homepage: x.homepage || "",
  }));
}
async function fetchReadme(owner, repo, token) {
  try { return await (await ghGet(`https://api.github.com/repos/${owner}/${repo}/readme`, token, "application/vnd.github.raw")).text(); }
  catch (e) { return ""; }
}

/* Détection des captures via l'arbre Git récursif */
const IMG_RE = /\.(png|jpe?g|gif|webp)$/i;
const SHOT_HINT = /(screenshot|screens|capture|preview|docs\/|\/docs|demo|media|gallery|images?)/i;
const SHOT_BAD = /(node_modules|\/dist\/|\/build\/|packaging|deb_root|\.deb|android|ios|favicon|icon|logo|adaptive|splash|vite\.svg|react\.svg|apple-touch|maskable|mipmap)/i;
/* Extrait les URLs d'images présentes dans un README Markdown
   (balises ![alt](url) et <img src="…">) — utilisé en repli quand
   l'arbre Git ne contient pas de captures (dépôts privés ou pas d'images dans les assets). */
function extractReadmeImages(readme, owner, repo, branch) {
  if (!readme) return [];
  const seen = new Set();
  function addUrl(raw) {
    if (!raw) return;
    let url = raw;
    // Résoudre les chemins relatifs → URL raw GitHub absolue
    if (!/^https?:\/\//i.test(url) && owner && repo && branch) {
      const clean = url.replace(/^\.\//, "").replace(/^\//, "");
      if (!clean || clean.startsWith("..")) return;     // chemin trop complexe
      url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/` +
            clean.split("/").map(encodeURIComponent).join("/");
    }
    if (/^https?:\/\//i.test(url) && IMG_RE.test(url) && !SHOT_BAD.test(url))
      seen.add(url);
  }
  const mdRe   = /!\[[^\]]*\]\(([^\s)]+)/g;
  const htmlRe  = /<img[^>]+src=["']([^"'>]+)/gi;
  let m;
  for (const re of [mdRe, htmlRe]) {
    re.lastIndex = 0;
    while ((m = re.exec(readme)) !== null) addUrl(m[1]);
  }
  return [...seen].slice(0, 4);
}

async function detectShots(owner, repo, branch, token, isPrivate) {
  // Les URL raw.githubusercontent ne s'affichent pas pour les dépôts privés
  // sans proxy authentifié → on ne tente que pour les dépôts publics.
  if (isPrivate) return [];
  try {
    const j = await (await ghGet(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, token)).json();
    let files = (j.tree || []).filter(t => t.type === "blob" && IMG_RE.test(t.path) && !SHOT_BAD.test(t.path));
    files.sort((a, b) => {
      const as = SHOT_HINT.test(a.path) ? 1 : 0, bs = SHOT_HINT.test(b.path) ? 1 : 0;
      if (as !== bs) return bs - as;
      return (b.size || 0) - (a.size || 0);
    });
    files = files.filter(f => (f.size || 0) > 12000).slice(0, 4);
    return files.map(f => `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/` + f.path.split("/").map(encodeURIComponent).join("/"));
  } catch (e) { return []; }
}

/* Rafraîchir une fiche existante depuis GitHub (README + captures) */
async function refreshFiche(existing, opts) {
  opts = opts || {};
  const cfg = opts.cfg, token = opts.token;
  const owner = OWNER, repo = existing.repo, branch = existing.branch || "main";
  let pushed = existing.baseline || null, isPriv = !!existing.private;
  let homepage = existing.live || "";
  try { const meta = await (await ghGet(`https://api.github.com/repos/${owner}/${repo}`, token)).json(); pushed = meta.pushed_at; isPriv = meta.private; homepage = meta.homepage || homepage; }
  catch (e) {}
  const readme = await fetchReadme(owner, repo, token);
  let gen = null;
  if (readme && readme.length > 40) { try { gen = await buildFiche({ url: `https://github.com/${owner}/${repo}`, readme, cfg }); } catch (e) {} }
  let shots = (existing.shots && existing.shots.length)
    ? existing.shots
    : await detectShots(owner, repo, branch, token, isPriv);
  if (!shots.length) shots = extractReadmeImages(readme, owner, repo, branch);
  return {
    ...existing,
    ...(gen ? { tagline: gen.tagline, pitch: gen.pitch, features: gen.features, tech: gen.tech } : {}),
    name: existing.name, repo, branch, private: isPriv, shots,
    id: existing.id, userAdded: true, source: "ai-refresh", baseline: pushed,
    year: existing.year || String(new Date().getFullYear()),
    live: homepage,
  };
}

const SyncScreen = ({ projects, onAdd, onOpen, goHome, onPendingCount }) => {
  const [token, setToken] = useState(() => localStorage.getItem(GH_TOKEN_KEY) || "");
  const [remember, setRemember] = useState(() => !!localStorage.getItem(GH_TOKEN_KEY));
  const [cfg, setCfg] = useState(getAIConfig);
  const [phase, setPhase] = useState("idle");        // idle|listing|list|working|done
  const [error, setError] = useState("");
  const [repoCount, setRepoCount] = useState(0);
  const [items, setItems] = useState([]);            // {type:'new'|'up', r, proj?}
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState({});
  const [addedCount, setAddedCount] = useState(0);

  const existing = useMemo(() => new Map(projects.map(p => [p.repo.toLowerCase(), p])), [projects]);

  async function sync() {
    setPhase("listing"); setError("");
    try {
      const list = await listRepos(OWNER, token);
      if (remember && token.trim()) localStorage.setItem(GH_TOKEN_KEY, token.trim());
      if (!remember) localStorage.removeItem(GH_TOKEN_KEY);

      const baselines = getBaselines();
      const next = [];
      let seeded = false;
      for (const r of list) {
        const key = r.name.toLowerCase();
        const proj = existing.get(key);
        if (!proj) { next.push({ type: "new", r }); continue; }
        if (baselines[key] == null) { baselines[key] = r.pushed; seeded = true; }   // seed silencieux
        else if (baselines[key] !== r.pushed) { next.push({ type: "up", r, proj }); }
      }
      if (seeded) setBaselines(baselines);
      setRepoCount(list.length);
      setItems(next);
      setSelected(Object.fromEntries(next.map(it => [it.r.name, true])));
      setStatus({}); setPhase("list");
      // Remonte le nombre de fiches obsolètes pour le badge de l'onglet
      const upCnt = next.filter(it => it.type === "up").length;
      if (onPendingCount) onPendingCount(upCnt);
    } catch (e) {
      setError(e.status === 403
        ? "Limite d'appels GitHub atteinte (60/h sans token). Ajoutez un token pour 5 000/h et accéder aux dépôts privés."
        : e.status === 401 ? "Token GitHub invalide."
        : "Impossible de joindre GitHub. Vérifiez votre connexion (ou collez un README dans l'autre onglet).");
      setPhase("idle");
    }
  }

  // Traite une liste de dépôts sélectionnés (génération / rafraîchissement)
  async function runItems(toProcess) {
    setPhase("working");
    const baselines = getBaselines();
    let added = 0;
    for (const it of toProcess) {
      const r = it.r, key = r.name.toLowerCase();
      setStatus(s => ({ ...s, [r.name]: "working" }));
      try {
        let fiche;
        if (it.type === "up") {
          fiche = await refreshFiche(it.proj, { cfg, token });
        } else {
          const readme = await fetchReadme(r.owner, r.name, token);
          fiche = (readme && readme.length > 40)
            ? await buildFiche({ url: r.url, readme, cfg })
            : fallbackFiche({ repo: r.name, url: r.url, desc: r.desc, lang: r.lang, isPrivate: r.private, branch: r.branch });
          let shots = await detectShots(r.owner, r.name, r.branch, token, r.private);
          if (!shots.length) shots = extractReadmeImages(readme, r.owner, r.name, r.branch);
          fiche.shots = shots;
          fiche.private = r.private; fiche.branch = r.branch; fiche.baseline = r.pushed;
          fiche.live = r.homepage || "";
        }
        onAdd(fiche);
        baselines[key] = r.pushed;
        added++;
        setStatus(s => ({ ...s, [r.name]: "done" }));
      } catch (e) {
        setStatus(s => ({ ...s, [r.name]: "error" }));
      }
      await new Promise(res => setTimeout(res, 220));
    }
    setBaselines(baselines);
    setAddedCount(added); setPhase("done");
    if (onPendingCount) onPendingCount(0);
  }

  // Lance le traitement des fiches cochées par l'utilisateur
  async function run() { runItems(items.filter(it => selected[it.r.name])); }

  // Rafraîchit uniquement les fiches obsolètes (dépôts modifiés), sans toucher aux nouveaux
  async function runAllStale() {
    const staleOnly = items.filter(it => it.type === "up");
    setSelected(Object.fromEntries(items.map(it => [it.r.name, it.type === "up"])));
    runItems(staleOnly);
  }

  const toggle = (name) => setSelected(s => ({ ...s, [name]: !s[name] }));
  const selCount = items.filter(it => selected[it.r.name]).length;
  const newCount = items.filter(it => it.type === "new").length;
  const upCount = items.filter(it => it.type === "up").length;

  /* ── Done ── */
  if (phase === "done") {
    return (
      <div className="fade-in pad" style={{ paddingTop: 8 }}>
        <div style={{ textAlign: "center", padding: "30px 0 10px" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 56, color: "var(--accent)", lineHeight: 1 }}>✓</div>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 500, margin: "12px 0 0" }}>
            {addedCount} fiche{addedCount > 1 ? "s" : ""} mise{addedCount > 1 ? "s" : ""} à jour
          </h2>
          <p className="hint" style={{ textAlign: "center" }}>Nouveaux projets ajoutés et fiches existantes rafraîchies.</p>
        </div>
        <button className="cta" onClick={goHome}><Icon name="home" size={18} /> Voir l'accueil</button>
        <button className="cta ghost" onClick={() => { setPhase("idle"); setItems([]); }}>Synchroniser à nouveau</button>
        <div className="bottom-space" />
      </div>
    );
  }

  /* ── Listing ── */
  if (phase === "listing") {
    return (
      <div className="fade-in pad" style={{ textAlign: "center", padding: "60px 30px" }}>
        <span className="spin" style={{ borderColor: "rgba(27,24,21,.2)", borderTopColor: "var(--accent)", width: 22, height: 22, display: "inline-block" }} />
        <p className="hint" style={{ textAlign: "center" }}>Lecture de vos dépôts GitHub…</p>
      </div>
    );
  }

  /* ── Liste (nouveaux + maj) ── */
  if (phase === "list" || phase === "working") {
    const busy = phase === "working";
    return (
      <div className="fade-in pad" style={{ paddingTop: 8 }}>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", padding: "2px 0 4px" }}>
          {repoCount} dépôts · <span style={{ color: "var(--accent)" }}>{newCount} nouveau{newCount > 1 ? "x" : ""}</span> · {upCount} maj
        </div>

        {items.length === 0 ? (
          <>
            <div className="empty" style={{ padding: "44px 10px" }}>Tout est à jour — rien à synchroniser.</div>
            <button className="cta ghost" onClick={() => setPhase("idle")}>Retour</button>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 2 }}>
              Sélectionnez les fiches à générer ou rafraîchir. Une fiche est rédigée par IA (ou repli sur la description GitHub).
            </p>
            <div style={{ margin: "12px 0 0", border: "1px solid var(--line)", borderRadius: 13, overflow: "hidden" }}>
              {items.map(it => {
                const r = it.r, st = status[r.name], on = !!selected[r.name];
                return (
                  <div key={r.name} onClick={() => !busy && toggle(r.name)}
                    style={{ display: "flex", gap: 11, alignItems: "center", padding: "12px 14px",
                      borderBottom: "1px solid var(--line)", cursor: busy ? "default" : "pointer", opacity: busy && !on ? .4 : 1 }}>
                    <span style={{ flex: "0 0 auto", width: 19, height: 19, borderRadius: 6,
                      border: "1.6px solid " + (on ? "var(--accent)" : "var(--line-2)"),
                      background: on ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {st === "working" ? <span className="spin" style={{ width: 11, height: 11, borderColor: "rgba(255,255,255,.5)", borderTopColor: "#fff" }} />
                        : (on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 6"/></svg>)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontFamily: "var(--serif)", fontSize: 16.5, fontWeight: 500 }}>{r.name}</span>
                        {r.private && <Icon name="lock" size={11} style={{ color: "var(--ink-3)" }} />}
                      </div>
                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.desc || (r.lang || "Sans description")}
                      </div>
                    </div>
                    <span className="mono" style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", flex: "0 0 auto",
                      color: st === "error" ? "var(--accent)" : (it.type === "new" ? "var(--accent)" : "var(--ink-3)") }}>
                      {st === "done" ? "OK" : st === "error" ? "Échec" : (it.type === "new" ? "Nouveau" : "MAJ")}
                    </span>
                  </div>
                );
              })}
            </div>

            {!busy ? (
              <>
                {upCount > 0 && (
                  <button className="gen-btn" style={{ marginTop: 16, background: "var(--ink)" }} onClick={runAllStale}>
                    <Icon name="spark" size={17} /> Rafraîchir les {upCount} obsolète{upCount > 1 ? "s" : ""}
                  </button>
                )}
                <AIConfig cfg={cfg} onChange={setCfg} />
                <button className="gen-btn" disabled={selCount === 0} onClick={run}>
                  <Icon name="spark" size={17} /> Traiter {selCount} fiche{selCount > 1 ? "s" : ""}
                </button>
              </>
            ) : (
              <div className="gen-btn" style={{ opacity: 1, cursor: "default" }}><span className="spin" /> Traitement en cours…</div>
            )}
          </>
        )}
        <div className="bottom-space" />
      </div>
    );
  }

  /* ── Idle ── */
  return (
    <div className="fade-in pad" style={{ paddingTop: 4 }}>
      <p className="hint" style={{ marginTop: 0 }}>
        ProjectorApp interroge l'API GitHub en direct : il repère les <strong>nouveaux dépôts</strong> et les <strong>fiches à rafraîchir</strong> (dépôt modifié depuis la dernière synchro).
        Les dépôts <strong>publics</strong> sont accessibles sans rien ; pour les <strong>privés</strong>, ajoutez un token (stocké uniquement sur cet appareil).
      </p>
      <label className="field-label">Token GitHub <span style={{ textTransform: "none", letterSpacing: 0 }}>· optionnel</span></label>
      <input className="input" type="password" value={token} onChange={e => setToken(e.target.value)}
        placeholder="github_pat_… (laisser vide pour les dépôts publics)" />
      <label style={{ display: "flex", gap: 9, alignItems: "center", margin: "11px 2px 0", cursor: "pointer", fontSize: 13, color: "var(--ink-2)" }}>
        <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
        Mémoriser le token sur cet appareil
      </label>
      <p className="hint">Portée requise : <span className="mono">repo</span> (lecture) pour inclure les dépôts privés.</p>
      {error && <p className="hint" style={{ color: "var(--accent)" }}>{error}</p>}
      <button className="gen-btn" style={{ background: "var(--ink)" }} onClick={sync}>
        <Icon name="github" size={17} /> Synchroniser depuis GitHub
      </button>
      <div className="bottom-space" />
    </div>
  );
};

/* Onglet « Ajouter » : sous-navigation GitHub / README */
const AddHub = ({ projects, onAdd, onOpen, goHome, onPendingCount }) => {
  const [mode, setMode] = useState("github");
  return (
    <div className="viewport fade-in">
      <div style={{ padding: "26px 22px 0" }}>
        <span className="kicker">Étendre le portfolio</span>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, fontWeight: 500, letterSpacing: "-.02em", margin: "10px 0 14px" }}>Ajouter des projets</h1>
        <div className="seg">
          <button className={mode === "github" ? "on" : ""} onClick={() => setMode("github")}>Synchroniser GitHub</button>
          <button className={mode === "paste" ? "on" : ""} onClick={() => setMode("paste")}>Coller un README</button>
        </div>
      </div>
      {mode === "github"
        ? <SyncScreen projects={projects} onAdd={onAdd} onOpen={onOpen} goHome={goHome} onPendingCount={onPendingCount} />
        : <PasteScreen onAdd={onAdd} onOpen={onOpen} />}
    </div>
  );
};

export { SyncScreen, AddHub, listRepos, fetchReadme, detectShots, refreshFiche, getBaselines, setBaselines };
