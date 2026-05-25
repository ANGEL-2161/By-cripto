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
    const padB = 38; // volume + time axis

    const plotW = w - padL - padR;
    const plotH = h - padT - padB - 50; // 50px for volume bars at bottom
    const volH = 36;
    const volTop = padT + plotH + 8;
    const axisY = volTop + volH + 6;

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
    candles.forEach((c, i) => {
      const cw = Math.max(1.5, plotW / candles.length * 0.7);
      const px = x(i) - cw / 2;
      const py = yVol(c.v);
      ctx.fillStyle = c.c >= c.o ? colorUp : colorDown;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(px, py, cw, volTop + volH - py);
    });
    ctx.globalAlpha = 1;

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
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = colorText;
    ctx.fillText("VOL", padL + 4, volTop - 2);
  }

  function formatAxis(v) {
    if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
    if (v >= 1) return v.toFixed(2);
    if (v >= 0.01) return v.toFixed(4);
    return v.toFixed(6);
  }

  window.VChart = { draw };
})();
