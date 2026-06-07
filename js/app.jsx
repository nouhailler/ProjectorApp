/* ProjectorApp — racine : navigation, persistance, barre d'onglets */
import { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PROJECTS } from './data.js';
import { Icon } from './components.jsx';
import { HomeScreen, IndexScreen, DetailScreen } from './screens.jsx';
import { getAIConfig } from './add.jsx';
import { AddHub, refreshFiche, getBaselines, setBaselines } from './sync.jsx';

const STORE_KEY = "projector.userProjects.v1";
function loadUser() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch (e) { return []; }
}
function saveUser(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
}

const TABS = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "index", label: "Index", icon: "index" },
  { id: "add", label: "Ajouter", icon: "plus" },
];

function App() {
  const [userProjects, setUserProjects] = useState(loadUser);
  const [tab, setTab] = useState("home");
  const [detail, setDetail] = useState(null);      // projet ouvert (ou null)
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [focusSearch, setFocusSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);  // fiches obsolètes détectées à la dernière synchro

  // fusion : les fiches utilisateur (ajoutées / rafraîchies) priment sur le socle, dé-dupliquées par dépôt.
  // Les champs optionnels ajoutés au socle (ex. live) sont hérités si absents de la fiche localStorage.
  const projects = useMemo(() => {
    const baseByRepo = new Map(PROJECTS.map(p => [p.repo.toLowerCase(), p]));
    const seen = new Set(); const out = [];
    for (const p of userProjects) {
      const k = p.repo.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        const base = baseByRepo.get(k);
        out.push(base && base.live && !p.live ? { ...p, live: base.live } : p);
      }
    }
    for (const p of PROJECTS) { const k = p.repo.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(p); } }
    return out;
  }, [userProjects]);
  const vpRef = useRef(null);

  useEffect(() => { saveUser(userProjects); }, [userProjects]);
  // remonter en haut à chaque changement de vue
  useEffect(() => { if (vpRef.current) { const v = vpRef.current.querySelector(".viewport"); if (v) v.scrollTop = 0; } }, [tab, detail]);

  const openProject = (p) => setDetail(p);
  const closeDetail = () => setDetail(null);
  const goSearch = () => { setFocusSearch(true); setTab("index"); };
  const openCat = (catId) => { setDetail(null); setFilter(catId); setQuery(""); setFocusSearch(false); setTab("index"); };

  const addProject = (p) => setUserProjects(list => [{ ...p }, ...list.filter(x => x.repo.toLowerCase() !== p.repo.toLowerCase())]);
  const deleteProject = (p) => { setUserProjects(list => list.filter(x => x.id !== p.id)); setDetail(null); };
  const editShots = (p, shots) => { const u = { ...p, shots }; addProject(u); setDetail(u); };

  // Rafraîchir une fiche depuis GitHub (README + captures régénérés)
  const refreshProject = async (p) => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem("projector.ghToken") || "";
      const updated = await refreshFiche(p, { cfg: getAIConfig(), token });
      const bl = getBaselines(); if (updated.baseline) bl[updated.repo.toLowerCase()] = updated.baseline; setBaselines(bl);
      addProject(updated);
      setDetail(updated);
    } catch (e) { /* silencieux : la fiche reste inchangée */ }
    finally { setRefreshing(false); }
  };

  const switchTab = (id) => { setDetail(null); if (id === "index" && tab !== "index") setFocusSearch(false); setTab(id); };

  let screen;
  if (detail) {
    screen = <DetailScreen p={detail} onBack={closeDetail} onOpenCat={openCat} onDelete={deleteProject}
      onRefresh={refreshProject} refreshing={refreshing} onEditShots={editShots} />;
  } else if (tab === "home") {
    screen = <HomeScreen projects={projects} onOpen={openProject} onSearch={goSearch} />;
  } else if (tab === "index") {
    screen = <IndexScreen projects={projects} onOpen={openProject}
      query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} autofocus={focusSearch} />;
  } else {
    screen = <AddHub projects={projects} onAdd={addProject} onOpen={openProject}
      goHome={() => { setDetail(null); setTab("home"); }}
      onPendingCount={setPendingCount} />;
  }

  return (
    <div className="desk">
      <div className="shell" ref={vpRef}>
        {screen}
        <nav className="tabbar">
          {TABS.map(t => {
            const active = !detail && tab === t.id;
            return (
              <button key={t.id} className={"tab" + (active ? " on" : "") + (t.id === "add" ? " add" : "")}
                onClick={() => switchTab(t.id)}>
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Icon name={t.icon} size={21} stroke={active ? 1.9 : 1.6} />
                  {t.id === "add" && pendingCount > 0 && (
                    <span style={{
                      position: "absolute", top: -5, right: -8,
                      minWidth: 15, height: 15, borderRadius: 8, padding: "0 3px",
                      background: "var(--accent)", color: "#fff",
                      fontSize: 9, fontFamily: "var(--mono)", fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                    }}>{pendingCount > 9 ? "9+" : pendingCount}</span>
                  )}
                </div>
                <span className="lb">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
