// screens.jsx — Mercados / Wallet / Factory / Blockchain / Admin
const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM } = React;

// ════════════════════════════════════════════════════════════
// MERCADOS
// ════════════════════════════════════════════════════════════
function MercadosScreen() {
  const [pairs, setPairs] = useS([...VData.pairs]);
  const [filter, setFilter] = useS("todos");
  const [search, setSearch] = useS("");
  const [sort, setSort] = useS({ k: "vol", dir: -1 });

  useE(() => {
    const off = VData.subscribe("tickAll", (ps) => setPairs([...ps]));
    return off;
  }, []);

  const filtered = pairs
    .filter((p) => p.sym.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => {
      if (filter === "ganadores") return p.ch >= 0;
      if (filter === "perdedores") return p.ch < 0;
      if (filter === "internos") return p.sym === "NXP";
      return true;
    })
    .sort((a, b) => {
      const fa = sort.k === "vol" ? a.vol * a.basePrice : sort.k === "price" ? a.price : sort.k === "ch" ? a.ch : 0;
      const fb = sort.k === "vol" ? b.vol * b.basePrice : sort.k === "price" ? b.price : sort.k === "ch" ? b.ch : 0;
      return (fa - fb) * sort.dir;
    });

  const totalVol = pairs.reduce((s, p) => s + p.vol * p.basePrice, 0);
  const gainers = pairs.filter((p) => p.ch >= 0).length;

  const setS = (k) => setSort((s) => ({ k, dir: s.k === k ? -s.dir : -1 }));

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Mercados</div>
          <div className="screen-sub">{pairs.length} pares activos · Datos en tiempo real con feeds redundantes</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" data-active={filter === "todos"} onClick={() => setFilter("todos")}>Todos</button>
          <button className="chip" data-active={filter === "ganadores"} onClick={() => setFilter("ganadores")}>↑ Ganadores</button>
          <button className="chip" data-active={filter === "perdedores"} onClick={() => setFilter("perdedores")}>↓ Perdedores</button>
          <button className="chip" data-active={filter === "internos"} onClick={() => setFilter("internos")}>Tokens internos</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Volumen total 24h</div>
          <div className="v">${VData.fmt.vol(totalVol)}</div>
          <div className="d up">↑ +18.4% vs ayer</div>
        </div>
        <div className="stat-card">
          <div className="k">Pares en alza</div>
          <div className="v">{gainers} <span className="d">/ {pairs.length}</span></div>
          <div className="d">Promedio: {(pairs.reduce((s, p) => s + p.ch, 0) / pairs.length).toFixed(2)}%</div>
        </div>
        <div className="stat-card">
          <div className="k">Liquidez agregada</div>
          <div className="v">$402M</div>
          <div className="d">Profundidad 1% · 22 LPs</div>
        </div>
        <div className="stat-card">
          <div className="k">Trades / minuto</div>
          <div className="v">12,841</div>
          <div className="d">Pico hoy: 18,422</div>
        </div>
      </div>

      <div className="card" style={{ minHeight: 0, flex: 1 }}>
        <div className="card-h">
          <span className="card-t">Tabla de mercados</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input className="input" style={{ width: 220, height: 30 }} placeholder="Buscar símbolo o nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="scroll-y" style={{ flex: 1 }}>
          <div className="tbl">
            <div className="tbl-h" style={{ gridTemplateColumns: "40px 1.6fr 1fr 1fr 1fr 1fr 100px 90px" }}>
              <span>#</span>
              <span>ACTIVO</span>
              <span className="r" onClick={() => setS("price")} style={{ cursor: "pointer" }}>PRECIO {sort.k === "price" ? (sort.dir < 0 ? "▼" : "▲") : ""}</span>
              <span className="r" onClick={() => setS("ch")} style={{ cursor: "pointer" }}>24h {sort.k === "ch" ? (sort.dir < 0 ? "▼" : "▲") : ""}</span>
              <span className="r">MAX 24h</span>
              <span className="r" onClick={() => setS("vol")} style={{ cursor: "pointer" }}>VOLUMEN {sort.k === "vol" ? (sort.dir < 0 ? "▼" : "▲") : ""}</span>
              <span className="r">7d</span>
              <span className="r" />
            </div>
            {filtered.map((p, idx) => (
              <div key={p.sym} className="tbl-r" style={{ gridTemplateColumns: "40px 1.6fr 1fr 1fr 1fr 1fr 100px 90px" }}>
                <span className="mono dim">{String(idx + 1).padStart(2, "0")}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: p.color, display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 11, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
                    {p.sym.slice(0, 2)}
                  </span>
                  <span>
                    <div style={{ fontWeight: 600 }}>{p.sym}</div>
                    <div className="dim" style={{ fontSize: 11 }}>{p.name}</div>
                  </span>
                </span>
                <span className="r mono"><PriceCell value={p.price} format={(v) => "$" + VData.fmt.price(v)} /></span>
                <span className={"r " + (p.ch >= 0 ? "up" : "down")} style={{ fontWeight: 500 }}>{VData.fmt.pct(p.ch)}</span>
                <span className="r mono dim">${VData.fmt.price(p.high)}</span>
                <span className="r mono">${VData.fmt.vol(p.vol * p.basePrice)}</span>
                <span className="r"><MiniSparkline pair={p} /></span>
                <span className="r">
                  <button className="btn ghost" style={{ height: 26, padding: "0 10px", fontSize: 11 }} onClick={() => VData.setActive(p.sym, null)}>Tradear</button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WALLET
// ════════════════════════════════════════════════════════════
function WalletScreen() {
  const [assets, setAssets] = useS([...VData.assets]);
  const [view, setView] = useS("activos");

  useE(() => {
    const off = VData.subscribe("balances", (a) => setAssets([...a]));
    return off;
  }, []);

  const total = assets.reduce((s, a) => s + a.value, 0);
  const sortedAssets = [...assets].sort((a, b) => b.value - a.value);

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Wallet Digital</div>
          <div className="screen-sub">Custodia híbrida con HSM · Recuperación social activada · 0/3 firmas pendientes</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost">Depositar</button>
          <button className="btn ghost">Retirar</button>
          <button className="btn ghost">Transferir</button>
          <button className="btn btn-primary">Comprar con tarjeta</button>
        </div>
      </div>

      <div className="split-2">
        <div className="card" style={{ padding: 24, gap: 18, justifyContent: "space-between" }}>
          <div>
            <div className="k" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--text-mute)", fontWeight: 600 }}>Patrimonio total</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 56, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, marginTop: 10 }}>
              <PriceCell value={total} format={(v) => "$" + VData.fmt.price(v)} />
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="pill up">↑ +$24,182 hoy</span>
              <span className="dim mono" style={{ fontSize: 12 }}>+1.32%</span>
            </div>
          </div>
          <PortfolioMix assets={sortedAssets} total={total} />
        </div>

        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-h">
            <span className="card-t">Distribución</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{sortedAssets.length} activos</span>
          </div>
          <div className="card-b" style={{ gap: 14 }}>
            {sortedAssets.slice(0, 6).map((a) => {
              const pct = total > 0 ? (a.value / total) * 100 : 0;
              return (
                <div key={a.sym} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: a.color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <strong>{a.sym}</strong>
                      <span className="mono">{pct.toFixed(2)}%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--bg-soft)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: a.color, transition: "width 0.6s" }} />
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ minHeight: 0, flex: 1 }}>
        <div className="card-h">
          <div className="tabs">
            <button data-active={view === "activos"} onClick={() => setView("activos")}>Activos</button>
            <button data-active={view === "depositos"} onClick={() => setView("depositos")}>Depósitos & Retiros</button>
            <button data-active={view === "stake"} onClick={() => setView("stake")}>Staking</button>
          </div>
        </div>
        <div className="scroll-y" style={{ flex: 1 }}>
          {view === "activos" && (
            <>
              <div className="tbl-h" style={{ gridTemplateColumns: "40px 1.4fr 1fr 1fr 1fr 200px" }}>
                <span />
                <span>ACTIVO</span>
                <span className="r">SALDO</span>
                <span className="r">VALOR USD</span>
                <span className="r">24h</span>
                <span className="r">ACCIONES</span>
              </div>
              {sortedAssets.map((a) => (
                <div key={a.sym} className="asset-row" style={{ gridTemplateColumns: "40px 1.4fr 1fr 1fr 1fr 200px" }}>
                  <span />
                  <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="asset-glyph" style={{ background: a.color }}>{a.sym.slice(0, 2)}</span>
                    <span>
                      <div style={{ fontWeight: 600 }}>{a.sym}</div>
                      <div className="dim" style={{ fontSize: 11 }}>{a.name}</div>
                    </span>
                  </span>
                  <span className="r mono">{VData.fmt.size(a.balance)}</span>
                  <span className="r mono"><PriceCell value={a.value} format={(v) => "$" + VData.fmt.price(v)} /></span>
                  <span className={"r mono " + (a.ch >= 0 ? "up" : "down")}>{VData.fmt.pct(a.ch)}</span>
                  <span className="r" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button className="chip">Depositar</button>
                    <button className="chip">Retirar</button>
                    <button className="chip">Tradear</button>
                  </span>
                </div>
              ))}
            </>
          )}
          {view === "depositos" && <DepositsWithdrawals />}
          {view === "stake" && <StakingTab />}
        </div>
      </div>
    </div>
  );
}

function PortfolioMix({ assets, total }) {
  // Single horizontal bar showing all assets
  return (
    <div>
      <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "var(--bg-soft)" }}>
        {assets.map((a) => {
          const pct = total > 0 ? (a.value / total) * 100 : 0;
          if (pct < 0.5) return null;
          return <div key={a.sym} style={{ width: pct + "%", background: a.color, transition: "width 0.6s" }} title={a.sym + " " + pct.toFixed(2) + "%"} />;
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, fontSize: 11 }}>
        {assets.slice(0, 6).map((a) => (
          <span key={a.sym} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-soft)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
            {a.sym} <span className="dim">{(a.value / total * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function DepositsWithdrawals() {
  const items = [
    { type: "DEP", asset: "USDT", amount: "+ 50,000.00", net: "TRC-20", state: "CONFIRMADO", t: Date.now() - 1200000 },
    { type: "RET", asset: "BTC", amount: "− 0.482", net: "Bitcoin", state: "FIRMADO", t: Date.now() - 3600000 },
    { type: "DEP", asset: "ETH", amount: "+ 12.4", net: "Ethereum", state: "PENDIENTE", t: Date.now() - 480000 },
    { type: "RET", asset: "USDC", amount: "− 1,250.00", net: "Polygon", state: "MFA OK", t: Date.now() - 7200000 },
    { type: "DEP", asset: "SOL", amount: "+ 1,820.0", net: "Solana", state: "CONFIRMADO", t: Date.now() - 14400000 },
  ];
  return (
    <div className="tbl">
      <div className="tbl-h" style={{ gridTemplateColumns: "100px 80px 1fr 1fr 100px 130px 90px" }}>
        <span>HORA</span><span>TIPO</span><span>ACTIVO</span><span className="r">MONTO</span><span>RED</span><span>ESTADO</span><span className="r">HASH</span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="tbl-r" style={{ gridTemplateColumns: "100px 80px 1fr 1fr 100px 130px 90px" }}>
          <span className="mono dim">{VData.fmt.age(it.t)} atrás</span>
          <span className={it.type === "DEP" ? "up" : "down"} style={{ fontWeight: 600 }}>{it.type}</span>
          <span>{it.asset}</span>
          <span className={"r mono " + (it.type === "DEP" ? "up" : "down")}>{it.amount}</span>
          <span className="mono dim">{it.net}</span>
          <span className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", color: it.state === "PENDIENTE" ? "var(--warn)" : "var(--positive)" }}>{it.state}</span>
          <span className="r mono dim">0x{Math.random().toString(16).slice(2, 6)}…</span>
        </div>
      ))}
    </div>
  );
}

function StakingTab() {
  const stakes = [
    { sym: "ETH", apr: 4.2, amount: 24.0, rewards: 0.182, color: "#627EEA" },
    { sym: "SOL", apr: 7.1, amount: 480.0, rewards: 2.42, color: "#9945FF" },
    { sym: "NXP", apr: 18.4, amount: 250000, rewards: 1842, color: "#22D3EE" },
  ];
  return (
    <div className="tbl">
      <div className="tbl-h" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 140px" }}>
        <span>ACTIVO</span><span className="r">APR</span><span className="r">EN STAKE</span><span className="r">RECOMPENSAS</span><span className="r">VALOR</span><span className="r">ACCIONES</span>
      </div>
      {stakes.map((s, i) => (
        <div key={i} className="tbl-r" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr 140px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="asset-glyph" style={{ background: s.color, width: 24, height: 24, fontSize: 10 }}>{s.sym.slice(0, 2)}</span>
            <strong>{s.sym}</strong>
          </span>
          <span className="r up mono">{s.apr}%</span>
          <span className="r mono">{VData.fmt.size(s.amount)} {s.sym}</span>
          <span className="r mono up">+{VData.fmt.size(s.rewards)}</span>
          <span className="r mono">${VData.fmt.vol(s.amount * 100)}</span>
          <span className="r" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button className="chip">Reclamar</button>
            <button className="chip">Deshacer</button>
          </span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CREAR MONEDA (Token Factory)
// ════════════════════════════════════════════════════════════
function FactoryScreen() {
  const [form, setForm] = useS({
    name: "Neon X Protocol",
    symbol: "NXP",
    supply: "1000000000",
    decimals: "18",
    logo: "NX",
    network: "Vértice-1",
    type: "fungible",
    key: "KEY::NOVA::00FF91::NO-DUP::2026",
  });
  const [busy, setBusy] = useS(false);
  const [created, setCreated] = useS(false);

  const f = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const create = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); setCreated(true); }, 1800);
  };

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Crear nueva moneda</div>
          <div className="screen-sub">Token factory · Despliegue verificado con firma Ed25519 y prueba anti-duplicación en la cadena interna.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="kbd-hint">⌘ + ↵ para desplegar</span>
        </div>
      </div>

      <div className="tf-grid">
        <div className="card">
          <div className="card-h">
            <span className="card-t">Configuración del token</span>
            <span className="pill solid">Borrador</span>
          </div>
          <div className="card-b" style={{ gap: 14 }}>
            <div className="field">
              <div className="field-l">Llave única · irrepetible</div>
              <input className="input" value={form.key} onChange={(e) => f("key", e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <div className="field">
                <div className="field-l">Nombre del token</div>
                <input className="input" value={form.name} onChange={(e) => f("name", e.target.value)} style={{ fontFamily: "var(--font-body)" }} />
              </div>
              <div className="field">
                <div className="field-l">Símbolo</div>
                <input className="input" value={form.symbol} onChange={(e) => f("symbol", e.target.value.toUpperCase().slice(0, 6))} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 12 }}>
              <div className="field">
                <div className="field-l">Suministro inicial</div>
                <div className="input-suffix">
                  <input className="input" value={Number(form.supply).toLocaleString("en-US")} onChange={(e) => f("supply", e.target.value.replace(/[^\d]/g, ""))} />
                  <span className="suf">{form.symbol}</span>
                </div>
              </div>
              <div className="field">
                <div className="field-l">Decimales</div>
                <input className="input" value={form.decimals} onChange={(e) => f("decimals", e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </div>
              <div className="field">
                <div className="field-l">Logo (2-3 letras)</div>
                <input className="input" value={form.logo} onChange={(e) => f("logo", e.target.value.toUpperCase().slice(0, 3))} style={{ fontFamily: "var(--font-body)" }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <div className="field-l">Red de despliegue</div>
                <select className="input" value={form.network} onChange={(e) => f("network", e.target.value)} style={{ fontFamily: "var(--font-body)" }}>
                  <option>Vértice-1 (interna · gas $0)</option>
                  <option>Ethereum (mainnet)</option>
                  <option>Polygon</option>
                  <option>Solana</option>
                </select>
              </div>
              <div className="field">
                <div className="field-l">Tipo de token</div>
                <select className="input" value={form.type} onChange={(e) => f("type", e.target.value)} style={{ fontFamily: "var(--font-body)" }}>
                  <option value="fungible">Fungible (ERC-20)</option>
                  <option value="nft">No fungible (ERC-721)</option>
                  <option value="multi">Multi-token (ERC-1155)</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--bg-soft)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)", fontSize: 12, color: "var(--text-soft)" }}>
              {I.shield}
              <span>
                <strong style={{ color: "var(--text)" }}>Despliegue verificado.</strong> Tu token será firmado con Ed25519, registrado en la cadena interna y validado contra el índice anti-duplicación antes de aparecer en mercados.
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn ghost">Vista previa en mercado</button>
              <button className="btn btn-primary lg" onClick={create} disabled={busy || created} style={{ flex: 1 }}>
                {busy ? "Firmando y desplegando…" : created ? "✓ Token creado · #042" : "Generar moneda"}
              </button>
            </div>
          </div>
        </div>

        <div className="tf-preview">
          <div className="card-t" style={{ alignSelf: "flex-start" }}>Vista previa</div>
          <div className="tf-coin">{form.logo || "??"}</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{form.name}</div>
            <div className="dim mono" style={{ marginTop: 4 }}>{form.symbol} · {form.network.split(" ")[0]}</div>
          </div>
          <div style={{ width: "100%", borderTop: "1px solid var(--border-soft)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
            <Row k="Suministro" v={Number(form.supply).toLocaleString("en-US") + " " + form.symbol} />
            <Row k="Decimales" v={form.decimals} />
            <Row k="Estándar" v={form.type === "fungible" ? "ERC-20" : form.type === "nft" ? "ERC-721" : "ERC-1155"} />
            <Row k="Gas estimado" v={form.network.includes("Vértice") ? "Gratuito" : "~$3.40"} />
            <Row k="Tiempo despliegue" v="~ 8 seg" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <span className="card-t">Tokens creados desde tu cuenta · 4</span>
          <button className="chip">Ver todos</button>
        </div>
        <div className="tbl">
          <div className="tbl-h" style={{ gridTemplateColumns: "40px 1.4fr 1fr 1fr 1fr 1fr 100px" }}>
            <span>#</span><span>TOKEN</span><span className="r">SUMINISTRO</span><span className="r">HOLDERS</span><span className="r">PRECIO</span><span className="r">VOL 24h</span><span className="r" />
          </div>
          {[
            { i: "042", n: "Neon X Protocol", s: "NXP", sup: "1,000M", hold: 8421, p: 0.4823, v: 42600000, c: "#22D3EE", ch: 12.04 },
            { i: "038", n: "Aurora Stable", s: "AUR", sup: "250M", hold: 3104, p: 1.0002, v: 18200000, c: "#A78BFA", ch: 0.01 },
            { i: "031", n: "Mineral Wrap", s: "wMIN", sup: "84M", hold: 1842, p: 4.221, v: 6420000, c: "#34D399", ch: -1.84 },
            { i: "024", n: "Cobalt Index", s: "iCOB", sup: "12M", hold: 942, p: 18.42, v: 1840000, c: "#60A5FA", ch: 3.14 },
          ].map((t, i) => (
            <div key={i} className="tbl-r" style={{ gridTemplateColumns: "40px 1.4fr 1fr 1fr 1fr 1fr 100px" }}>
              <span className="mono dim">#{t.i}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="asset-glyph" style={{ background: t.c, width: 28, height: 28, fontSize: 10 }}>{t.s.slice(0, 2)}</span>
                <span>
                  <div style={{ fontWeight: 600 }}>{t.n}</div>
                  <div className="dim" style={{ fontSize: 11 }}>{t.s} · Vértice-1</div>
                </span>
              </span>
              <span className="r mono">{t.sup}</span>
              <span className="r mono">{t.hold.toLocaleString("en-US")}</span>
              <span className="r mono">${t.p.toFixed(t.p < 1 ? 4 : 3)}</span>
              <span className="r mono">${VData.fmt.vol(t.v)}</span>
              <span className="r"><button className="chip">Gestionar</button></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span className="dim" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
      <span className="mono">{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BLOCKCHAIN INTERNA
// ════════════════════════════════════════════════════════════
function BlockchainScreen() {
  const [blocks, setBlocks] = useS(() => {
    const arr = [];
    for (let i = 0; i < 12; i++) {
      arr.push({
        n: 12181 - i,
        hash: "0x" + Math.random().toString(16).slice(2, 6) + "..." + Math.random().toString(16).slice(2, 6).toUpperCase(),
        sig: i % 2 === 0 ? "SIG:zk-44A" : "SIG:ed25519",
        anti: "ANTI-DUP OK",
        txCount: Math.floor(Math.random() * 22) + 4,
        t: Date.now() - i * 8000,
      });
    }
    return arr;
  });
  const [txs, setTxs] = useS([]);

  useE(() => {
    const offB = VData.subscribe("block", (b) => setBlocks((bs) => [b, ...bs].slice(0, 30)));
    const offT = VData.subscribe("tx", (t) => setTxs((ts) => [t, ...ts].slice(0, 24)));
    return () => { offB(); offT(); };
  }, []);

  const lastBlock = blocks[0];
  const tps = txs.length > 0 ? Math.round((txs.length / ((Date.now() - txs[txs.length - 1].t) / 1000)) * 10) / 10 : 0;

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Blockchain Interna</div>
          <div className="screen-sub">Cadena Vértice-1 · Consenso PoS-BFT · Validadores: 21 · Tiempo de bloque ~8s</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill up"><span className="live-dot" />En vivo</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Último bloque</div>
          <div className="v">#{lastBlock?.n.toLocaleString()}</div>
          <div className="d mono">{lastBlock ? VData.fmt.age(lastBlock.t) + " atrás" : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="k">TPS (1 min)</div>
          <div className="v">{tps}</div>
          <div className="d">Pico: 4,210</div>
        </div>
        <div className="stat-card">
          <div className="k">Tx totales</div>
          <div className="v">28.4M</div>
          <div className="d">Hoy: 412,820</div>
        </div>
        <div className="stat-card">
          <div className="k">Anti-duplicación</div>
          <div className="v up">100%</div>
          <div className="d">0 colisiones en 24h</div>
        </div>
      </div>

      <div className="split-2">
        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-h">
            <span className="card-t">Bloques recientes</span>
            <span className="dim mono" style={{ fontSize: 11 }}>actualizando…</span>
          </div>
          <div className="scroll-y" style={{ flex: 1, maxHeight: 460 }}>
            {blocks.map((b, i) => (
              <div key={b.n} className="block-row" style={{ animation: i === 0 ? "flash-up 1.2s ease-out" : undefined }}>
                <span className="bn">#{b.n}</span>
                <span className="hash">{b.hash}</span>
                <span className="sig">{b.sig}</span>
                <span className="dim mono" style={{ fontSize: 11 }}>{b.txCount} tx</span>
                <span className="ok r">ANTI-DUP OK</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-h">
            <span className="card-t">Stream de transacciones</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{txs.length}/24</span>
          </div>
          <div className="scroll-y" style={{ flex: 1, maxHeight: 460 }}>
            {txs.length === 0 && <div className="empty">Esperando transacciones…</div>}
            {txs.map((t, i) => (
              <div key={t.hash + i} style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 1fr 90px",
                gap: 12,
                padding: "9px 14px",
                borderBottom: "1px solid var(--border-soft)",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                animation: i === 0 ? "flash-up 1s ease-out" : undefined,
              }}>
                <span style={{ fontWeight: 600, color: "var(--accent)", fontSize: 10, letterSpacing: "0.08em" }}>{t.type}</span>
                <span style={{ color: "var(--text)" }}>{t.asset}</span>
                <span className="dim">{t.from} → {t.to}</span>
                <span className="dim r">{VData.fmt.age(t.t)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════
function AdminScreen() {
  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Administración</div>
          <div className="screen-sub">Panel de operaciones · Métricas globales del exchange y herramientas internas</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Usuarios activos</div>
          <div className="v">88,091</div>
          <div className="d up">+ 1,420 esta semana</div>
        </div>
        <div className="stat-card">
          <div className="k">Tokens creados</div>
          <div className="v">431</div>
          <div className="d">23 pendientes de verificar</div>
        </div>
        <div className="stat-card">
          <div className="k">Movimientos globales 24h</div>
          <div className="v">$402M</div>
          <div className="d">12,841 trades/min · pico</div>
        </div>
        <div className="stat-card">
          <div className="k">Salud del sistema</div>
          <div className="v up">Óptimo</div>
          <div className="d">Latencia API: 24ms · 99.99% uptime</div>
        </div>
      </div>

      <div className="split-2">
        <div className="card">
          <div className="card-h">
            <span className="card-t">Alertas operativas</span>
            <span className="dim mono" style={{ fontSize: 11 }}>3 abiertas</span>
          </div>
          <div className="card-b" style={{ gap: 10 }}>
            <Alert level="warn" t="Validador #14 en cooldown" d="Recuperándose hace 2 min · sin impacto en consenso" />
            <Alert level="info" t="Aumento de volumen NXP/USDT" d="+184% en 1h · liquidez profunda OK" />
            <Alert level="info" t="Nuevo token desplegado · #042" d="Neon X Protocol pendiente de auditoría automática" />
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <span className="card-t">Acciones rápidas</span>
          </div>
          <div className="card-b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              "Pausar trading (par)", "Forzar firma de bloque",
              "Aprobar retiro >100k", "Auditar token",
              "Rotar claves HSM", "Boletín a usuarios",
            ].map((label, i) => (
              <button key={i} className="btn ghost" style={{ justifyContent: "flex-start" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div className="card-h">
          <span className="card-t">Top usuarios por volumen 24h</span>
          <button className="chip">Exportar</button>
        </div>
        <div className="tbl">
          <div className="tbl-h" style={{ gridTemplateColumns: "40px 1.2fr 1fr 1fr 1fr 1fr 120px" }}>
            <span>#</span><span>USUARIO</span><span className="r">VOL 24h</span><span className="r">TRADES</span><span className="r">ÚLTIMA ACTIVIDAD</span><span className="r">TIER</span><span className="r">ESTADO</span>
          </div>
          {[
            { u: "0xA45...E91", vol: 4_218_400, tr: 421, last: "12s", tier: "Platino" },
            { u: "0x91B...13A", vol: 2_801_240, tr: 286, last: "44s", tier: "Platino" },
            { u: "0x00F...CC2", vol: 1_812_802, tr: 184, last: "2m", tier: "Oro" },
            { u: "0xDA9...AA1", vol: 1_204_140, tr: 142, last: "5m", tier: "Oro" },
            { u: "0xA8C...77D", vol: 824_640, tr: 84, last: "8m", tier: "Plata" },
            { u: "0x33E...B12", vol: 612_180, tr: 62, last: "12m", tier: "Plata" },
          ].map((u, i) => (
            <div key={i} className="tbl-r" style={{ gridTemplateColumns: "40px 1.2fr 1fr 1fr 1fr 1fr 120px" }}>
              <span className="mono dim">{String(i + 1).padStart(2, "0")}</span>
              <span className="mono">{u.u}</span>
              <span className="r mono">${VData.fmt.vol(u.vol)}</span>
              <span className="r mono">{u.tr}</span>
              <span className="r mono dim">{u.last} atrás</span>
              <span className="r">
                <span className="pill solid">{u.tier}</span>
              </span>
              <span className="r up mono" style={{ fontSize: 10, letterSpacing: "0.1em" }}>VERIFICADO</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Alert({ level, t, d }) {
  const color = level === "warn" ? "var(--warn)" : level === "err" ? "var(--negative)" : "var(--accent)";
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 12px", background: "var(--bg-soft)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, marginTop: 6, flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{t}</span>
        <span className="dim">{d}</span>
      </div>
    </div>
  );
}

Object.assign(window, { MercadosScreen, WalletScreen, FactoryScreen, BlockchainScreen, AdminScreen });
