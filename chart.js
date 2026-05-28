// chart.js — Renderer de gráfico para Vértice OS

(function () {
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function devicePixel(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }

  // ── Indicator calculations ──────────────────────────────
  function calcMA(candles, period) {
    return candles.map((_, i) => {
      if (i < period - 1) return null;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += candles[j].c;
      return sum / period;
    });
  }

  function calcEMA(candles, period) {
    const k = 2 / (period + 1);
    const result = new Array(candles.length).fill(null);
    let ema = null, seed = 0, seedSum = 0;
    for (let i = 0; i < candles.length; i++) {
      seedSum += candles[i].c;
      seed++;
      if (seed === period) {
        ema = seedSum / period;
        result[i] = ema;
      } else if (seed > period) {
        ema = candles[i].c * k + ema * (1 - k);
        result[i] = ema;
      }
    }
    return result;
  }

  function calcRSI(candles, period) {
    period = period || 14;
    const result = new Array(candles.length).fill(null);
    if (candles.length < period + 1) return result;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const d = candles[i].c - candles[i - 1].c;
      if (d > 0) gains += d; else losses -= d;
    }
    let ag = gains / period, al = losses / period;
    result[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = period + 1; i < candles.length; i++) {
      const d = candles[i].c - candles[i - 1].c;
      ag = (ag * (period - 1) + Math.max(0, d)) / period;
      al = (al * (period - 1) + Math.max(0, -d)) / period;
      result[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return result;
  }

  function calcBB(candles, period, mult) {
    period = period || 20; mult = mult || 2;
    const ma = calcMA(candles, period);
    return candles.map((_, i) => {
      if (ma[i] === null) return null;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += Math.pow(candles[j].c - ma[i], 2);
      const std = Math.sqrt(sum / period);
      return { m: ma[i], u: ma[i] + mult * std, l: ma[i] - mult * std };
    });
  }

  function calcMACD(candles, fast, slow, signal) {
    fast = fast || 12; slow = slow || 26; signal = signal || 9;
    const emaF = calcEMA(candles, fast);
    const emaS = calcEMA(candles, slow);
    const macdLine = candles.map((_, i) =>
      emaF[i] !== null && emaS[i] !== null ? emaF[i] - emaS[i] : null);
    const k = 2 / (signal + 1);
    const sigLine = new Array(candles.length).fill(null);
    let ema = null, cnt = 0;
    for (let i = 0; i < candles.length; i++) {
      if (macdLine[i] === null) continue;
      cnt++;
      if (cnt === 1) ema = macdLine[i];
      else ema = macdLine[i] * k + ema * (1 - k);
      if (cnt >= signal) sigLine[i] = ema;
    }
    const hist = candles.map((_, i) =>
      macdLine[i] !== null && sigLine[i] !== null ? macdLine[i] - sigLine[i] : null);
    return { macdLine, sigLine, hist };
  }

  function calcStoch(candles, kPeriod, dPeriod) {
    kPeriod = kPeriod || 14; dPeriod = dPeriod || 3;
    const kLine = candles.map((_, i) => {
      if (i < kPeriod - 1) return null;
      let lo = Infinity, hi = -Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (candles[j].l < lo) lo = candles[j].l;
        if (candles[j].h > hi) hi = candles[j].h;
      }
      return hi === lo ? 50 : (candles[i].c - lo) / (hi - lo) * 100;
    });
    const dLine = kLine.map((_, i) => {
      const vals = [];
      for (let j = Math.max(0, i - dPeriod + 1); j <= i; j++) {
        if (kLine[j] !== null) vals.push(kLine[j]);
      }
      return vals.length === dPeriod ? vals.reduce((a, b) => a + b, 0) / dPeriod : null;
    });
    return { kLine, dLine };
  }

  // ── Sub-panel line helper ───────────────────────────────
  function drawPanelLine(ctx, vals, xFn, panelTop, panelH, vMin, vMax, color, lw) {
    const yP = (v) => panelTop + (1 - (v - vMin) / ((vMax - vMin) || 1)) * panelH;
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 1.4;
    ctx.setLineDash([]);
    ctx.beginPath();
    let first = true;
    vals.forEach((v, i) => {
      if (v === null) return;
      const px = xFn(i), py = yP(v);
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }

  // ── Main draw ───────────────────────────────────────────
  function draw(canvas, candles, opts) {
    if (!candles || !candles.length) return null;
    const { ctx, w, h } = devicePixel(canvas);
    ctx.clearRect(0, 0, w, h);

    const type = opts.type || "velas";
    const fontMono = `11px ${cssVar("--font-mono") || "monospace"}`;
    const colorText = cssVar("--text-mute") || "#999";
    const colorGrid = cssVar("--grid") || "#222";
    const colorUp = cssVar("--positive") || "#4caf50";
    const colorDown = cssVar("--negative") || "#f44";
    const colorAccent = cssVar("--accent") || "#0af";
    const colorBg = cssVar("--surface") || "#000";

    const padL = 0, padR = 56, padT = 8, padB = 22;
    const plotW = w - padL - padR;

    // Sub-panel layout
    const subPanelH = 65, subSep = 4;
    const subs = [];
    if (opts.rsi) subs.push("rsi");
    if (opts.macd) subs.push("macd");
    if (opts.stoch) subs.push("stoch");
    const totalSubH = subs.length * (subPanelH + subSep);
    const plotH = Math.max(40, h - padT - padB - totalSubH);
    const axisY = h - padB + 4;

    // Candle price range
    let min = Infinity, max = -Infinity;
    candles.forEach((c) => {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
    });
    const range = max - min || 1;
    min -= range * 0.05;
    max += range * 0.05;

    if (opts.orders && opts.yMin == null && opts.yMax == null) {
      const { entry, tp, sl } = opts.orders;
      [entry, tp, sl].forEach(p => {
        if (p != null) { if (p < min) min = p; if (p > max) max = p; }
      });
      const er = max - min || 1;
      min -= er * 0.02; max += er * 0.02;
    }
    if (opts.yMin != null) min = opts.yMin;
    if (opts.yMax != null) max = opts.yMax;

    const x = (i) => padL + (i / Math.max(1, candles.length - 1)) * plotW;
    const y = (price) => padT + (1 - (price - min) / (max - min)) * plotH;

    // ── Horizontal grid ──
    ctx.font = fontMono;
    const ROWS = 5;
    for (let i = 0; i <= ROWS; i++) {
      const v = min + (max - min) * (i / ROWS);
      const py = padT + (1 - i / ROWS) * plotH;
      ctx.strokeStyle = colorGrid;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colorText;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(formatAxis(v), padL + plotW + 8, py);
    }

    // ── Vertical grid ──
    const vStep = Math.max(1, Math.floor(candles.length / 8));
    for (let i = 0; i < candles.length; i += vStep) {
      ctx.strokeStyle = colorGrid;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x(i), padT);
      ctx.lineTo(x(i), padT + plotH);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Bollinger Bands overlay ──
    if (opts.bb) {
      const bands = calcBB(candles, 20, 2);
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ["u", "m", "l"].forEach((key, ki) => {
        ctx.strokeStyle = ki === 1 ? colorAccent + "99" : colorAccent + "55";
        ctx.beginPath();
        let first = true;
        bands.forEach((b, i) => {
          if (!b) return;
          const px = x(i), py = y(b[key]);
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      const valid = bands.map((b, i) => (b ? { i, b } : null)).filter(Boolean);
      if (valid.length) {
        ctx.beginPath();
        valid.forEach(({ i, b }, idx) => {
          if (idx === 0) ctx.moveTo(x(i), y(b.u)); else ctx.lineTo(x(i), y(b.u));
        });
        [...valid].reverse().forEach(({ i, b }) => ctx.lineTo(x(i), y(b.l)));
        ctx.closePath();
        ctx.fillStyle = colorAccent + "12";
        ctx.setLineDash([]);
        ctx.fill();
      }
      ctx.restore();
    }

    // ── Plot type ──
    if (type === "velas") {
      const cw = Math.max(1.5, (plotW / candles.length) * 0.7);
      candles.forEach((c, i) => {
        const px = x(i);
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? colorUp : colorDown;
        ctx.fillStyle = up ? colorUp : colorDown;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, y(c.h)); ctx.lineTo(px, y(c.l)); ctx.stroke();
        const top = y(Math.max(c.o, c.c));
        const bot = y(Math.min(c.o, c.c));
        ctx.fillRect(px - cw / 2, top, cw, Math.max(1, bot - top));
      });
    } else if (type === "barras") {
      const cw = Math.max(1.5, (plotW / candles.length) * 0.6);
      candles.forEach((c, i) => {
        const px = x(i);
        ctx.strokeStyle = c.c >= c.o ? colorUp : colorDown;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(px, y(c.h)); ctx.lineTo(px, y(c.l)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - cw / 2, y(c.o)); ctx.lineTo(px, y(c.o)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, y(c.c)); ctx.lineTo(px + cw / 2, y(c.c)); ctx.stroke();
      });
    } else if (type === "linea" || type === "area") {
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = colorAccent;
      ctx.beginPath();
      candles.forEach((c, i) => {
        const px = x(i), py = y(c.c);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      if (type === "area") {
        ctx.lineTo(x(candles.length - 1), padT + plotH);
        ctx.lineTo(x(0), padT + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, colorAccent + "55");
        grad.addColorStop(1, colorAccent + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        candles.forEach((c, i) => {
          const px = x(i), py = y(c.c);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = colorAccent;
        ctx.lineWidth = 1.8;
      }
      ctx.stroke();
      const lx = x(candles.length - 1), ly = y(candles[candles.length - 1].c);
      ctx.fillStyle = colorAccent;
      ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colorBg;
      ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // ── MA(20) overlay ──
    if (opts.ma) {
      const maVals = calcMA(candles, 20);
      ctx.strokeStyle = "#ff9800";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      let first = true;
      maVals.forEach((v, i) => {
        if (v === null) return;
        const px = x(i), py = y(v);
        if (first) { ctx.moveTo(px, py); first = false; }
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      // MA label near last value
      const lastMA = maVals.slice().reverse().find(v => v !== null);
      if (lastMA !== null) {
        ctx.font = `700 10px ${cssVar("--font-mono") || "monospace"}`;
        ctx.fillStyle = "#ff9800aa";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("MA20", padL + 6, y(lastMA) - 9);
      }
    }

    // ── Order lines (entry / TP / SL) ──
    if (opts.orders) {
      const { entry, tp, sl } = opts.orders;
      const mFont = `700 10px ${cssVar("--font-mono") || "monospace"}`;
      const labW = padR - 6;

      const drawOrderLine = (price, lineColor, bgColor, label) => {
        if (price == null) return;
        const py = y(price);
        if (py < padT - 2 || py > padT + plotH + 2) return;
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
        ctx.restore();
        ctx.font = mFont;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = bgColor;
        ctx.fillRect(padL + 6, py - 9, tw + 12, 18);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, padL + 12, py);
        ctx.fillStyle = bgColor;
        ctx.fillRect(padL + plotW + 2, py - 9, labW, 18);
        ctx.fillText(formatAxis(price), padL + plotW + 8, py);
      };

      drawOrderLine(sl, "#f44336", "#c62828", "SL");
      drawOrderLine(tp, "#4caf50", "#2e7d32", "TP");

      // Entry line — always fixed at purchase price
      if (entry != null) {
        const py = y(entry);
        if (py >= padT - 2 && py <= padT + plotH + 2) {
          ctx.save();
          ctx.strokeStyle = "#9e9e9e";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
          ctx.restore();
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(padL + plotW * 0.65, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.font = mFont;
          const tw = ctx.measureText("COMPRA").width;
          ctx.fillStyle = "#37474f";
          ctx.fillRect(padL + 6, py - 9, tw + 12, 18);
          ctx.fillStyle = "#fff";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText("COMPRA", padL + 12, py);
          ctx.fillStyle = "#37474f";
          ctx.fillRect(padL + plotW + 2, py - 9, labW, 18);
          ctx.fillText(formatAxis(entry), padL + plotW + 8, py);
        }
      }
    }

    // ── Last price label ──
    const last = candles[candles.length - 1];
    const lastUp = last.c >= last.o;
    const lastYPx = y(last.c);
    ctx.fillStyle = lastUp ? colorUp : colorDown;
    ctx.fillRect(padL + plotW + 2, lastYPx - 9, padR - 6, 18);
    ctx.fillStyle = "#000";
    ctx.font = `600 11px ${cssVar("--font-mono") || "monospace"}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(formatAxis(last.c), padL + plotW + 8, lastYPx);

    // ── Sub-panels (RSI / MACD / Stoch) ──
    const smallFont = `10px ${cssVar("--font-mono") || "monospace"}`;
    subs.forEach((sub, idx) => {
      const panelTop = padT + plotH + subSep + idx * (subPanelH + subSep);
      const pH = subPanelH;

      // separator
      ctx.strokeStyle = colorGrid;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, panelTop - 1);
      ctx.lineTo(w, panelTop - 1);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (sub === "rsi") {
        const rsi = calcRSI(candles);
        const yP = (v) => panelTop + (1 - v / 100) * pH;
        [30, 50, 70].forEach(lvl => {
          const py = yP(lvl);
          ctx.strokeStyle = lvl === 50 ? colorGrid : (lvl === 70 ? colorDown + "66" : colorUp + "66");
          ctx.lineWidth = 1;
          ctx.setLineDash(lvl === 50 ? [3, 3] : []);
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          ctx.font = smallFont;
          ctx.fillStyle = colorText;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(lvl), padL + plotW + 6, py);
        });
        drawPanelLine(ctx, rsi, x, panelTop, pH, 0, 100, colorAccent, 1.4);
        ctx.font = smallFont;
        ctx.fillStyle = colorText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("RSI(14)", 4, panelTop + 2);

      } else if (sub === "macd") {
        const { macdLine, sigLine, hist } = calcMACD(candles);
        const allV = [...macdLine, ...sigLine, ...hist].filter(v => v !== null);
        if (!allV.length) return;
        const vMin = Math.min(...allV), vMax = Math.max(...allV);
        const vRange = vMax - vMin || 1;
        const yP2 = (v) => panelTop + (1 - (v - vMin) / vRange) * pH;
        const yZero = yP2(0);

        ctx.strokeStyle = colorGrid;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(padL, yZero); ctx.lineTo(padL + plotW, yZero); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;

        const cw2 = Math.max(1.5, plotW / candles.length * 0.7);
        hist.forEach((v, i) => {
          if (v === null) return;
          const barY = v >= 0 ? yP2(v) : yZero;
          const barH = Math.abs(yP2(v) - yZero);
          ctx.fillStyle = v >= 0 ? colorUp : colorDown;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x(i) - cw2 / 2, barY, cw2, barH);
        });
        ctx.globalAlpha = 1;
        drawPanelLine(ctx, macdLine, x, panelTop, pH, vMin, vMax, colorAccent, 1.4);
        drawPanelLine(ctx, sigLine, x, panelTop, pH, vMin, vMax, "#ff9800", 1);
        ctx.font = smallFont;
        ctx.fillStyle = colorText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("MACD(12,26,9)", 4, panelTop + 2);

      } else if (sub === "stoch") {
        const { kLine, dLine } = calcStoch(candles);
        const yP3 = (v) => panelTop + (1 - v / 100) * pH;
        [20, 50, 80].forEach(lvl => {
          const py = yP3(lvl);
          ctx.strokeStyle = lvl === 50 ? colorGrid : (lvl === 80 ? colorDown + "66" : colorUp + "66");
          ctx.lineWidth = 1;
          ctx.setLineDash(lvl === 50 ? [3, 3] : []);
          ctx.globalAlpha = 0.5;
          ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          ctx.font = smallFont;
          ctx.fillStyle = colorText;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(String(lvl), padL + plotW + 6, py);
        });
        drawPanelLine(ctx, kLine, x, panelTop, pH, 0, 100, colorAccent, 1.4);
        drawPanelLine(ctx, dLine, x, panelTop, pH, 0, 100, "#ff9800", 1);
        ctx.font = smallFont;
        ctx.fillStyle = colorText;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("STOCH(14,3)", 4, panelTop + 2);
      }
    });

    // ── Time axis ──
    ctx.fillStyle = colorText;
    ctx.font = fontMono;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const tStep = Math.max(1, Math.floor(candles.length / 8));
    for (let i = 0; i < candles.length; i += tStep) {
      const c = candles[i];
      const px = x(i);
      const d = new Date(c.t);
      const lbl = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      ctx.fillText(lbl, px, axisY);
    }

    return { plotH, yMin: min, yMax: max, padT, padL, plotW };
  }

  function drawVolume(canvas, candles) {
    if (!candles || !candles.length) return;
    const { ctx, w, h } = devicePixel(canvas);
    ctx.clearRect(0, 0, w, h);

    const fontMono = `11px ${cssVar("--font-mono") || "monospace"}`;
    const colorText = cssVar("--text-mute") || "#999";
    const colorGrid = cssVar("--grid") || "#222";
    const colorUp = cssVar("--positive") || "#4caf50";
    const colorDown = cssVar("--negative") || "#f44";

    const padL = 0, padR = 56, padT = 6, padB = 4;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let vMax = 0;
    candles.forEach(c => { if (c.v > vMax) vMax = c.v; });
    if (!vMax) return;

    const N = candles.length;
    const cw = Math.max(1.5, plotW / N * 0.7);
    const xFn = (i) => padL + (i / Math.max(1, N - 1)) * plotW;

    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(w, 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    candles.forEach((c, i) => {
      const px = xFn(i);
      const barH = Math.max(1, (c.v / vMax) * plotH);
      ctx.fillStyle = c.c >= c.o ? colorUp : colorDown;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(px - cw / 2, padT + plotH - barH, cw, barH);
    });
    ctx.globalAlpha = 1;

    ctx.font = fontMono;
    ctx.fillStyle = colorText;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("VOL", 4, padT);
  }

  function drawRSI(canvas, rsiValues) {
    if (!rsiValues || !rsiValues.length) return;
    const { ctx, w, h } = devicePixel(canvas);
    ctx.clearRect(0, 0, w, h);
    const fontMono = `10px ${cssVar("--font-mono") || "monospace"}`;
    const colorText = cssVar("--text-mute") || "#999";
    const colorGrid = cssVar("--grid") || "#222";
    const colorUp = cssVar("--positive") || "#4caf50";
    const colorDown = cssVar("--negative") || "#f44";
    const colorAccent = cssVar("--accent") || "#0af";
    const padL = 0, padR = 56, padT = 6, padB = 14;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const N = rsiValues.length;
    const xFn = (i) => padL + (i / Math.max(1, N - 1)) * plotW;
    const yFn = (v) => padT + (1 - v / 100) * plotH;
    ctx.strokeStyle = colorGrid; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    ctx.globalAlpha = 1;
    [30, 50, 70].forEach(lvl => {
      const py = yFn(lvl);
      ctx.strokeStyle = lvl === 50 ? colorGrid : (lvl === 70 ? colorDown + "66" : colorUp + "66");
      ctx.lineWidth = 1; ctx.setLineDash(lvl === 50 ? [3, 3] : []);
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.font = fontMono; ctx.fillStyle = colorText;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(String(lvl), padL + plotW + 6, py);
    });
    ctx.lineWidth = 1.4; ctx.strokeStyle = colorAccent; ctx.beginPath();
    let first = true;
    rsiValues.forEach((v, i) => {
      if (v == null) return;
      if (first) { ctx.moveTo(xFn(i), yFn(v)); first = false; }
      else ctx.lineTo(xFn(i), yFn(v));
    });
    ctx.stroke();
    ctx.font = fontMono; ctx.fillStyle = colorText;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("RSI(14)", 4, padT);
  }

  function drawMACD(canvas, macdLine, sigLine, histLine) {
    if (!macdLine || !macdLine.length) return;
    const { ctx, w, h } = devicePixel(canvas);
    ctx.clearRect(0, 0, w, h);
    const fontMono = `10px ${cssVar("--font-mono") || "monospace"}`;
    const colorText = cssVar("--text-mute") || "#999";
    const colorGrid = cssVar("--grid") || "#222";
    const colorUp = cssVar("--positive") || "#4caf50";
    const colorDown = cssVar("--negative") || "#f44";
    const colorAccent = cssVar("--accent") || "#0af";
    const padL = 0, padR = 56, padT = 6, padB = 14;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const N = macdLine.length;
    const xFn = (i) => padL + (i / Math.max(1, N - 1)) * plotW;
    const allVals = [...macdLine, ...sigLine, ...histLine].filter(v => v != null);
    if (!allVals.length) return;
    const vMin = Math.min(...allVals), vMax = Math.max(...allVals);
    const vRange = (vMax - vMin) || 1;
    const yFn = (v) => padT + (1 - (v - vMin) / vRange) * plotH;
    const yZero = yFn(0);
    ctx.strokeStyle = colorGrid; ctx.lineWidth = 1; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = colorGrid; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(padL, yZero); ctx.lineTo(padL + plotW, yZero); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    const cw = Math.max(1.5, plotW / N * 0.7);
    histLine.forEach((v, i) => {
      if (v == null) return;
      const barY = v >= 0 ? yFn(v) : yZero;
      const barH = Math.abs(yFn(v) - yZero);
      ctx.fillStyle = v >= 0 ? colorUp : colorDown;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(xFn(i) - cw / 2, barY, cw, barH);
    });
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.4; ctx.strokeStyle = colorAccent; ctx.beginPath();
    let first = true;
    macdLine.forEach((v, i) => {
      if (v == null) return;
      if (first) { ctx.moveTo(xFn(i), yFn(v)); first = false; } else ctx.lineTo(xFn(i), yFn(v));
    });
    ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = "#ff9800"; ctx.beginPath();
    first = true;
    sigLine.forEach((v, i) => {
      if (v == null) return;
      if (first) { ctx.moveTo(xFn(i), yFn(v)); first = false; } else ctx.lineTo(xFn(i), yFn(v));
    });
    ctx.stroke();
    ctx.font = fontMono; ctx.fillStyle = colorText;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("MACD", 4, padT);
  }

  function formatAxis(v) {
    if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (v >= 1) return v.toFixed(2);
    if (v >= 0.01) return v.toFixed(4);
    return v.toFixed(6);
  }

  window.VChart = { draw, drawVolume, drawRSI, drawMACD };
})();
