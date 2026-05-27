// trading.jsx — Pantalla Trading
// Layout: pair header · chart · order book · order form · bottom tabs

const { useState: useStateT, useEffect: useEffectT, useRef: useRefT, useMemo: useMemoT } = React;

function TradingScreen({ chartType }) {
  const [pair, setPair] = useStateT(VData.activePair());
  const [tf, setTf] = useStateT(VData.market.activeTf);
  const [book, setBook] = useStateT(VData.market.book);
  const [fills, setFills] = useStateT([...VData.market.fills]);
  const [bottomTab, setBottomTab] = useStateT("orders");
  const [openOrders, setOpenOrders] = useStateT([...VData.market.openOrders]);

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
      <ChartPane pair={pair} tf={tf} setTf={setTimeframe} chartType={chartType} openOrders={openOrders} />
      <BookForm pair={pair} book={book} openOrders={openOrders} setOpenOrders={setOpenOrders} setBottomTab={setBottomTab} />
      <BottomPane tab={bottomTab} setTab={setBottomTab} fills={fills} openOrders={openOrders} setOpenOrders={setOpenOrders} />
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
function ChartPane({ pair, tf, setTf, chartType, openOrders }) {
  const canvasRef = useRefT(null);
  const volCanvasRef = useRefT(null);
  const [indicators, setIndicators] = useStateT({ vol: true, ma: false });
  const indicatorsRef = useRefT(indicators);
  indicatorsRef.current = indicators;
  const openOrdersRef = useRefT(openOrders);
  openOrdersRef.current = openOrders;
  const [maximized, setMaximized] = useStateT(false);

  const viewRef = useRefT({ candleCount: null, offset: 0, yMin: null, yMax: null });
  const dragRef = useRefT(null);
  const renderRef = useRefT(null);

  // Reset view when pair or timeframe changes
  useEffectT(() => {
    viewRef.current = { candleCount: null, offset: 0, yMin: null, yMax: null };
  }, [pair.sym, tf]);

  useEffectT(() => {
    let raf;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      if (!canvasRef.current) return;
      const candles = VData.activeCandles();
      const v = viewRef.current;
      const count = v.candleCount != null ? v.candleCount : candles.length;
      const offset = Math.max(0, v.offset);
      const end = Math.max(1, candles.length - offset);
      const start = Math.max(0, end - count);
      const visible = candles.slice(start, end);
      const orders = openOrdersRef.current;
      let orderLines = null;
      if (orders.length > 0) {
        const first = orders[0];
        const entry = first.price;
        const isBuy = first.side === "buy";
        orderLines = {
          entry,
          tp: +(entry * (isBuy ? 1.03 : 0.97)).toFixed(2),
          sl: +(entry * (isBuy ? 0.97 : 1.03)).toFixed(2),
        };
      }

      let yMin = v.yMin;
      let yMax = v.yMax;
      if (orderLines && visible.length) {
        const orderPrices = [orderLines.entry, orderLines.tp, orderLines.sl];
        if (yMin == null && yMax == null) {
          let lo = Math.min(...orderPrices);
          let hi = Math.max(...orderPrices);
          visible.forEach(c => { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; });
          const r = hi - lo || 1;
          yMin = lo - r * 0.08;
          yMax = hi + r * 0.08;
        } else {
          const pad = (yMax - yMin) * 0.06 || 1;
          orderPrices.forEach(p => {
            if (p < yMin) yMin = p - pad;
            if (p > yMax) yMax = p + pad;
          });
        }
      }

      VChart.draw(canvasRef.current, visible, {
        type: chartType,
        orders: orderLines,
        yMin,
        yMax,
        showVol: false,
      });
      if (indicatorsRef.current.vol && volCanvasRef.current) {
        VChart.drawVolume(volCanvasRef.current, visible);
      }
    };
    renderRef.current = render;
    render();

    const onWheel = (e) => {
      e.preventDefault();
      const candles = VData.activeCandles();
      const v = viewRef.current;
      const currentCount = v.candleCount != null ? v.candleCount : candles.length;
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      viewRef.current = { ...v, candleCount: Math.round(Math.min(candles.length, Math.max(10, currentCount * factor))) };
      render();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const off = VData.subscribe("tick", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    });

    const onTweak = () => render();
    const onResize = () => render();
    window.addEventListener("tweakchange", onTweak);
    window.addEventListener("resize", onResize);
    return () => {
      off();
      cancelAnimationFrame(raf);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("tweakchange", onTweak);
      window.removeEventListener("resize", onResize);
    };
  }, [pair.sym, tf, chartType]);

  // Sync vol canvas: redraw on toggle and attach non-passive wheel so it zooms with the main chart
  useEffectT(() => {
    if (renderRef.current) renderRef.current();
    const volCanvas = volCanvasRef.current;
    if (!volCanvas) return;
    const onWheelVol = (e) => {
      e.preventDefault();
      const candles = VData.activeCandles();
      const v = viewRef.current;
      const currentCount = v.candleCount != null ? v.candleCount : candles.length;
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      viewRef.current = { ...v, candleCount: Math.round(Math.min(candles.length, Math.max(10, currentCount * factor))) };
      if (renderRef.current) renderRef.current();
    };
    volCanvas.addEventListener("wheel", onWheelVol, { passive: false });
    return () => volCanvas.removeEventListener("wheel", onWheelVol);
  }, [indicators.vol]);

  // Re-draw chart whenever open orders change
  useEffectT(() => {
    if (renderRef.current) renderRef.current();
  }, [openOrders]);

  // Escape to exit maximize
  useEffectT(() => {
    if (!maximized) return;
    const onKey = (e) => { if (e.key === "Escape") setMaximized(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const onMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotW = rect.width - 56;
    const candles = VData.activeCandles();
    const v = viewRef.current;
    const count = v.candleCount != null ? v.candleCount : candles.length;

    if (x > plotW) {
      // Y-axis drag → zoom price range
      const offset = Math.max(0, v.offset);
      const end = Math.max(1, candles.length - offset);
      const visible = candles.slice(Math.max(0, end - count), end);
      let lo = Infinity, hi = -Infinity;
      visible.forEach(c => { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; });
      const r = hi - lo || 1;
      const yMin = v.yMin != null ? v.yMin : lo - r * 0.05;
      const yMax = v.yMax != null ? v.yMax : hi + r * 0.05;
      dragRef.current = { type: "yzoom", startY: e.clientY, yCenter: (yMin + yMax) / 2, yRange: yMax - yMin };
      canvas.style.cursor = "ns-resize";
    } else {
      // Chart area drag → pan X
      dragRef.current = { type: "pan", startX: e.clientX, startOffset: v.offset, count, total: candles.length };
      canvas.style.cursor = "grabbing";
    }
  };

  const onMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const d = dragRef.current;
    const v = viewRef.current;

    if (!d) {
      const rect = canvas.getBoundingClientRect();
      canvas.style.cursor = e.clientX - rect.left > rect.width - 56 ? "ns-resize" : "crosshair";
      return;
    }

    if (d.type === "pan") {
      const rect = canvas.getBoundingClientRect();
      const plotW = rect.width - 56;
      const dx = e.clientX - d.startX;
      const pxPerCandle = plotW / Math.max(1, d.count);
      const delta = -Math.round(dx / pxPerCandle);
      viewRef.current = { ...v, offset: Math.max(0, Math.min(Math.max(0, d.total - d.count), d.startOffset + delta)) };
    } else if (d.type === "yzoom") {
      const factor = Math.exp((e.clientY - d.startY) * 0.008);
      const half = (d.yRange * factor) / 2;
      viewRef.current = { ...v, yMin: d.yCenter - half, yMax: d.yCenter + half };
    }
    if (renderRef.current) renderRef.current();
  };

  const onMouseUp = () => {
    dragRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "crosshair";
  };

  const onDblClick = () => {
    viewRef.current = { candleCount: null, offset: 0, yMin: null, yMax: null };
    if (renderRef.current) renderRef.current();
  };

  const maxStyle = maximized
    ? { position: "fixed", inset: 0, zIndex: 1000, borderRadius: 0, margin: 0 }
    : {};

  return (
    <div className="card chart-pane" style={maxStyle}>
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
          <button className="chip" onClick={() => setMaximized(m => !m)} title={maximized ? "Restaurar · Esc" : "Maximizar"}>
            {maximized ? "⊟" : "⊞"}
          </button>
        </div>
      </div>
      <div className="chart-canvas-wrap" style={{ position: "relative", flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <canvas
          ref={canvasRef}
          className="chart"
          style={{ flex: "1 1 0", minHeight: 0, height: 0, cursor: "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDblClick}
        />
        {indicators.vol && (
          <canvas
            ref={volCanvasRef}
            style={{ flexShrink: 0, height: 64, width: "100%", display: "block", cursor: "crosshair" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          />
        )}
      </div>
    </div>
  );
}

// ── Order book + Order form ─────────────────────────────
function BookForm({ pair, book, openOrders, setOpenOrders, setBottomTab }) {
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

      <OrderForm pair={pair} setOpenOrders={setOpenOrders} setBottomTab={setBottomTab} />
    </div>
  );
}

function OrderForm({ pair, setOpenOrders, setBottomTab }) {
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

        <button className={"btn block lg " + (side === "buy" ? "btn-pos" : "btn-neg")} style={{ marginTop: 4 }}
          disabled={!Number(size)}
          onClick={() => {
            const sz = Number(size);
            if (!sz) return;
            const px = type === "market" ? pair.price : (Number(price) || pair.price);
            const newOrder = { id: "ord-" + Date.now(), side, type, pair: `${pair.sym}/${pair.quote}`, price: px, size: sz, filled: 0, t: Date.now() };
            setOpenOrders((prev) => [...prev, newOrder]);
            setBottomTab("orders");
            setSize(""); setPct(null);
          }}>
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
function BottomPane({ tab, setTab, fills, openOrders, setOpenOrders }) {
  return (
    <div className="card bottom-pane">
      <div className="card-h">
        <div className="tabs">
          <button data-active={tab === "orders"} onClick={() => setTab("orders")}>
            Órdenes abiertas{openOrders.length > 0 ? ` · ${openOrders.length}` : ""}
          </button>
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
        {tab === "orders" && <OpenOrdersTab orders={openOrders} setOrders={setOpenOrders} />}
        {tab === "fills" && <FillsTab fills={fills} />}
        {tab === "watch" && <WatchlistTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}

function OpenOrdersTab({ orders, setOrders }) {
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
