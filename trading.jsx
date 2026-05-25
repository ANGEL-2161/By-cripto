// trading.jsx — Pantalla Trading
// Layout: pair header · chart · order book · order form · bottom tabs

const { useState: useStateT, useEffect: useEffectT, useRef: useRefT, useMemo: useMemoT } = React;

function TradingScreen({ chartType }) {
  const [pair, setPair] = useStateT(VData.activePair());
  const [tf, setTf] = useStateT(VData.market.activeTf);
  const [book, setBook] = useStateT(VData.market.book);
  const [fills, setFills] = useStateT([...VData.market.fills]);
  const [bottomTab, setBottomTab] = useStateT("orders");

  useEffectT(() => {
    const offTick = VData.subscribe("tick", ({ pair }) => setPair({ ...pair }));
    const offBook = VData.subscribe("book", (b) => setBook({ ...b }));
    const offTrade = VData.subscribe("trade", () => setFills([...VData.market.fills]));
    return () => { offTick(); offBook(); offTrade(); };
  }, []);

  const setTimeframe = (t) => {
    VData.setActive(null, t);
    setTf(t);
  };

  return (
    <div className="trading">
      <PairHeader pair={pair} />
      <ChartPane pair={pair} tf={tf} setTf={setTimeframe} chartType={chartType} />
      <BookForm pair={pair} book={book} />
      <BottomPane tab={bottomTab} setTab={setBottomTab} fills={fills} />
    </div>
  );
}

// ── Pair header ─────────────────────────────────────────
function PairHeader({ pair }) {
  const high24 = pair.basePrice * (1 + 0.064);
  const low24 = pair.basePrice * (1 - 0.038);
  const vol24 = pair.vol * pair.basePrice;
  return (
    <div className="pair-head">
      <div className="pair-head-inner">
        <div className="pair-id">
          <div className="pair-glyph" style={{ background: pair.color ? `linear-gradient(135deg, ${pair.color}, ${pair.color}aa)` : undefined }}>
            {pair.sym.slice(0, 3)}
          </div>
          <div>
            <div className="pair-name">{pair.sym}/{pair.quote}</div>
            <div className="pair-meta">{pair.name} · live pair</div>
          </div>
        </div>

        <div />

        <div className="pair-stats">
          <div className="stat big">
            <div className="k">Precio actual</div>
            <div className="v">
              <PriceCell value={pair.price} format={(v) => "$" + VData.fmt.price(v)} />
            </div>
          </div>
          <div className="stat">
            <div className="k">24h Cambio</div>
            <div className="v" style={{ color: pair.ch >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {VData.fmt.pct(pair.ch)}
            </div>
          </div>
          <div className="stat">
            <div className="k">24h Alto</div>
            <div className="v">${VData.fmt.price(Math.max(pair.high, high24))}</div>
          </div>
          <div className="stat">
            <div className="k">24h Bajo</div>
            <div className="v">${VData.fmt.price(Math.min(pair.low, low24))}</div>
          </div>
          <div className="stat">
            <div className="k">Volumen 24h</div>
            <div className="v">${VData.fmt.vol(vol24)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chart pane ──────────────────────────────────────────
function ChartPane({ pair, tf, setTf, chartType }) {
  const canvasRef = useRefT(null);
  const [indicators, setIndicators] = useStateT({ vol: true, ma: false });
  const [orderResult, setOrderResult] = useStateT(null);
  const ordersRef = useRefT(null);
  if (!ordersRef.current || ordersRef.current._sym !== pair.sym) {
    const entry = +(pair.basePrice * 0.988).toFixed(2);
    ordersRef.current = { _sym: pair.sym, entry, tp: +(entry * 1.035).toFixed(2), sl: +(entry * 0.982).toFixed(2), active: true };
  }

  useEffectT(() => {
    let raf;
    const render = () => {
      if (canvasRef.current) {
        const candles = VData.activeCandles();
        const o = ordersRef.current;
        const orders = o.active ? { entry: o.entry, tp: o.tp, sl: o.sl } : null;
        VChart.draw(canvasRef.current, candles, { type: chartType, orders });
      }
    };
    render();
    const off = VData.subscribe("tick", ({ pair: p }) => {
      const o = ordersRef.current;
      if (o.active && o._sym === p.sym) {
        const candles = VData.activeCandles();
        const last = candles[candles.length - 1];
        let hit = null;
        if (last.h >= o.tp) {
          hit = { type: "ganancia", pct: +((o.tp - o.entry) / o.entry * 100).toFixed(2) };
        } else if (last.l <= o.sl) {
          hit = { type: "perdida", pct: +((o.sl - o.entry) / o.entry * 100).toFixed(2) };
        }
        if (hit) {
          o.active = false;
          setOrderResult(hit);
          setTimeout(() => {
            const cp = VData.activePair();
            const newEntry = +(cp.price * 0.998).toFixed(2);
            ordersRef.current = { _sym: cp.sym, entry: newEntry, tp: +(newEntry * 1.035).toFixed(2), sl: +(newEntry * 0.982).toFixed(2), active: true };
            setOrderResult(null);
          }, 4000);
        }
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });
    const onTweak = () => render();
    window.addEventListener("tweakchange", onTweak);
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    return () => { off(); cancelAnimationFrame(raf); window.removeEventListener("tweakchange", onTweak); window.removeEventListener("resize", onResize); };
  }, [pair.sym, tf, chartType]);

  return (
    <div className="card chart-pane">
      <div className="card-h">
        <div className="chart-toolbar">
          <span className="card-t" style={{ color: "var(--accent)" }}>
            <span className="live-dot" />
            LIVE PAIR
          </span>
          <div className="tf-bar" style={{ marginLeft: 6 }}>
            {VData.TIMEFRAMES.map((t) => (
              <button key={t} data-active={t === tf} onClick={() => setTf(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="chart-toolbar">
          <button className="chip" data-active={indicators.ma} onClick={() => setIndicators((s) => ({ ...s, ma: !s.ma }))}>MA(20)</button>
          <button className="chip" data-active={indicators.vol} onClick={() => setIndicators((s) => ({ ...s, vol: !s.vol }))}>Volumen</button>
          <button className="chip">RSI</button>
          <button className="chip">+ Indicador</button>
        </div>
      </div>
      <div className="chart-canvas-wrap" style={{ position: "relative" }}>
        <canvas ref={canvasRef} className="chart" />
        {orderResult && (
          <div style={{
            position: "absolute", top: 12, right: 70,
            background: orderResult.type === "ganancia" ? "#2e7d32" : "#c62828",
            color: "#fff", padding: "6px 16px", borderRadius: 4,
            fontFamily: "var(--font-mono, monospace)", fontWeight: 700, fontSize: 13,
            letterSpacing: "0.05em", boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}>
            {orderResult.type === "ganancia"
              ? `ORDEN CERRADA · GANANCIA +${orderResult.pct}%`
              : `ORDEN CERRADA · PÉRDIDA ${orderResult.pct}%`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order book + Order form ─────────────────────────────
function BookForm({ pair, book }) {
  return (
    <div className="bookform">
      <div className="card book">
        <div className="card-h" style={{ padding: "10px 14px" }}>
          <span className="card-t">Order Book</span>
          <div className="chart-toolbar">
            <span className="chip" data-active="true">0.01</span>
            <span className="chip">0.1</span>
            <span className="chip">1.0</span>
          </div>
        </div>
        <div className="book-grid">
          <span>Precio (USDT)</span>
          <span>Cantidad ({pair.sym})</span>
          <span>Total</span>
        </div>
        <div className="book-rows">
          <div className="book-side asks">
            {book.asks.slice().reverse().slice(0, 8).map((r, i) => {
              const wPct = (r.sum / book.maxSum) * 100;
              return (
                <div key={"a" + i} className="book-row">
                  <span className="depth down" style={{ width: wPct + "%", right: 0, left: "auto" }} />
                  <span className="price down">{VData.fmt.price(r.p)}</span>
                  <span>{r.s.toFixed(3)}</span>
                  <span className="dim">{r.sum.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
          <div className="book-spread">
            <span className="last" style={{ color: pair.ch >= 0 ? "var(--positive)" : "var(--negative)" }}>
              <PriceCell value={pair.price} format={(v) => "$" + VData.fmt.price(v)} />
            </span>
            <span className="spr">spread {((book.asks[0].p - book.bids[0].p) / pair.price * 100).toFixed(3)}%</span>
          </div>
          <div className="book-side bids">
            {book.bids.slice(0, 8).map((r, i) => {
              const wPct = (r.sum / book.maxSum) * 100;
              return (
                <div key={"b" + i} className="book-row">
                  <span className="depth up" style={{ width: wPct + "%", right: 0, left: "auto" }} />
                  <span className="price up">{VData.fmt.price(r.p)}</span>
                  <span>{r.s.toFixed(3)}</span>
                  <span className="dim">{r.sum.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <OrderForm pair={pair} />
    </div>
  );
}

function OrderForm({ pair }) {
  const [side, setSide] = useStateT("buy");
  const [type, setType] = useStateT("limit");
  const [price, setPrice] = useStateT(pair.price.toFixed(2));
  const [size, setSize] = useStateT("");
  const [pct, setPct] = useStateT(null);

  useEffectT(() => { setPrice(pair.price.toFixed(2)); }, [pair.sym]);

  const total = (Number(price) || 0) * (Number(size) || 0);
  const avail = side === "buy" ? 482910.5 : 124.84;
  const availUnit = side === "buy" ? "USDT" : pair.sym;

  const applyPct = (p) => {
    setPct(p);
    const max = side === "buy" ? avail / (Number(price) || pair.price) : avail;
    setSize((max * p / 100).toFixed(4));
  };

  return (
    <div className="card order">
      <div className="card-h">
        <span className="card-t">Crear orden · {pair.sym}/{pair.quote}</span>
      </div>
      <div className="card-b">
        <div className="order-side">
          <button data-active={side === "buy" ? "buy" : null} onClick={() => setSide("buy")}>Comprar</button>
          <button data-active={side === "sell" ? "sell" : null} onClick={() => setSide("sell")}>Vender</button>
        </div>

        <div className="order-type">
          {["limit", "market", "stop"].map((t) => (
            <button key={t} data-active={type === t} onClick={() => setType(t)}>
              {t === "limit" ? "Límite" : t === "market" ? "Mercado" : "Stop"}
            </button>
          ))}
        </div>

        <div className="field">
          <div className="field-l">Precio</div>
          <div className="input-suffix">
            <input className="input" value={type === "market" ? "Mejor disponible" : price} onChange={(e) => setPrice(e.target.value)} disabled={type === "market"} />
            {type !== "market" && <span className="suf">{pair.quote}</span>}
          </div>
        </div>

        <div className="field">
          <div className="field-l">Cantidad</div>
          <div className="input-suffix">
            <input className="input" placeholder="0.00" value={size} onChange={(e) => setSize(e.target.value)} />
            <span className="suf">{pair.sym}</span>
          </div>
        </div>

        <div className="order-pct">
          {[25, 50, 75, 100].map((p) => (
            <button key={p} data-active={pct === p} onClick={() => applyPct(p)}>{p}%</button>
          ))}
        </div>

        <div className="order-total">
          <span className="k">Disponible</span>
          <span className="v">{VData.fmt.size(avail)} {availUnit}</span>
        </div>
        <div className="order-total">
          <span className="k">Total</span>
          <span className="v">{VData.fmt.size(total)} {pair.quote}</span>
        </div>
        <div className="order-total">
          <span className="k">Comisión</span>
          <span className="v">0.10% · {VData.fmt.size(total * 0.001)} {pair.quote}</span>
        </div>

        <button className={"btn block lg " + (side === "buy" ? "btn-pos" : "btn-neg")} style={{ marginTop: 4 }}>
          {side === "buy" ? "Comprar" : "Vender"} {pair.sym}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-mute)", justifyContent: "center" }}>
          {I.shield}
          <span>Firma Ed25519 · Anti-duplicación en vivo</span>
        </div>
      </div>
    </div>
  );
}

// ── Bottom pane (Open orders / Fills / Watchlist) ───────
function BottomPane({ tab, setTab, fills }) {
  return (
    <div className="card bottom-pane">
      <div className="card-h">
        <div className="tabs">
          <button data-active={tab === "orders"} onClick={() => setTab("orders")}>Órdenes abiertas · 3</button>
          <button data-active={tab === "fills"} onClick={() => setTab("fills")}>Ejecuciones</button>
          <button data-active={tab === "watch"} onClick={() => setTab("watch")}>Watchlist</button>
          <button data-active={tab === "history"} onClick={() => setTab("history")}>Historial</button>
        </div>
        <div className="card-actions" style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <button className="chip">Solo este par</button>
          <button className="chip">Exportar CSV</button>
        </div>
      </div>
      <div className="scroll-y" style={{ flex: 1 }}>
        {tab === "orders" && <OpenOrdersTab />}
        {tab === "fills" && <FillsTab fills={fills} />}
        {tab === "watch" && <WatchlistTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}

function OpenOrdersTab() {
  const [orders, setOrders] = useStateT(VData.market.openOrders);
  return (
    <div className="tbl" style={{ gridTemplateColumns: "1fr" }}>
      <div className="tbl-h" style={{ gridTemplateColumns: "100px 100px 80px 90px 1fr 1fr 1fr 1fr 60px" }}>
        <span>HORA</span>
        <span>PAR</span>
        <span>LADO</span>
        <span>TIPO</span>
        <span className="r">PRECIO</span>
        <span className="r">CANTIDAD</span>
        <span className="r">EJECUTADO</span>
        <span className="r">TOTAL</span>
        <span />
      </div>
      {orders.map((o) => (
        <div key={o.id} className="tbl-r" style={{ gridTemplateColumns: "100px 100px 80px 90px 1fr 1fr 1fr 1fr 60px" }}>
          <span className="mono dim">{new Date(o.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span>{o.pair}</span>
          <span className={o.side === "buy" ? "up" : "down"} style={{ fontWeight: 600 }}>
            {o.side === "buy" ? "COMPRA" : "VENTA"}
          </span>
          <span className="dim">{o.type.toUpperCase()}</span>
          <span className="r mono">{VData.fmt.price(o.price)}</span>
          <span className="r mono">{VData.fmt.size(o.size)}</span>
          <span className="r mono">{((o.filled / o.size) * 100).toFixed(0)}% · {VData.fmt.size(o.filled)}</span>
          <span className="r mono">{VData.fmt.size(o.price * o.size)}</span>
          <button className="chip" onClick={() => setOrders(orders.filter((x) => x.id !== o.id))}>Cancelar</button>
        </div>
      ))}
      {orders.length === 0 && <div className="empty">Sin órdenes abiertas</div>}
    </div>
  );
}

function FillsTab({ fills }) {
  return (
    <div className="tbl">
      <div className="tbl-h" style={{ gridTemplateColumns: "100px 80px 1fr 1fr 1fr" }}>
        <span>HORA</span>
        <span>LADO</span>
        <span className="r">PRECIO</span>
        <span className="r">CANTIDAD</span>
        <span className="r">TOTAL</span>
      </div>
      {fills.slice(0, 20).map((f, i) => (
        <div key={f.id + i} className={"tbl-r " + (f.side === "buy" ? "flash-up" : "flash-down")} style={{ gridTemplateColumns: "100px 80px 1fr 1fr 1fr" }}>
          <span className="mono dim">{new Date(f.t).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          <span className={f.side === "buy" ? "up" : "down"} style={{ fontWeight: 600 }}>
            {f.side === "buy" ? "COMPRA" : "VENTA"}
          </span>
          <span className={"r mono " + (f.side === "buy" ? "up" : "down")}>{VData.fmt.price(f.price)}</span>
          <span className="r mono">{VData.fmt.size(f.size)}</span>
          <span className="r mono">{VData.fmt.size(f.size * f.price)}</span>
        </div>
      ))}
    </div>
  );
}

function WatchlistTab() {
  const [pairs, setPairs] = useStateT([...VData.pairs]);
  useEffectT(() => {
    const off = VData.subscribe("tickAll", (ps) => setPairs([...ps]));
    return off;
  }, []);
  return (
    <div className="tbl">
      <div className="tbl-h" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 90px" }}>
        <span>PAR</span>
        <span className="r">PRECIO</span>
        <span className="r">24h</span>
        <span className="r">VOLUMEN</span>
        <span className="r">CHART</span>
      </div>
      {pairs.map((p) => (
        <div key={p.sym} className="tbl-r" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr 90px", cursor: "pointer" }}
             onClick={() => VData.setActive(p.sym, null)}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: p.color, display: "inline-block", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }} />
            <span><strong>{p.sym}</strong> <span className="dim">/ {p.quote}</span></span>
          </span>
          <span className="r mono"><PriceCell value={p.price} format={VData.fmt.price} /></span>
          <span className={"r " + (p.ch >= 0 ? "up" : "down")}>{VData.fmt.pct(p.ch)}</span>
          <span className="r mono dim">{VData.fmt.vol(p.vol * p.basePrice)}</span>
          <span className="r"><MiniSparkline pair={p} /></span>
        </div>
      ))}
    </div>
  );
}

function MiniSparkline({ pair }) {
  const candles = VData.activeCandles ? null : null;
  // Build a simple sparkline from random small drift around basePrice
  const points = useMemoT(() => {
    const arr = [];
    let p = pair.basePrice * 0.96;
    const target = pair.price;
    for (let i = 0; i < 20; i++) {
      p += (target - p) * 0.1 + (Math.random() - 0.5) * pair.basePrice * 0.004;
      arr.push(p);
    }
    arr.push(pair.price);
    return arr;
  }, [pair.sym, Math.floor(pair.price * 100)]);
  return <Sparkline data={points} color={pair.ch >= 0 ? "var(--positive)" : "var(--negative)"} />;
}

function HistoryTab() {
  const h = VData.market.history;
  return (
    <div className="tbl">
      <div className="tbl-h" style={{ gridTemplateColumns: "100px 100px 1fr 1fr 130px 100px" }}>
        <span>HORA</span>
        <span>TIPO</span>
        <span>ACTIVO</span>
        <span>HASH</span>
        <span>ESTADO</span>
        <span className="r">VER</span>
      </div>
      {h.map((row, i) => (
        <div key={i} className="tbl-r" style={{ gridTemplateColumns: "100px 100px 1fr 1fr 130px 100px" }}>
          <span className="mono dim">{VData.fmt.age(row.t)} atrás</span>
          <span style={{ fontWeight: 600 }}>{row.type}</span>
          <span>{row.asset}</span>
          <span className="mono dim">{row.hash}</span>
          <span className="up mono" style={{ fontSize: 11, letterSpacing: "0.06em" }}>{row.state}</span>
          <span className="r"><button className="chip">Detalle</button></span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { TradingScreen });
