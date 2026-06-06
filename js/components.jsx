/* ProjectorApp — composants partagés */
import { useState, useEffect, useRef, useMemo } from 'react';
import { CATEGORIES } from './data.js';

const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const catOf = p => CAT_BY_ID[p.cat] || CATEGORIES[0];
const accentOf = p => catOf(p).accent;
const tint = (accent, pct) => `color-mix(in oklab, ${accent} ${pct}%, var(--paper-3))`;

/* ───── Icons ───── */
const Icon = ({ name, size = 18, stroke = 1.6, style }) => {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", style };
  switch (name) {
    case "search": return <svg {...c}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>;
    case "chevron": return <svg {...c}><path d="m9 6 6 6-6 6"/></svg>;
    case "back": return <svg {...c}><path d="m15 6-6 6 6 6"/></svg>;
    case "lock": return <svg {...c}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case "globe": return <svg {...c}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/></svg>;
    case "plus": return <svg {...c}><path d="M12 5v14M5 12h14"/></svg>;
    case "home": return <svg {...c}><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></svg>;
    case "index": return <svg {...c}><path d="M4 6h16M4 12h16M4 18h16"/></svg>;
    case "spark": return <svg {...c}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>;
    case "ext": return <svg {...c}><path d="M14 5h5v5M19 5l-8 8M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5"/></svg>;
    case "github": return <svg {...c} strokeWidth="0" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l-.01 2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>;
    case "trash": return <svg {...c}><path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>;
    default: return null;
  }
};

/* ───── Status + kind ───── */
const StatusBadge = ({ p }) => (
  <span className="status" style={{ color: p.private ? "var(--ink-3)" : accentOf(p) }}>
    <Icon name={p.private ? "lock" : "globe"} size={11} stroke={1.8} />
    {p.private ? "Privé" : "Public"}
  </span>
);

const KindBadge = ({ p }) => <span className="kind-badge">{p.kind}</span>;

/* ───── Cover (screenshot or monogram, with onError fallback) ───── */
const Cover = ({ p, className }) => {
  const [err, setErr] = useState(false);
  const shot = p.shots && p.shots[0];
  if (shot && !err)
    return <img src={shot} alt={p.name} className={className} loading="lazy" onError={() => setErr(true)} />;
  const accent = accentOf(p);
  return (
    <div className="mono-cover" style={{ background: tint(accent, 18), color: accent }}>
      <span className="glyph">{p.name[0].toLowerCase()}</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span className="slug">/{p.repo}</span>
        <span className="kindtag">{p.kind.split(" ")[0]}</span>
      </div>
    </div>
  );
};

/* ───── Gallery shot (hides itself if the image fails to load) ───── */
const Shot = ({ src, alt }) => {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <div className="frame"><img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} /></div>;
};

/* ───── Rail card ───── */
const Card = ({ p, onOpen }) => (
  <div className="card fade-in" onClick={() => onOpen(p)}>
    <div className="cover"><Cover p={p} /></div>
    <div className="nm">{p.name}</div>
    <div className="tl">{p.tagline}</div>
  </div>
);

/* ───── List row ───── */
const Row = ({ p, onOpen }) => (
  <div className="row" onClick={() => onOpen(p)}>
    <div className="thumb"><Cover p={p} /></div>
    <div className="mid">
      <div className="nm">{p.name}</div>
      <div className="tl">{p.tagline}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 5, alignItems: "center" }}>
        <StatusBadge p={p} />
        <KindBadge p={p} />
      </div>
    </div>
    <div className="chev"><Icon name="chevron" size={18} /></div>
  </div>
);

export { Icon, StatusBadge, KindBadge, Cover, Shot, Card, Row, catOf, accentOf, tint, CAT_BY_ID };
