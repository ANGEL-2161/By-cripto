// data.js — Motor de datos simulados para Vértice Exchange OS
// API: window.VData
//   .market — estado global del par activo
//   .subscribe(channel, fn) — suscripción a canales: 'tick', 'candle', 'book', 'trade', 'block', 'tx'
//   .pairs — catálogo de mercados
//   .assets — saldos del wallet
//   .randomTx() / .randomBlock() para generación on-demand

(function () {
  const PI2 = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b));
  const hex = (n = 6) =>
    Array.from({ length: n }, () => "0123456789ABCDEF"[irand(0, 16)]).join("");

  // ── Catálogo de pares ─────────────────────────────────────
  const pairs = [
    { sym: "ETH", quote: "USDT", name: "Ethereum", price: 4004.06, ch: 5.31, vol: 1842.4, color: "#627EEA" },
    { sym: "BTC", quote: "USDT", name: "Bitcoin", price: 96821.4, ch: 1.82, vol: 28341.0, color: "#F7931A" },
    { sym: "SOL", quote: "USDT", name: "Solana", price: 184.32, ch: -2.14, vol: 542.8, color: "#9945FF" },
    { sym: "NXP", quote: "USDT", name: "Neon X Protocol", price: 0.4823, ch: 12.04, vol: 42.6, color: "#22D3EE" },
    { sym: "ARB", quote: "USDT", name: "Arbitrum", price: 1.084, ch: -0.81, vol: 88.3, color: "#28A0F0" },
    { sym: "LINK", quote: "USDT", name: "Chainlink", price: 18.42, ch: 3.24, vol: 165.2, color: "#2A5ADA" },
    { sym: "AVAX", quote: "USDT", name: "Avalanche", price: 38.14, ch: 0.62, vol: 124.7, color: "#E84142" },
    { sym: "MATIC", quote: "USDT", name: "Polygon", price: 0.512, ch: -1.43, vol: 76.8, color: "#8247E5" },
    { sym: "DOGE", quote: "USDT", name: "Dogecoin", price: 0.382, ch: 8.15, vol: 412.6, color: "#C2A633" },
    { sym: "ATOM", quote: "USDT", name: "Cosmos", price: 9.28, ch: 2.16, vol: 38.2, color: "#2E3148" },
  ];
  pairs.forEach((p) => {
    p.basePrice = p.price;
    p.high = p.price * (1 + Math.abs(p.ch) / 100 + 0.012);
    p.low = p.price * (1 - Math.abs(p.ch) / 100 - 0.008);
    p._phase = Math.random() * PI2;
  });

  const assets = [
    { sym: "USDT", name: "Tether USD", balance: 482910.5, value: 482910.5, color: "#26A17B", ch: 0.01 },
    { sym: "BTC", name: "Bitcoin", balance: 8.7421, value: 0, color: "#F7931A", ch: 1.82 },
    { sym: "ETH", name: "Ethereum", balance: 124.84, value: 0, color: "#627EEA", ch: 5.31 },
    { sym: "SOL", name: "Solana", balance: 1820.2, value: 0, color: "#9945FF", ch: -2.14 },
    { sym: "NXP", name: "Neon X Protocol", balance: 1000000, value: 0, color: "#22D3EE", ch: 12.04 },
    { sym: "ARB", name: "Arbitrum", balance: 14820, value: 0, color: "#28A0F0", ch: -0.81 },
    { sym: "LINK", name: "Chainlink", balance: 482.1, value: 0, color: "#2A5ADA", ch: 3.24 },
  ];

  // ── Velas (candles) ──────────────────────────────────────
  // Generamos un historial inicial y luego cada tick el candle activo crece
  const TIMEFRAMES = ["5M", "15M", "1H", "4H", "1D"];
  const TF_MS = { "5M": 300000, "15M": 900000, "1H": 3600000, "4H": 14400000, "1D": 86400000 };

  function generateHistory(pair, tf, count = 100) {
    const tfMs = TF_MS[tf];
    let p = pair.basePrice;
    const target = pair.price; // último cierre = precio actual
    const candles = [];
    const now = Date.now();
    // Caminamos hacia atrás desde el precio actual con ruido
    const drift = (pair.ch / 100) * pair.basePrice / count;
    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * tfMs;
      const noise = (Math.random() - 0.5) * pair.basePrice * 0.012;
      const o = p;
      const c = i === 0 ? target : o + drift + noise;
      const high = Math.max(o, c) + Math.random() * pair.basePrice * 0.006;
      const low = Math.min(o, c) - Math.random() * pair.basePrice * 0.006;
      candles.push({ t, o, h: high, l: low, c, v: rand(200, 1200) * pair.basePrice });
      p = c;
    }
    return candles;
  }

  const candleStore = {}; // key = `${sym}_${tf}` → array
  pairs.forEach((p) => {
    TIMEFRAMES.forEach((tf) => {
      candleStore[`${p.sym}_${tf}`] = generateHistory(p, tf, 80);
    });
  });

  // ── Order book ─────────────────────────────────────────
  function buildBook(price) {
    const bids = [];
    const asks = [];
    const tickSize = price * 0.0002;
    let bSum = 0, aSum = 0;
    for (let i = 0; i < 14; i++) {
      const bp = price - tickSize * (i + 1);
      const ap = price + tickSize * (i + 1);
      const bSize = rand(0.5, 12) * (i < 4 ? 2 : 1);
      const aSize = rand(0.5, 12) * (i < 4 ? 2 : 1);
      bSum += bSize;
      aSum += aSize;
      bids.push({ p: bp, s: bSize, sum: bSum });
      asks.push({ p: ap, s: aSize, sum: aSum });
    }
    return { bids, asks, maxSum: Math.max(bSum, aSum) };
  }

  // ── Subscriptions ──────────────────────────────────────
  const subs = {};
  function emit(channel, payload) {
    (subs[channel] || []).forEach((fn) => fn(payload));
  }
  function subscribe(channel, fn) {
    (subs[channel] = subs[channel] || []).push(fn);
    return () => {
      subs[channel] = (subs[channel] || []).filter((f) => f !== fn);
    };
  }

  // ── Market state ───────────────────────────────────────
  const market = {
    activeSym: "ETH",
    activeTf: "1H",
    book: buildBook(4004.06),
    fills: [],
    openOrders: [
      { id: "ord-12482", side: "buy", type: "limit", pair: "ETH/USDT", price: 3920, size: 0.42, filled: 0, t: Date.now() - 8000 },
      { id: "ord-12480", side: "sell", type: "limit", pair: "ETH/USDT", price: 4180, size: 1.2, filled: 0.3, t: Date.now() - 142000 },
      { id: "ord-12476", side: "buy", type: "limit", pair: "BTC/USDT", price: 95800, size: 0.085, filled: 0, t: Date.now() - 280000 },
    ],
    history: [
      { type: "BUY", asset: "2.4 ETH", state: "SIGNED", hash: "0xA45...E91", t: Date.now() - 60000 },
      { type: "SWAP", asset: "8,000 NXP a USDT", state: "ANTI-DUP OK", hash: "0x91B...13A", t: Date.now() - 180000 },
      { type: "WITHDRAW", asset: "1,250 USDC", state: "MFA OK", hash: "0x00F...CC2", t: Date.now() - 360000 },
      { type: "CREATE", asset: "Neon X Protocol", state: "MINTED", hash: "0xA8C...77D", t: Date.now() - 720000 },
      { type: "SELL", asset: "0.42 BTC", state: "SETTLED", hash: "0xDA9...AA1", t: Date.now() - 1500000 },
    ],
  };

  function activePair() { return pairs.find((p) => p.sym === market.activeSym); }
  function activeCandles() { return candleStore[`${market.activeSym}_${market.activeTf}`]; }

  function setActive(sym, tf) {
    if (sym) market.activeSym = sym;
    if (tf) market.activeTf = tf;
    market.book = buildBook(activePair().price);
    emit("tick", { pair: activePair(), candles: activeCandles() });
    emit("book", market.book);
  }

  // ── Loops ──────────────────────────────────────────────
  // 1) Cada par tickea su precio (todo el catálogo). El activo emite eventos.
  setInterval(() => {
    pairs.forEach((pair) => {
      pair._phase += rand(0.04, 0.12);
      const sine = Math.sin(pair._phase) * pair.basePrice * 0.0035;
      const drift = (Math.random() - 0.5) * pair.basePrice * 0.0025;
      pair.price = Math.max(0.0001, pair.price + sine * 0.4 + drift);
      pair.high = Math.max(pair.high, pair.price);
      pair.low = Math.min(pair.low, pair.price);
      pair.ch = ((pair.price - pair.basePrice) / pair.basePrice) * 100;
    });
    // Actualizamos el candle más reciente del par activo + tf activo
    const tfMs = TF_MS[market.activeTf];
    const candles = activeCandles();
    const last = candles[candles.length - 1];
    const now = Date.now();
    if (now - last.t >= tfMs) {
      // Cerrar candle, abrir nueva
      candles.push({ t: now, o: last.c, h: last.c, l: last.c, c: activePair().price, v: 0 });
      if (candles.length > 120) candles.shift();
    } else {
      last.c = activePair().price;
      last.h = Math.max(last.h, last.c);
      last.l = Math.min(last.l, last.c);
      last.v += rand(0.5, 4) * activePair().basePrice;
    }
    market.book = buildBook(activePair().price);
    emit("tick", { pair: activePair(), candles });
    emit("book", market.book);
    emit("tickAll", pairs);
  }, 850);

  // 2) Trades / fills (cada 1.5-3.5s)
  function scheduleTrade() {
    setTimeout(() => {
      const pair = activePair();
      const side = Math.random() > 0.5 ? "buy" : "sell";
      const size = rand(0.02, 4.2);
      const px = pair.price + (Math.random() - 0.5) * pair.price * 0.0003;
      const trade = {
        id: "t-" + Date.now(),
        side,
        size,
        price: px,
        t: Date.now(),
      };
      market.fills.unshift(trade);
      if (market.fills.length > 40) market.fills.pop();
      emit("trade", trade);
      scheduleTrade();
    }, rand(1500, 3500));
  }
  scheduleTrade();

  // 3) Bloques internos (cada 6-10s)
  let blockNo = 12181;
  function nextBlock() {
    const block = {
      n: ++blockNo,
      hash: "0x" + hex(4) + "..." + hex(4),
      sig: Math.random() > 0.5 ? "SIG:zk-44A" : "SIG:ed25519",
      anti: "ANTI-DUP OK",
      txCount: irand(4, 22),
      t: Date.now(),
    };
    emit("block", block);
  }
  setInterval(nextBlock, 7800);

  // 4) Transacciones globales (cada 1-2s)
  const TX_TYPES = ["TRANSFER", "SWAP", "MINT", "STAKE", "BURN", "BRIDGE"];
  function nextTx() {
    const type = TX_TYPES[irand(0, TX_TYPES.length)];
    const sym = pairs[irand(0, pairs.length)].sym;
    const tx = {
      hash: "0x" + hex(6),
      type,
      asset: rand(0.1, 4200).toFixed(type === "TRANSFER" ? 3 : 2) + " " + sym,
      from: "0x" + hex(4) + "..." + hex(3),
      to: "0x" + hex(4) + "..." + hex(3),
      sig: "ed25519",
      t: Date.now(),
    };
    emit("tx", tx);
  }
  setInterval(nextTx, 1400);

  // ── Computar balances en USDT con precios actuales ─────
  setInterval(() => {
    assets.forEach((a) => {
      if (a.sym === "USDT") return;
      const p = pairs.find((pp) => pp.sym === a.sym);
      if (p) {
        a.value = a.balance * p.price;
        a.ch = p.ch;
      }
    });
    emit("balances", assets);
  }, 1500);

  // Run once at boot
  setTimeout(() => {
    assets.forEach((a) => {
      const p = pairs.find((pp) => pp.sym === a.sym);
      if (p) a.value = a.balance * p.price;
    });
    emit("balances", assets);
  }, 0);

  // ── Formatters ─────────────────────────────────────────
  function fmtPrice(n, digits) {
    if (n == null || isNaN(n)) return "—";
    if (digits != null) return Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (n < 0.01) return n.toFixed(6);
    if (n < 1) return n.toFixed(4);
    if (n < 100) return n.toFixed(2);
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtSize(n) {
    if (n == null) return "—";
    if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (Math.abs(n) >= 1) return n.toFixed(3);
    return n.toFixed(4);
  }
  function fmtUSD(n, digits = 2) {
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function fmtPct(n) {
    const sign = n >= 0 ? "+" : "";
    return sign + n.toFixed(2) + "%";
  }
  function fmtVol(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toFixed(2);
  }
  function fmtAge(t) {
    const d = (Date.now() - t) / 1000;
    if (d < 60) return Math.floor(d) + "s";
    if (d < 3600) return Math.floor(d / 60) + "m";
    if (d < 86400) return Math.floor(d / 3600) + "h";
    return Math.floor(d / 86400) + "d";
  }

  window.VData = {
    pairs, assets, market,
    activePair, activeCandles, setActive,
    subscribe,
    TIMEFRAMES, TF_MS,
    fmt: { price: fmtPrice, size: fmtSize, usd: fmtUSD, pct: fmtPct, vol: fmtVol, age: fmtAge },
  };
})();
