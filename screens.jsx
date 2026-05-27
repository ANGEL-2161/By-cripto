// screens.jsx — Mercados / Indicadores / P&L / Paper Trading / Noticias / Admin
const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM } = React;

// ── Indicator math ────────────────────────────────────────
function _ema(data, p) {
  const k = 2 / (p + 1);
  const out = Array(data.length).fill(null);
  if (data.length < p) return out;
  let val = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p - 1] = val;
  for (let i = p; i < data.length; i++) { val = data[i] * k + val * (1 - k); out[i] = val; }
  return out;
}
function _calcRSI(closes, p = 14) {
  const out = Array(closes.length).fill(null);
  if (closes.length <= p) return out;
  const ch = closes.slice(1).map((c, i) => c - closes[i]);
  let ag = ch.slice(0, p).reduce((s, d) => s + (d > 0 ? d : 0), 0) / p;
  let al = ch.slice(0, p).reduce((s, d) => s + (d < 0 ? -d : 0), 0) / p;
  out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p; i < ch.length; i++) {
    const d = ch[i];
    ag = (ag * (p - 1) + (d > 0 ? d : 0)) / p;
    al = (al * (p - 1) + (d < 0 ? -d : 0)) / p;
    out[i + 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function _calcMACD(closes) {
  const e12 = _ema(closes, 12), e26 = _ema(closes, 26);
  const ml = closes.map((_, i) => (e12[i] != null && e26[i] != null) ? e12[i] - e26[i] : null);
  const fv = ml.findIndex(v => v != null);
  if (fv < 0) return { m: ml, sig: ml.map(() => null), hist: ml.map(() => null) };
  const sigSlice = _ema(ml.slice(fv).map(v => v ?? 0), 9);
  const sig = [...ml.slice(0, fv).map(() => null), ...sigSlice];
  const hist = ml.map((v, i) => (v != null && sig[i] != null) ? v - sig[i] : null);
  return { m: ml, sig, hist };
}
function _calcBB(closes, p = 20, k = 2) {
  return closes.map((_, i) => {
    if (i < p - 1) return null;
    const sl = closes.slice(i - p + 1, i + 1);
    const mean = sl.reduce((s, v) => s + v, 0) / p;
    const std = Math.sqrt(sl.reduce((s, v) => s + (v - mean) ** 2, 0) / p);
    return { u: mean + k * std, m: mean, l: mean - k * std };
  });
}

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
// INDICADORES TÉCNICOS
// ════════════════════════════════════════════════════════════
function IndicadoresScreen() {
  const [pair, setPair] = useS(VData.activePair());
  const mainRef = useR(null);
  const rsiRef = useR(null);
  const macdRef = useR(null);
  const [stats, setStats] = useS({ rsi: null, macd: null, sig: null, bb: null });

  useE(() => {
    let raf;
    const render = () => {
      const candles = VData.activeCandles();
      if (!candles.length) return;
      const closes = candles.map(c => c.c);
      const rsi = _calcRSI(closes);
      const { m, sig, hist } = _calcMACD(closes);
      const bb = _calcBB(closes);

      const lastRsi = rsi.filter(v => v != null).slice(-1)[0];
      const lastMacd = m.filter(v => v != null).slice(-1)[0];
      const lastSig = sig.filter(v => v != null).slice(-1)[0];
      const lastBb = bb.filter(v => v != null).slice(-1)[0];
      setStats({ rsi: lastRsi, macd: lastMacd, sig: lastSig, bb: lastBb });

      if (mainRef.current) VChart.draw(mainRef.current, candles, { type: "velas", showVol: false, bb });
      if (rsiRef.current) VChart.drawRSI(rsiRef.current, rsi);
      if (macdRef.current) VChart.drawMACD(macdRef.current, m, sig, hist);
    };

    render();
    const off = VData.subscribe("tick", ({ pair: p }) => {
      setPair({ ...p });
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    window.addEventListener("tweakchange", onResize);
    return () => {
      off(); cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("tweakchange", onResize);
    };
  }, []);

  const rsiColor = stats.rsi == null ? "var(--text-mute)"
    : stats.rsi > 70 ? "var(--negative)"
    : stats.rsi < 30 ? "var(--positive)"
    : "var(--text)";
  const rsiLabel = stats.rsi == null ? "calculando" : stats.rsi > 70 ? "Sobrecomprado" : stats.rsi < 30 ? "Sobrevendido" : "Neutral";

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Indicadores Técnicos</div>
          <div className="screen-sub">{pair.sym}/{pair.quote} · RSI(14) · MACD(12,26,9) · BB(20,2)</div>
        </div>
        <span className="pill up"><span className="live-dot" />En vivo</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">RSI (14)</div>
          <div className="v" style={{ color: rsiColor }}>{stats.rsi != null ? stats.rsi.toFixed(1) : "—"}</div>
          <div className="d">{rsiLabel}</div>
        </div>
        <div className="stat-card">
          <div className="k">MACD</div>
          <div className={"v " + (stats.macd != null ? (stats.macd > 0 ? "up" : "down") : "")}>{stats.macd != null ? stats.macd.toFixed(4) : "—"}</div>
          <div className="d">Señal: {stats.sig != null ? stats.sig.toFixed(4) : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="k">BB Superior</div>
          <div className="v">{stats.bb ? "$" + VData.fmt.price(stats.bb.u) : "—"}</div>
          <div className="d">Inferior: {stats.bb ? "$" + VData.fmt.price(stats.bb.l) : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="k">Ancho BB</div>
          <div className="v">{stats.bb ? VData.fmt.pct((stats.bb.u - stats.bb.l) / stats.bb.m * 100) : "—"}</div>
          <div className="d">Volatilidad relativa (BB%)</div>
        </div>
      </div>

      <div className="card ind-canvas-card">
        <div className="card-h"><span className="card-t">Precio · Bandas de Bollinger</span></div>
        <div className="ind-canvas-wrap" style={{ height: 260 }}>
          <canvas ref={mainRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="card ind-canvas-card">
          <div className="card-h"><span className="card-t">RSI (14)</span></div>
          <div className="ind-canvas-wrap" style={{ height: 140 }}>
            <canvas ref={rsiRef} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
        </div>
        <div className="card ind-canvas-card">
          <div className="card-h"><span className="card-t">MACD (12,26,9)</span></div>
          <div className="ind-canvas-wrap" style={{ height: 140 }}>
            <canvas ref={macdRef} style={{ width: "100%", height: "100%", display: "block" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// HISTORIAL P&L
// ════════════════════════════════════════════════════════════
const _PNL_HISTORY = [
  { id: "T-0841", sym: "BTC/USDT", side: "COMPRA", qty: 0.42, entry: 61240.0, exit: 64810.0, t: Date.now() - 7200000, status: "CERRADA" },
  { id: "T-0840", sym: "ETH/USDT", side: "VENTA", qty: 4.8, entry: 3284.5, exit: 3118.0, t: Date.now() - 18000000, status: "CERRADA" },
  { id: "T-0839", sym: "SOL/USDT", side: "COMPRA", qty: 48, entry: 142.8, exit: 138.4, t: Date.now() - 36000000, status: "CERRADA" },
  { id: "T-0838", sym: "BTC/USDT", side: "COMPRA", qty: 0.18, entry: 59820.0, exit: 62100.0, t: Date.now() - 86400000, status: "CERRADA" },
  { id: "T-0837", sym: "NXP/USDT", side: "COMPRA", qty: 12400, entry: 0.4102, exit: 0.5214, t: Date.now() - 172800000, status: "CERRADA" },
  { id: "T-0836", sym: "ETH/USDT", side: "VENTA", qty: 2.2, entry: 3410.0, exit: 3290.0, t: Date.now() - 259200000, status: "CERRADA" },
];

function PnlScreen() {
  const [openOrders] = useS([...VData.market.openOrders]);
  const [pair] = useS(VData.activePair());

  const closedPnl = _PNL_HISTORY.reduce((s, t) => {
    const raw = t.side === "COMPRA"
      ? (t.exit - t.entry) * t.qty
      : (t.entry - t.exit) * t.qty;
    return s + raw;
  }, 0);

  const winTrades = _PNL_HISTORY.filter(t => {
    const raw = t.side === "COMPRA" ? (t.exit - t.entry) : (t.entry - t.exit);
    return raw > 0;
  }).length;
  const winRate = (_PNL_HISTORY.length > 0 ? winTrades / _PNL_HISTORY.length * 100 : 0).toFixed(0);

  const bestTrade = _PNL_HISTORY.reduce((best, t) => {
    const raw = t.side === "COMPRA" ? (t.exit - t.entry) * t.qty : (t.entry - t.exit) * t.qty;
    return raw > best ? raw : best;
  }, 0);

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Historial P&amp;L</div>
          <div className="screen-sub">Posiciones abiertas y registro de ganancias y pérdidas realizadas</div>
        </div>
        <button className="btn ghost">Exportar CSV</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">P&amp;L realizado</div>
          <div className={"v " + (closedPnl >= 0 ? "up" : "down")}>{closedPnl >= 0 ? "+" : ""}${VData.fmt.vol(Math.abs(closedPnl))}</div>
          <div className="d">{_PNL_HISTORY.length} operaciones cerradas</div>
        </div>
        <div className="stat-card">
          <div className="k">Tasa de acierto</div>
          <div className="v up">{winRate}%</div>
          <div className="d">{winTrades} ganadoras · {_PNL_HISTORY.length - winTrades} perdedoras</div>
        </div>
        <div className="stat-card">
          <div className="k">Mejor operación</div>
          <div className="v up">+${VData.fmt.vol(bestTrade)}</div>
          <div className="d">BTC/USDT · 0.18 BTC</div>
        </div>
        <div className="stat-card">
          <div className="k">Posiciones abiertas</div>
          <div className="v">{openOrders.length}</div>
          <div className="d">Par activo: {pair.sym}/{pair.quote}</div>
        </div>
      </div>

      {openOrders.length > 0 && (
        <div className="card">
          <div className="card-h">
            <span className="card-t">Posiciones abiertas</span>
            <span className="pill up"><span className="live-dot" />{openOrders.length} activas</span>
          </div>
          <div className="tbl">
            <div className="tbl-h" style={{ gridTemplateColumns: "1fr 80px 1fr 1fr 1fr 1fr" }}>
              <span>PAR</span><span>LADO</span><span className="r">CANTIDAD</span><span className="r">ENTRADA</span><span className="r">TP</span><span className="r">SL</span>
            </div>
            {openOrders.map((o, i) => (
              <div key={i} className="tbl-r" style={{ gridTemplateColumns: "1fr 80px 1fr 1fr 1fr 1fr" }}>
                <span style={{ fontWeight: 600 }}>{o.sym || (pair.sym + "/USDT")}</span>
                <span className={o.side === "VENTA" ? "down" : "up"} style={{ fontWeight: 600 }}>{o.side || "COMPRA"}</span>
                <span className="r mono">{VData.fmt.size(o.qty || 0)}</span>
                <span className="r mono">${VData.fmt.price(o.price || 0)}</span>
                <span className="r mono up">${VData.fmt.price(o.tp || 0)}</span>
                <span className="r mono down">${VData.fmt.price(o.sl || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div className="card-h">
          <span className="card-t">Operaciones cerradas</span>
          <span className="dim mono" style={{ fontSize: 11 }}>{_PNL_HISTORY.length} registros</span>
        </div>
        <div className="scroll-y" style={{ flex: 1 }}>
          <div className="tbl">
            <div className="tbl-h" style={{ gridTemplateColumns: "80px 1fr 80px 1fr 1fr 1fr 1fr 100px" }}>
              <span>ID</span><span>PAR</span><span>LADO</span><span className="r">CANTIDAD</span><span className="r">ENTRADA</span><span className="r">SALIDA</span><span className="r">P&amp;L</span><span className="r">HORA</span>
            </div>
            {_PNL_HISTORY.map((t) => {
              const pnl = t.side === "COMPRA" ? (t.exit - t.entry) * t.qty : (t.entry - t.exit) * t.qty;
              const pct = t.side === "COMPRA" ? (t.exit - t.entry) / t.entry * 100 : (t.entry - t.exit) / t.entry * 100;
              return (
                <div key={t.id} className="tbl-r" style={{ gridTemplateColumns: "80px 1fr 80px 1fr 1fr 1fr 1fr 100px" }}>
                  <span className="mono dim">{t.id}</span>
                  <span style={{ fontWeight: 600 }}>{t.sym}</span>
                  <span className={t.side === "VENTA" ? "down" : "up"} style={{ fontWeight: 600 }}>{t.side}</span>
                  <span className="r mono">{t.qty}</span>
                  <span className="r mono">${VData.fmt.price(t.entry)}</span>
                  <span className="r mono">${VData.fmt.price(t.exit)}</span>
                  <span className={"r mono " + (pnl >= 0 ? "up" : "down")}>
                    {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toFixed(0)} <span style={{ fontSize: 10 }}>({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
                  </span>
                  <span className="r mono dim">{VData.fmt.age(t.t)} atrás</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PAPER TRADING
// ════════════════════════════════════════════════════════════
const _PAPER_INIT = 10000;
function PaperScreen() {
  const [pair, setPair] = useS(VData.activePair());
  const [balance, setBalance] = useS(_PAPER_INIT);
  const [positions, setPositions] = useS([]);
  const [history, setHistory] = useS([]);
  const [form, setForm] = useS({ side: "COMPRA", qty: "1" });
  const [msg, setMsg] = useS(null);

  useE(() => {
    const off = VData.subscribe("tick", ({ pair: p }) => setPair({ ...p }));
    return off;
  }, []);

  const totalPosPnl = positions.reduce((s, p) => {
    const pnl = p.side === "COMPRA"
      ? (pair.price - p.entry) * p.qty
      : (p.entry - pair.price) * p.qty;
    return s + pnl;
  }, 0);

  const cost = parseFloat(form.qty || 0) * pair.price;
  const canBuy = form.side === "COMPRA" ? balance >= cost : positions.some(p => p.side === "COMPRA");

  const submitTrade = () => {
    const qty = parseFloat(form.qty);
    if (!qty || qty <= 0) return;
    const price = pair.price;

    if (form.side === "COMPRA") {
      const totalCost = qty * price;
      if (balance < totalCost) { setMsg({ type: "err", text: "Saldo insuficiente" }); return; }
      setBalance(b => b - totalCost);
      setPositions(ps => [...ps, { id: Date.now(), sym: pair.sym, side: "COMPRA", qty, entry: price, t: Date.now() }]);
      setMsg({ type: "ok", text: `Comprado ${qty} ${pair.sym} a $${VData.fmt.price(price)}` });
    } else {
      const pos = positions.find(p => p.sym === pair.sym && p.side === "COMPRA");
      if (!pos) { setMsg({ type: "err", text: "No hay posición abierta en " + pair.sym }); return; }
      const closeQty = Math.min(qty, pos.qty);
      const pnl = (price - pos.entry) * closeQty;
      setBalance(b => b + closeQty * price);
      setPositions(ps => ps.filter(p => p.id !== pos.id));
      setHistory(h => [{ ...pos, exit: price, pnl, closeQty, closeT: Date.now() }, ...h].slice(0, 20));
      setMsg({ type: pnl >= 0 ? "ok" : "warn", text: `Cerrado ${closeQty} ${pair.sym} · P&L ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}` });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const resetPaper = () => {
    setBalance(_PAPER_INIT);
    setPositions([]);
    setHistory([]);
    setMsg({ type: "ok", text: "Cuenta paper reiniciada" });
    setTimeout(() => setMsg(null), 2000);
  };

  const equity = balance + positions.reduce((s, p) => s + p.qty * pair.price, 0);

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Paper Trading</div>
          <div className="screen-sub">Practica sin riesgo con balance ficticio de ${_PAPER_INIT.toLocaleString()} USDT</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill" style={{ background: "var(--warn-soft, rgba(255,160,0,0.12))", color: "var(--warn, #ffa000)", border: "none" }}>PAPER MODE</span>
          <button className="btn ghost" onClick={resetPaper}>Reiniciar</button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: "var(--r-sm)", background: msg.type === "err" ? "var(--negative-soft)" : "var(--positive-soft)", color: msg.type === "err" ? "var(--negative)" : "var(--positive)", fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Equity total</div>
          <div className={"v " + (equity >= _PAPER_INIT ? "up" : "down")}>${equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div className={"d " + (equity >= _PAPER_INIT ? "up" : "down")}>{equity >= _PAPER_INIT ? "+" : ""}{((equity / _PAPER_INIT - 1) * 100).toFixed(2)}% vs inicio</div>
        </div>
        <div className="stat-card">
          <div className="k">Saldo libre (USDT)</div>
          <div className="v">${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
          <div className="d">{positions.length} posición{positions.length !== 1 ? "es" : ""} abiert{positions.length !== 1 ? "as" : "a"}</div>
        </div>
        <div className="stat-card">
          <div className="k">P&amp;L no realizado</div>
          <div className={"v " + (totalPosPnl >= 0 ? "up" : "down")}>{totalPosPnl >= 0 ? "+" : ""}${totalPosPnl.toFixed(2)}</div>
          <div className="d">Precio actual: ${VData.fmt.price(pair.price)}</div>
        </div>
        <div className="stat-card">
          <div className="k">Operaciones cerradas</div>
          <div className="v">{history.length}</div>
          <div className="d">P&amp;L realizado: ${history.reduce((s, h) => s + h.pnl, 0).toFixed(2)}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 12 }}>
        <div className="card">
          <div className="card-h"><span className="card-t">Ejecutar orden (paper)</span></div>
          <div className="card-b" style={{ gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button className="btn" style={{ background: form.side === "COMPRA" ? "var(--positive)" : "transparent", color: form.side === "COMPRA" ? "#fff" : "var(--text-soft)", border: "1px solid var(--border-soft)" }}
                onClick={() => setForm(f => ({ ...f, side: "COMPRA" }))}>Comprar</button>
              <button className="btn" style={{ background: form.side === "VENTA" ? "var(--negative)" : "transparent", color: form.side === "VENTA" ? "#fff" : "var(--text-soft)", border: "1px solid var(--border-soft)" }}
                onClick={() => setForm(f => ({ ...f, side: "VENTA" }))}>Vender</button>
            </div>
            <div className="field">
              <div className="field-l">Par activo</div>
              <div className="input" style={{ pointerEvents: "none", color: "var(--text-soft)" }}>{pair.sym}/{pair.quote}</div>
            </div>
            <div className="field">
              <div className="field-l">Precio actual</div>
              <div className="input" style={{ pointerEvents: "none" }}>${VData.fmt.price(pair.price)}</div>
            </div>
            <div className="field">
              <div className="field-l">Cantidad ({pair.sym})</div>
              <input className="input" type="number" min="0" step="0.01"
                value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg-soft)", borderRadius: "var(--r-sm)", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="dim">Coste estimado</span>
                <span className="mono">${cost.toFixed(2)} USDT</span>
              </div>
            </div>
            <button className="btn btn-primary lg" onClick={submitTrade} disabled={!canBuy && form.side === "COMPRA"}>
              {form.side === "COMPRA" ? `Comprar ${form.qty || 0} ${pair.sym}` : `Vender ${form.qty || 0} ${pair.sym}`}
            </button>
          </div>
        </div>

        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-h">
            <span className="card-t">Posiciones abiertas</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{positions.length} activas</span>
          </div>
          <div className="scroll-y" style={{ flex: 1 }}>
            {positions.length === 0 && <div className="empty">Sin posiciones abiertas</div>}
            <div className="tbl">
              {positions.map(p => {
                const pnl = p.side === "COMPRA" ? (pair.price - p.entry) * p.qty : (p.entry - pair.price) * p.qty;
                const pct = (pnl / (p.entry * p.qty)) * 100;
                return (
                  <div key={p.id} className="tbl-r" style={{ gridTemplateColumns: "1fr 80px 1fr 1fr 1fr" }}>
                    <span style={{ fontWeight: 600 }}>{p.sym}/USDT</span>
                    <span className={p.side === "VENTA" ? "down" : "up"}>{p.side}</span>
                    <span className="r mono">{p.qty} {p.sym}</span>
                    <span className="r mono">${VData.fmt.price(p.entry)}</span>
                    <span className={"r mono " + (pnl >= 0 ? "up" : "down")}>
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} <span style={{ fontSize: 10 }}>({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card" style={{ minHeight: 0 }}>
          <div className="card-h">
            <span className="card-t">Historial paper</span>
            <span className="dim mono" style={{ fontSize: 11 }}>{history.length} operaciones</span>
          </div>
          <div className="scroll-y" style={{ flex: 1, maxHeight: 280 }}>
            <div className="tbl">
              <div className="tbl-h" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
                <span>PAR</span><span className="r">ENTRADA</span><span className="r">SALIDA</span><span className="r">CANTIDAD</span><span className="r">P&amp;L</span>
              </div>
              {history.map((h, i) => (
                <div key={i} className="tbl-r" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
                  <span>{h.sym}/USDT</span>
                  <span className="r mono">${VData.fmt.price(h.entry)}</span>
                  <span className="r mono">${VData.fmt.price(h.exit)}</span>
                  <span className="r mono">{h.closeQty} {h.sym}</span>
                  <span className={"r mono " + (h.pnl >= 0 ? "up" : "down")}>{h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NOTICIAS DEL MERCADO CRIPTO
// ════════════════════════════════════════════════════════════
const _NOTICIAS = [
  { id: 1, cat: "BITCOIN", title: "Bitcoin supera los $65,000 en medio de expectativas de reducción de tasas", body: "El precio del BTC alcanzó nuevos máximos de 3 semanas mientras los inversores institucionales incrementan posiciones ante las señales de la Reserva Federal de una posible bajada de tipos en el segundo semestre.", src: "CryptoDesk", t: Date.now() - 420000, sentiment: "bullish" },
  { id: 2, cat: "REGULACIÓN", title: "Europa aprueba nuevas directrices para exchanges descentralizados bajo MiCA", body: "La Autoridad Bancaria Europea (EBA) publicó orientaciones finales para la aplicación de MiCA sobre protocolos DeFi, exigiendo KYC de nivel 2 para transacciones superiores a €1,000.", src: "RegWatch EU", t: Date.now() - 1800000, sentiment: "neutral" },
  { id: 3, cat: "ETHEREUM", title: "ETH registra salidas netas de ETFs por tercer día consecutivo — analistas ven oportunidad", body: "Los fondos cotizados de Ethereum acumulan $182M en salidas esta semana, aunque los analistas on-chain observan acumulación sostenida de wallets con más de 10,000 ETH.", src: "ETH Insider", t: Date.now() - 3600000, sentiment: "bearish" },
  { id: 4, cat: "ALTCOINS", title: "Solana procesa 12,400 TPS durante el pico de actividad de los Solana Games", body: "La red Solana batió récords de TPS durante el lanzamiento del torneo Solana Games, con tarifas promedio de 0.00025 SOL por transacción, consolidando su posición como cadena de alto rendimiento.", src: "SolScan Times", t: Date.now() - 5400000, sentiment: "bullish" },
  { id: 5, cat: "MACRO", title: "Dólar se debilita frente a monedas emergentes; criptomonedas se benefician de la rotación", body: "El índice DXY cayó un 0.8% tras los datos de inflación del PCE, favoreciendo flujos hacia activos alternativos. Bitcoin y Ethereum subieron en correlación inversa con el billete verde.", src: "Global Macro View", t: Date.now() - 7200000, sentiment: "bullish" },
  { id: 6, cat: "DEFI", title: "TVL en protocolos DeFi alcanza $98B — Aave y Uniswap lideran el crecimiento", body: "El valor total bloqueado en DeFi se aproxima a los $100B por primera vez desde 2022. Aave V3 y Uniswap v4 concentran el 38% del total, con yields de stablecoin en torno al 5.8% anualizado.", src: "DeFi Pulse Pro", t: Date.now() - 10800000, sentiment: "bullish" },
  { id: 7, cat: "MINERÍA", title: "Hashrate de Bitcoin alcanza un nuevo ATH de 680 EH/s tras la llegada del verano en Norteamérica", body: "La energía hidroeléctrica del noroeste de EE.UU. y Canadá impulsa el hashrate a niveles récord. La dificultad se ajustará al alza un estimado de 4.2% en el próximo bloque de reajuste.", src: "Hashrate Index", t: Date.now() - 14400000, sentiment: "bullish" },
];

const _SENT_COLOR = { bullish: "var(--positive)", neutral: "var(--accent)", bearish: "var(--negative)" };
const _SENT_LABEL = { bullish: "Alcista", neutral: "Neutral", bearish: "Bajista" };
const _SENT_CAT_COLOR = {
  BITCOIN: "#F7931A", ETHEREUM: "#627EEA", REGULACIÓN: "#8B5CF6",
  ALTCOINS: "#22D3EE", MACRO: "#60A5FA", DEFI: "#34D399", MINERÍA: "#FCD34D"
};

function NoticiasScreen() {
  const [filter, setFilter] = useS("todas");
  const [pairs] = useS([...VData.pairs]);

  const bullishCount = _NOTICIAS.filter(n => n.sentiment === "bullish").length;
  const bearishCount = _NOTICIAS.filter(n => n.sentiment === "bearish").length;
  const sentimentScore = Math.round((bullishCount / _NOTICIAS.length) * 100);

  const filtered = filter === "todas" ? _NOTICIAS
    : _NOTICIAS.filter(n => n.sentiment === filter);

  const topGainer = [...pairs].sort((a, b) => b.ch - a.ch)[0];
  const topLoser = [...pairs].sort((a, b) => a.ch - b.ch)[0];

  return (
    <div className="screen">
      <div className="screen-h">
        <div>
          <div className="screen-title">Noticias del Mercado</div>
          <div className="screen-sub">Feed de noticias cripto · Análisis de sentimiento en tiempo real</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" data-active={filter === "todas"} onClick={() => setFilter("todas")}>Todas</button>
          <button className="chip" data-active={filter === "bullish"} onClick={() => setFilter("bullish")}>↑ Alcistas</button>
          <button className="chip" data-active={filter === "bearish"} onClick={() => setFilter("bearish")}>↓ Bajistas</button>
          <button className="chip" data-active={filter === "neutral"} onClick={() => setFilter("neutral")}>Neutral</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="k">Sentimiento global</div>
          <div className="v up">{sentimentScore}% Alcista</div>
          <div style={{ height: 6, background: "var(--bg-soft)", borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: sentimentScore + "%", height: "100%", background: "var(--positive)", borderRadius: 3, transition: "width 0.6s" }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="k">Noticias bullish / bearish</div>
          <div className="v"><span className="up">{bullishCount}</span> <span className="dim">/ </span><span className="down">{bearishCount}</span></div>
          <div className="d">{_NOTICIAS.length} artículos hoy</div>
        </div>
        <div className="stat-card">
          <div className="k">Mayor ganador hoy</div>
          <div className="v up">{topGainer?.sym}</div>
          <div className="d up">{topGainer ? VData.fmt.pct(topGainer.ch) : ""}</div>
        </div>
        <div className="stat-card">
          <div className="k">Mayor perdedor hoy</div>
          <div className="v down">{topLoser?.sym}</div>
          <div className="d down">{topLoser ? VData.fmt.pct(topLoser.ch) : ""}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(n => (
          <div key={n.id} className="card news-card" style={{ flexDirection: "row", padding: 0 }}>
            <div className="news-accent" style={{ background: _SENT_COLOR[n.sentiment] }} />
            <div style={{ flex: 1, padding: "14px 18px 14px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className="news-cat" style={{ background: (_SENT_CAT_COLOR[n.cat] || "var(--accent)") + "22", color: _SENT_CAT_COLOR[n.cat] || "var(--accent)" }}>{n.cat}</span>
                <span className="dim mono" style={{ fontSize: 10 }}>{n.src}</span>
                <span className="dim mono" style={{ fontSize: 10, marginLeft: "auto" }}>{VData.fmt.age(n.t)} atrás</span>
                <span className="pill" style={{ color: _SENT_COLOR[n.sentiment], borderColor: _SENT_COLOR[n.sentiment] + "44", fontSize: 10 }}>{_SENT_LABEL[n.sentiment]}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4, marginBottom: 6 }}>{n.title}</div>
              <div className="dim" style={{ fontSize: 12, lineHeight: 1.5 }}>{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WALLET (kept for internal reference — not shown in nav)
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

Object.assign(window, { MercadosScreen, IndicadoresScreen, PnlScreen, PaperScreen, NoticiasScreen, AdminScreen });
