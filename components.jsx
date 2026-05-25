// components.jsx — Primitives + Shell (Sidebar / Topbar)
// Globaliza al final con Object.assign(window, ...).

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── ICONOS (SVG line-art simples) ─────────────────────────
const I = {
  trade: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12 L6 7 L9 9 L14 3" />
      <path d="M10 3 H14 V7" />
    </svg>
  ),
  market: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2.5" y1="13" x2="2.5" y2="9" />
      <line x1="6" y1="13" x2="6" y2="5" />
      <line x1="9.5" y1="13" x2="9.5" y2="7" />
      <line x1="13" y1="13" x2="13" y2="3" />
    </svg>
  ),
  wallet: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
      <path d="M2 7 H14" />
      <circle cx="11" cy="10" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  coin: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M5 8 L8 5 L11 8 L8 11 Z" />
    </svg>
  ),
  chain: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="5" height="4" rx="0.8" />
      <rect x="9" y="9" width="5" height="4" rx="0.8" />
      <path d="M7 5 L9 11" />
    </svg>
  ),
  admin: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="6" r="2.4" />
      <path d="M3 13 C3 10.5 5 9.5 8 9.5 C11 9.5 13 10.5 13 13" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="6.2" cy="6.2" r="4" />
      <path d="M9.5 9.5 L12.5 12.5" />
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M4 11 L4 8 C4 5.8 5.8 4 8 4 C10.2 4 12 5.8 12 8 V11 L13 12 H3 Z" />
      <path d="M6.5 13 C7 13.8 7.8 13.8 8 13.8 C8.2 13.8 9 13.8 9.5 13" />
    </svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="1.8" />
      <path d="M8 1.5 V3 M8 13 V14.5 M14.5 8 H13 M3 8 H1.5 M12.6 3.4 L11.6 4.4 M4.4 11.6 L3.4 12.6 M12.6 12.6 L11.6 11.6 M4.4 4.4 L3.4 3.4" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7 H10 M7.5 4.5 L10 7 L7.5 9.5" />
    </svg>
  ),
  shield: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M6.5 1.5 L11 3.2 L11 7 C11 9.5 8.8 11 6.5 11.8 C4.2 11 2 9.5 2 7 L2 3.2 Z" strokeLinejoin="round" />
      <path d="M4.8 6.5 L6 7.7 L8.5 5.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M7 3 V11 M3 7 H11" />
    </svg>
  ),
  bolt: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M7.5 1 L3 8 H7 L5.5 13 L11 6 H7 Z" />
    </svg>
  ),
};

// ── Sidebar ──────────────────────────────────────────────
function Sidebar({ active, onNavigate }) {
  const items = [
    { id: "trading", label: "Trading", icon: I.trade },
    { id: "mercados", label: "Mercados", icon: I.market },
    { id: "wallet", label: "Wallet Digital", icon: I.wallet },
    { id: "factory", label: "Crear Moneda", icon: I.coin },
    { id: "blockchain", label: "Blockchain Interna", icon: I.chain },
    { id: "admin", label: "Administración", icon: I.admin },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">V</div>
        <div>
          <div className="brand-name">Vértice</div>
          <div className="brand-sub">Exchange OS</div>
        </div>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Plataforma</div>
        {items.map((it) => (
          <a key={it.id} className="nav-item"
             data-active={active === it.id}
             onClick={(e) => { e.preventDefault(); onNavigate(it.id); }}
             href={"#" + it.id}>
            {it.icon}
            <span>{it.label}</span>
          </a>
        ))}
      </nav>

      <div className="nav-spacer" />

      <div className="sidebar-foot">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {I.shield}
          <span className="k">Seguridad activa</span>
        </div>
        <div className="v">2FA · HSM · Ed25519</div>
        <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 6 }}>
          Firma anti-duplicación en vivo
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ───────────────────────────────────────────────
function Topbar({ walletValue, onSearch }) {
  const [tickerPairs, setTickerPairs] = useState(() => [...VData.pairs]);
  const inputRef = useRef(null);

  useEffect(() => {
    const off = VData.subscribe("tickAll", (ps) => setTickerPairs([...ps]));
    return off;
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const renderTicker = (key) =>
    tickerPairs.map((p) => (
      <div className="tick" key={key + p.sym}>
        <span className="sym">{p.sym}/{p.quote}</span>
        <span className="px">{VData.fmt.price(p.price)}</span>
        <span className={p.ch >= 0 ? "up" : "down"} style={{ fontSize: 11 }}>{VData.fmt.pct(p.ch)}</span>
      </div>
    ));

  return (
    <header className="topbar">
      <div className="search">
        {I.search}
        <input ref={inputRef} placeholder="Buscar mercado, token o hash…" onChange={(e) => onSearch?.(e.target.value)} />
        <span className="kbd">⌘K</span>
      </div>

      <div className="ticker">
        <div className="ticker-track">
          {renderTicker("a")}
          {renderTicker("b")}
        </div>
      </div>

      <div className="topbar-actions">
        <button className="icon-btn" title="Notificaciones">
          {I.bell}
          <span className="dot" />
        </button>
        <button className="icon-btn" title="Configuración">{I.gear}</button>
        <div className="wallet-pill">
          <div>
            <div className="lab">Wallet</div>
            <div className="val">${walletValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
        <div className="avatar">JM</div>
      </div>
    </header>
  );
}

// ── Sparkline (inline SVG) ───────────────────────────────
function Sparkline({ data, color, w = 80, h = 22 }) {
  if (!data || data.length < 2) return <svg className="sparkline" width={w} height={h} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = (max - min) || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const fillD = `M0,${h} L${pts.replace(/,/g, ",")} L${w},${h} Z`;
  return (
    <svg className="sparkline" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M${pts.split(" ").join(" L")}`} fill="none" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

// ── PriceCell — number that flashes color when it changes ─
function PriceCell({ value, format }) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState(null);
  useEffect(() => {
    if (value > prev) setDir("up");
    else if (value < prev) setDir("down");
    const t = setTimeout(() => setDir(null), 700);
    setPrev(value);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className={dir === "up" ? "price-flash-up" : dir === "down" ? "price-flash-down" : ""}>
      {format ? format(value) : value}
    </span>
  );
}

// ── Util: round-up tick of a price ───────────────────────
function timeAgo(t) { return VData.fmt.age(t); }

// ── Export to global ─────────────────────────────────────
Object.assign(window, { Sidebar, Topbar, Sparkline, PriceCell, I, timeAgo });
