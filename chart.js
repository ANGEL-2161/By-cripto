// chart.js — Renderer de gráfico para Vértice OS
// Tipos: "velas", "linea", "area", "barras"
// Uso: VChart.draw(canvas, candles, { type, color, gridColor, ... })

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

  function draw(canvas, candles, opts) {
    if (!candles || !candles.length) return;
    const { ctx, w, h } = devicePixel(canvas);
    ctx.clearRect(0, 0, w, h);
    const type = opts.type || "velas";
    const fontMono = `11px ${cssVar("--font-mono") || "monospace"}`;
    const colorText = cssVar("--text-mute") || "#999";
    const colorGrid = cssVar("--grid") || "#222";
    const colorAxis = cssVar("--border-soft") || "#333";
    const colorUp = cssVar("--positive") || "#4caf50";
    const colorDown = cssVar("--negative") || "#f44";
    const colorAccent = cssVar("--accent") || "#0af";
    const colorBg = cssVar("--surface") || "#000";

    // Padding (right side has price axis)
    const padL = 0;
    const padR = 56;
    const padT = 8;
    const showVol = opts.showVol !== false;
    const padB = showVol ? 38 : 26;

    const plotW = w - padL - padR;
    const plotH = h - padT - padB - (showVol ? 50 : 0);
    const volH = 36;
    const volTop = padT + plotH + 8;
    const axisY = showVol ? (volTop + volH + 6) : (padT + plotH + 8);

    // Find min/max
    let min = Infinity, max = -Infinity;
    let vMax = 0;
    candles.forEach((c) => {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
      if (c.v > vMax) vMax = c.v;
    });
    // Add small headroom
    const range = max - min || 1;
    min -= range * 0.05;
    max += range * 0.05;

    // Expand auto-range to always include order levels (entry, TP, SL)
    // so lines stay visible during scroll and zoom
    if (opts.orders && opts.yMin == null && opts.yMax == null) {
      const { entry, tp, sl } = opts.orders;
      [entry, tp, sl].forEach(p => {
        if (p != null) {
          if (p < min) min = p;
          if (p > max) max = p;
        }
      });
      const expandedRange = max - min || 1;
      min -= expandedRange * 0.02;
      max += expandedRange * 0.02;
    }

    // Manual range override (Y zoom)
    if (opts.yMin != null) min = opts.yMin;
    if (opts.yMax != null) max = opts.yMax;

    const x = (i) => padL + (i / (candles.length - 1)) * plotW;
    const y = (price) => padT + (1 - (price - min) / (max - min)) * plotH;
    const yVol = (v) => volTop + volH - (v / vMax) * volH;

    // ── Grid (horizontal lines + value labels) ──
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.font = fontMono;
    ctx.fillStyle = colorText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ROWS = 5;
    for (let i = 0; i <= ROWS; i++) {
      const v = min + (max - min) * (i / ROWS);
      const py = padT + (1 - i / ROWS) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, py);
      ctx.lineTo(padL + plotW, py);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // label
      ctx.fillText(formatAxis(v), padL + plotW + 8, py);
    }

    // Vertical gridlines at every ~10 candles
    const vStep = Math.max(1, Math.floor(candles.length / 8));
    for (let i = 0; i < candles.length; i += vStep) {
      const px = x(i);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Volume bars (bottom strip) ──
    if (showVol) {
      candles.forEach((c, i) => {
        const cw = Math.max(1.5, plotW / candles.length * 0.7);
        const px = x(i) - cw / 2;
        const py = yVol(c.v);
        ctx.fillStyle = c.c >= c.o ? colorUp : colorDown;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(px, py, cw, volTop + volH - py);
      });
      ctx.globalAlpha = 1;
    }

    // ── Bollinger Bands overlay ──
    if (opts.bb && opts.bb.length) {
      const bands = opts.bb;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      ["u", "m", "l"].forEach((key, ki) => {
        ctx.strokeStyle = ki === 1 ? colorAccent + "99" : colorAccent + "55";
        ctx.beginPath();
        let first = true;
        bands.forEach((b, i) => {
          if (b == null) return;
          const px = x(i); const py = y(b[key]);
          if (first) { ctx.moveTo(px, py); first = false; }
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });

      // fill between upper and lower
      const validBands = bands.map((b, i) => (b ? { i, b } : null)).filter(Boolean);
      if (validBands.length) {
        ctx.beginPath();
        validBands.forEach(({ i, b }, idx) => {
          if (idx === 0) ctx.moveTo(x(i), y(b.u));
          else ctx.lineTo(x(i), y(b.u));
        });
        [...validBands].reverse().forEach(({ i, b }) => ctx.lineTo(x(i), y(b.l)));
        ctx.closePath();
        ctx.fillStyle = colorAccent + "12";
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
        // Wick
        ctx.beginPath();
        ctx.moveTo(px, y(c.h));
        ctx.lineTo(px, y(c.l));
        ctx.stroke();
        // Body
        const top = y(Math.max(c.o, c.c));
        const bot = y(Math.min(c.o, c.c));
        const bh = Math.max(1, bot - top);
        ctx.fillRect(px - cw / 2, top, cw, bh);
      });
    } else if (type === "barras") {
      const cw = Math.max(1.5, (plotW / candles.length) * 0.6);
      candles.forEach((c, i) => {
        const px = x(i);
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? colorUp : colorDown;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        // OHLC bar
        ctx.moveTo(px, y(c.h));
        ctx.lineTo(px, y(c.l));
        ctx.stroke();
        // Open tick (left)
        ctx.beginPath();
        ctx.moveTo(px - cw / 2, y(c.o));
        ctx.lineTo(px, y(c.o));
        ctx.stroke();
        // Close tick (right)
        ctx.beginPath();
        ctx.moveTo(px, y(c.c));
        ctx.lineTo(px + cw / 2, y(c.c));
        ctx.stroke();
      });
    } else if (type === "linea" || type === "area") {
      // Line through closes
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = colorAccent;
      ctx.beginPath();
      candles.forEach((c, i) => {
        const px = x(i);
        const py = y(c.c);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      if (type === "area") {
        // Fill area under line
        ctx.lineTo(x(candles.length - 1), padT + plotH);
        ctx.lineTo(x(0), padT + plotH);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        grad.addColorStop(0, colorAccent + "55");
        grad.addColorStop(1, colorAccent + "00");
        ctx.fillStyle = grad;
        ctx.fill();
        // Re-stroke the line over the area
        ctx.beginPath();
        candles.forEach((c, i) => {
          const px = x(i);
          const py = y(c.c);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = colorAccent;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else {
        ctx.stroke();
      }
      // Last-price dot
      const lastX = x(candles.length - 1);
      const lastY = y(candles[candles.length - 1].c);
      ctx.fillStyle = colorAccent;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colorBg;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Order markers (entry / TP / SL) ──
    if (opts.orders) {
      const { entry, tp, sl } = opts.orders;
      const mFont = `700 10px ${cssVar("--font-mono") || "monospace"}`;
      const labW = padR - 6;

      const drawLine = (price, lineColor, bgColor, label) => {
        if (price == null) return;
        const py = y(price);
        // clamp to plot area — line is always drawn if price is defined
        if (py < padT || py > padT + plotH) return;

        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
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

      drawLine(sl, "#f44336", "#c62828", "SL");
      drawLine(tp, "#4caf50", "#2e7d32", "TP");

      if (entry != null) {
        const py = y(entry);
        if (py >= padT - 1 && py <= padT + plotH + 1) {
          ctx.save();
          ctx.strokeStyle = "#9e9e9e";
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 4]);
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(padL, py);
          ctx.lineTo(padL + plotW, py);
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#111";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(padL + plotW * 0.65, py, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

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

    // ── Last price label (right axis) ──
    const last = candles[candles.length - 1];
    const lastUp = last.c >= last.o;
    const lastY = y(last.c);
    ctx.fillStyle = lastUp ? colorUp : colorDown;
    const labW = padR - 6;
    ctx.fillRect(padL + plotW + 2, lastY - 9, labW, 18);
    ctx.fillStyle = "#000";
    ctx.font = `600 11px ${cssVar("--font-mono") || "monospace"}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(formatAxis(last.c), padL + plotW + 8, lastY);

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

    // VOL label
    if (showVol) {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = colorText;
      ctx.fillText("VOL", padL + 4, volTop - 2);
    }
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

    // Use same padL/padR as main chart so bars align pixel-perfect
    const padL = 0, padR = 56, padT = 6, padB = 4;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let vMax = 0;
    candles.forEach(c => { if (c.v > vMax) vMax = c.v; });
    if (!vMax) return;

    const N = candles.length;
    const cw = Math.max(1.5, plotW / N * 0.7);
    const x = (i) => padL + (i / Math.max(1, N - 1)) * plotW;

    // Separator line at top
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0.5);
    ctx.lineTo(w, 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    candles.forEach((c, i) => {
      const px = x(i);
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
    const x = (i) => padL + (i / Math.max(1, N - 1)) * plotW;
    const y = (v) => padT + (1 - (v - 0) / 100) * plotH;

    // separator + levels
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    ctx.globalAlpha = 1;

    [30, 50, 70].forEach((lvl) => {
      const py = y(lvl);
      ctx.strokeStyle = lvl === 50 ? colorGrid : (lvl === 70 ? colorDown + "66" : colorUp + "66");
      ctx.lineWidth = 1;
      ctx.setLineDash(lvl === 50 ? [3, 3] : []);
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(padL + plotW, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = fontMono;
      ctx.fillStyle = colorText;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(String(lvl), padL + plotW + 6, py);
    });

    // RSI line
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    let first = true;
    rsiValues.forEach((v, i) => {
      if (v == null) return;
      const px = x(i); const py = y(v);
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = colorAccent;
    ctx.stroke();

    ctx.font = fontMono;
    ctx.fillStyle = colorText;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
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
    const x = (i) => padL + (i / Math.max(1, N - 1)) * plotW;

    const allVals = [...macdLine, ...sigLine, ...histLine].filter(v => v != null);
    if (!allVals.length) return;
    const vMin = Math.min(...allVals);
    const vMax = Math.max(...allVals);
    const vRange = (vMax - vMin) || 1;
    const y = (v) => padT + (1 - (v - vMin) / vRange) * plotH;
    const yZero = y(0);

    // separator
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0.5); ctx.lineTo(w, 0.5); ctx.stroke();
    ctx.globalAlpha = 1;

    // zero line
    ctx.strokeStyle = colorGrid;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(padL, yZero); ctx.lineTo(padL + plotW, yZero); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // histogram bars
    const cw = Math.max(1.5, plotW / N * 0.7);
    histLine.forEach((v, i) => {
      if (v == null) return;
      const px = x(i);
      const barY = v >= 0 ? y(v) : yZero;
      const barH = Math.abs(y(v) - yZero);
      ctx.fillStyle = v >= 0 ? colorUp : colorDown;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(px - cw / 2, barY, cw, barH);
    });
    ctx.globalAlpha = 1;

    // MACD line
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = colorAccent;
    ctx.beginPath();
    let first = true;
    macdLine.forEach((v, i) => {
      if (v == null) return;
      if (first) { ctx.moveTo(x(i), y(v)); first = false; }
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();

    // Signal line
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#ff9800";
    ctx.beginPath();
    first = true;
    sigLine.forEach((v, i) => {
      if (v == null) return;
      if (first) { ctx.moveTo(x(i), y(v)); first = false; }
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();

    ctx.font = fontMono;
    ctx.fillStyle = colorText;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
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
