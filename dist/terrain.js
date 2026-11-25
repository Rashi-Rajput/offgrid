// Render a synthetic relief map in canvas so the field console needs no map tiles.
const canvas = document.querySelector("#terrain");
function draw() {
  const { width: w, height: h } = canvas.getBoundingClientRect(),
    d = Math.min(devicePixelRatio, 2);
  canvas.width = w * d;
  canvas.height = h * d;
  const ctx = canvas.getContext("2d");
  ctx.scale(d, d);
  const gap = 5,
    nx = Math.ceil(w / gap) + 1,
    ny = Math.ceil(h / gap) + 1;
  const z = (x, y) => {
    const u = (x - w * 0.76) / h,
      v = (y - h * 0.49) / h;
    const a = u + 0.11 * Math.sin(7 * v + 2 * u) + 0.045 * Math.sin(16 * v - u);
    const b =
      v + 0.15 * Math.cos(4 * u + 2 * v) + 0.04 * Math.cos(17 * u + 3 * v);
    return (
      1.5 * Math.exp(-1.8 * (a * a + 2 * b * b)) +
      0.35 * Math.sin(3 * a + 2 * b) +
      0.22 * Math.cos(4 * b - a) +
      0.06 * Math.sin(10 * a - 9 * b)
    );
  };
  const field = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => z(i * gap, j * gap)),
  );
  ctx.fillStyle = "#282f26";
  ctx.fillRect(0, 0, w, h);
  for (let level = -0.6, k = 0; level < 2.4; level += 0.048, k++) {
    ctx.beginPath();
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const vals = [
            field[j][i],
            field[j][i + 1],
            field[j + 1][i + 1],
            field[j + 1][i],
          ],
          xs = [0, 1, 1, 0],
          ys = [0, 0, 1, 1];
        let first = true;
        for (let s = 0; s < 4; s++) {
          const t = (s + 1) % 4;
          if (vals[s] > level === vals[t] > level) continue;
          const f = (level - vals[s]) / (vals[t] - vals[s]),
            x = (i + xs[s] + f * (xs[t] - xs[s])) * gap,
            y = (j + ys[s] + f * (ys[t] - ys[s])) * gap;
          if (first) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          first = !first;
        }
      }
    ctx.strokeStyle = k % 5 === 0 ? "#768061" : "#525f49";
    ctx.lineWidth = k % 5 === 0 ? 1.1 : 0.7;
    ctx.stroke();
  }
  ctx.strokeStyle = "#88917d3b";
  ctx.lineWidth = 0.6;
  for (let x = w % 60; x < w; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const x = w * 0.79,
    y = h * 0.49;
  ctx.strokeStyle = "#df9e68";
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 1.05);
  ctx.bezierCurveTo(w * 0.63, h * 0.67, w * 0.7, h * 0.96, x, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#df9e6825";
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffad71";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}
new ResizeObserver(draw).observe(canvas);
