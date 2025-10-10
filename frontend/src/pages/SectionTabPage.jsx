import { useEffect, useState } from "react";
import "../styles/ImageGrid.css";

export default function SectionTabPage({id, title, tabs, showTabs }) {
  const normalized = tabs.map((t) => t.toLowerCase());
  const [active, setActive] = useState(normalized[0]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const shouldShowTabs = showTabs ?? normalized.length > 1;
  // in SectionTabPage.jsx
    const API_BASE = ""; // e.g. "http://localhost:8080"

    useEffect(() => {
      let cancel = false;
      (async () => {
        setLoading(true); setErr("");
        try {
          const url = `${API_BASE}/api/gallery/sections/${active}/items`;
          const res = await fetch(url, {
            headers: { Accept: "application/json" }
          });

          // if backend returns HTML or a 404/500, surface it
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0,200)}`);
          }

          const data = await res.json(); // safe now
          if (!cancel) { setItems(data.items || []); setLoading(false); }
        } catch (e) {
          if (!cancel) { setErr(String(e)); setLoading(false); }
        }
      })();
      return () => { cancel = true; };
    }, [active]);

  return (
    <div id={id} className="PhotoGallery" style={{ margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontFamily: "Oswald, serif", fontSize: 48, margin: "16px 0" }}>{title}</h1>

      {shouldShowTabs && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {normalized.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid black",
                background: t === active ? "black" : "transparent",
                color: t === active ? "white" : "black",
                cursor: "pointer",
              }}
            >
              {pretty(t)}
            </button>
          ))}
        </div>
      )}

      {loading && <p>Loading…</p>}
      {err && <p>{err}</p>}
      {!loading && !err && <ImageGrid items={items} />}
      {!loading && !err && items.length === 0 && <p>No items yet.</p>}
    </div>
  );
}

function ImageGrid({ items }) {
  const isWebImage = (u = '') => /\.(jpe?g|png|gif|webp|avif)$/i.test(u);
  return (
    <div className="image-grid">
      {items
        .map(m => ({ src: m.fullUrl || m.thumbUrl || m.src, alt: m.filename || '' }))
        .map((m, i) =>
          isWebImage(m.src) ? (
            <img
              key={i}
              src={m.src}
              alt={m.alt}
              loading="lazy"
              className="image-grid-item"
            />
          ) : (
            <a
              key={i}
              href={m.src}
              target="_blank"
              rel="noreferrer"
              className="image-grid-fallback"
            >
              {m.alt || m.src.split('/').pop()} (not web-viewable)
            </a>
          )
        )}
    </div>
  );
}



function pretty(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

