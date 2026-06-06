/* ProjectorApp — écrans */
import { useState, useEffect, useRef, useMemo } from 'react';
import { CATEGORIES, OWNER } from './data.js';
import { Icon, Cover, Shot, Card, Row, StatusBadge, KindBadge, catOf, accentOf, tint } from './components.jsx';

/* ═══════════════ ACCUEIL ═══════════════ */
const FeaturedHero = ({ items, onOpen }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % items.length), 5200);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const p = items[i];
  const accent = accentOf(p);
  return (
    <div className="featured" style={{ background: tint(accent, 16) }} onClick={() => onOpen(p)}>
      <div className="inner">
        <div className="fk" style={{ color: accent }}>En vedette · {catOf(p).label}</div>
        <div className="fn">{p.name}</div>
        <div className="ft ink2">{p.tagline}</div>
      </div>
      <div style={{ marginTop: 18, padding: "0 18px" }}>
        <div className="win"><img key={p.id} className="fade-in" src={p.shots[0]} alt={p.name}
          style={{ height: 196, objectFit: "cover", objectPosition: "top center" }} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "12px 0 14px" }}>
        {items.map((_, k) => (
          <span key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 4,
            background: k === i ? accent : "var(--line-2)", transition: "all .3s" }} />
        ))}
      </div>
    </div>
  );
};

const HomeScreen = ({ projects, onOpen, onSearch }) => {
  const featured = projects.filter(p => p.featured && p.shots.length);
  const byCat = CATEGORIES.map(c => ({ c, list: projects.filter(p => p.cat === c.id) }))
    .filter(g => g.list.length);
  const total = projects.length;
  return (
    <div className="viewport fade-in">
      <header className="masthead">
        <div className="top-row">
          <span className="kicker">Portfolio · GitHub</span>
          <span className="kicker">MMXXVI</span>
        </div>
        <h1 className="wordmark">Projector<span className="sup">app</span></h1>
        <p className="lede">Le carnet de tous mes projets — applications Linux, web et mobiles, façonnées une à une.</p>
        <div className="masthead-meta" style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16, whiteSpace: "nowrap" }}>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{total} projets</span>
          <span style={{ width: 3, height: 3, borderRadius: 9, background: "var(--line-2)", flex: "0 0 auto" }} />
          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>{byCat.length} collections</span>
          <span style={{ width: 3, height: 3, borderRadius: 9, background: "var(--line-2)", flex: "0 0 auto" }} />
          <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)" }}>@{OWNER}</span>
        </div>
        <button className="search-trigger" onClick={onSearch}>
          <Icon name="search" size={17} /> Chercher un projet, une techno…
        </button>
      </header>

      <FeaturedHero items={featured} onOpen={onOpen} />

      {byCat.map(({ c, list }, idx) => (
        <section className="sec" key={c.id}>
          <div className="sec-head">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span className="sec-num">{String(idx + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="sec-title">{c.label}</h2>
                <p className="sec-note">{c.note}</p>
              </div>
            </div>
            <span className="sec-count">{list.length}</span>
          </div>
          <div className="rail">
            {list.map(p => <Card key={p.id} p={p} onOpen={onOpen} />)}
          </div>
        </section>
      ))}
      <div className="bottom-space" />
    </div>
  );
};

/* ═══════════════ INDEX / RECHERCHE ═══════════════ */
const IndexScreen = ({ projects, onOpen, query, setQuery, filter, setFilter, autofocus }) => {
  const inputRef = useRef(null);
  useEffect(() => { if (autofocus && inputRef.current) inputRef.current.focus(); }, [autofocus]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter(p => filter === "all" || p.cat === filter)
      .filter(p => !q ||
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.repo.toLowerCase().includes(q) ||
        p.tech.join(" ").toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [projects, query, filter]);

  return (
    <div className="viewport fade-in">
      <div style={{ padding: "26px 22px 4px" }}>
        <span className="kicker">L'index</span>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: 34, fontWeight: 500, letterSpacing: "-.02em", margin: "10px 0 0" }}>
          Tous les projets
        </h1>
      </div>
      <div className="searchbar">
        <Icon name="search" size={18} style={{ color: "var(--ink-3)" }} />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Nom, techno, mot-clé…" />
        {query && <span onClick={() => setQuery("")} style={{ cursor: "pointer", color: "var(--ink-3)" }}>✕</span>}
      </div>
      <div className="chips">
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>Tout</button>
        {CATEGORIES.map(c => (
          <button key={c.id} className={"chip" + (filter === c.id ? " on" : "")}
            onClick={() => setFilter(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="pad">
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", padding: "6px 0 2px" }}>
          {results.length} résultat{results.length > 1 ? "s" : ""}
        </div>
        {results.length === 0
          ? <div className="empty">Rien ne correspond à « {query} ».</div>
          : results.map(p => <Row key={p.id} p={p} onOpen={onOpen} />)}
      </div>
      <div className="bottom-space" />
    </div>
  );
};

/* ═══════════════ FICHE DÉTAIL ═══════════════ */
const DetailScreen = ({ p, onBack, onOpenCat, onDelete, onRefresh, refreshing }) => {
  const accent = accentOf(p);
  const cat = catOf(p);
  const ghUrl = `https://github.com/${OWNER}/${p.repo}`;
  return (
    <div className="viewport fade-in" key={p.id}>
      <div className="topbar">
        <button className="iconbtn" onClick={onBack}><Icon name="back" size={20} /></button>
        {p.userAdded && (
          <button className="iconbtn" onClick={() => onDelete(p)} style={{ color: "var(--accent)" }}>
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>

      <div className="detail-head">
        <div className="dk" style={{ color: accent, cursor: "pointer" }} onClick={() => onOpenCat(cat.id)}>{cat.label}</div>
        <h1>{p.name}</h1>
        <div className="detail-meta">
          <StatusBadge p={p} />
          <KindBadge p={p} />
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.year}</span>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>/{p.repo}</span>
          {p.userAdded && <span className="mono" style={{ fontSize: 10, color: accent, letterSpacing: ".08em" }}>✦ FICHE IA</span>}
        </div>
      </div>

      {p.shots && p.shots.length ? (
        <div className="gallery">
          {p.shots.map((s, k) => <Shot key={k} src={s} alt={`${p.name} ${k + 1}`} />)}
        </div>
      ) : (
        <div className="bigmono"><Cover p={p} /></div>
      )}

      <div className="pad">
        <p className="pitch">{p.pitch}</p>

        {p.features && p.features.length > 0 && (
          <div style={{ "--accent": accent }}>
            <div className="label-line">Fonctionnalités clés</div>
            <ul className="feat-list">
              {p.features.map((f, i) => (
                <li key={i}><span className="mk">{String(i + 1).padStart(2, "0")}</span><span>{f}</span></li>
              ))}
            </ul>
          </div>
        )}

        <div className="label-line">Stack technique</div>
        <div className="tech-wrap">
          {p.tech.map(t => <span className="tech" key={t}>{t}</span>)}
        </div>

        <a className="cta" href={ghUrl} target="_blank" rel="noopener">
          <Icon name="github" size={18} /> Voir sur GitHub
        </a>
        {onRefresh && (
          <button className="cta ghost" onClick={() => onRefresh(p)} disabled={refreshing}>
            {refreshing
              ? <><span className="spin" style={{ borderColor: "rgba(27,24,21,.25)", borderTopColor: "var(--ink)" }} /> Rafraîchissement…</>
              : <><Icon name="spark" size={17} /> Rafraîchir depuis GitHub</>}
          </button>
        )}
        {p.private && (
          <p className="hint" style={{ textAlign: "center" }}>
            Dépôt privé — accessible avec votre compte GitHub.
          </p>
        )}
      </div>
      <div className="bottom-space" />
    </div>
  );
};

export { HomeScreen, IndexScreen, DetailScreen, FeaturedHero };
