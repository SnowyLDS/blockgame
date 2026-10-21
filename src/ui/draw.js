// 캔버스 그리기: 판, 칸, 강조 표시, 공격 도형
import { cellHpMax } from '../core/body.js';

export const MARK = {
  hit:      { fill: 'rgba(255,170,40,0.38)', stroke: '#ffb030' },
  destroy:  { fill: 'rgba(255,40,40,0.55)', stroke: '#ff5050', cross: true },
  collapse: { fill: 'rgba(170,80,255,0.55)', stroke: '#d29bff', dash: true },
  move:     { fill: 'rgba(60,220,255,0.20)', stroke: '#45e0ff' },
  frame:    { fill: null, stroke: 'rgba(200,225,255,0.65)', dash: true },
  invalid:  { fill: 'rgba(255,0,0,0.35)', stroke: '#ff3030' },
  ok:       { fill: 'rgba(90,255,140,0.30)', stroke: '#6dff9a' },
  hover:    { fill: 'rgba(255,255,255,0.12)', stroke: '#ffffff' },
  locked:   { fill: 'rgba(20,24,34,0.55)', stroke: '#9aa4b8', dash: true, lock: true }, // 이번 턴 회피 불가
};

function lockIcon(ctx, cx, cy, s) {
  ctx.fillStyle = '#c9d2e3';
  ctx.strokeStyle = '#c9d2e3';
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.12, s * 0.2, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(cx - s * 0.3, cy - s * 0.12, s * 0.6, s * 0.42);
}

export function drawGrid(ctx, w, h, ox, oy, cs) {
  ctx.save();
  ctx.fillStyle = '#131824';
  ctx.fillRect(ox, oy, w * cs, h * cs);
  ctx.strokeStyle = '#222a3b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x++) { ctx.moveTo(ox + x * cs + 0.5, oy); ctx.lineTo(ox + x * cs + 0.5, oy + h * cs); }
  for (let y = 0; y <= h; y++) { ctx.moveTo(ox, oy + y * cs + 0.5); ctx.lineTo(ox + w * cs, oy + y * cs + 0.5); }
  ctx.stroke();
  ctx.restore();
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function heart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.38);
  ctx.bezierCurveTo(cx - s * 0.62, cy - s * 0.02, cx - s * 0.36, cy - s * 0.56, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s * 0.36, cy - s * 0.56, cx + s * 0.62, cy - s * 0.02, cx, cy + s * 0.38);
  ctx.closePath();
}

function shield(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.46);
  ctx.lineTo(cx + s * 0.38, cy - s * 0.3);
  ctx.lineTo(cx + s * 0.33, cy + s * 0.08);
  ctx.quadraticCurveTo(cx + s * 0.22, cy + s * 0.36, cx, cy + s * 0.48);
  ctx.quadraticCurveTo(cx - s * 0.22, cy + s * 0.36, cx - s * 0.33, cy + s * 0.08);
  ctx.lineTo(cx - s * 0.38, cy - s * 0.3);
  ctx.closePath();
}

// (px, py) = 칸 왼쪽 위 픽셀
export function drawCell(ctx, cell, px, py, cs, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const m = Math.max(1, cs * 0.05), s = cs - m * 2;
  const cx = px + cs / 2, cy = py + cs / 2;
  if (cell.core) {
    // 보조 코어(sub)는 청색, 그 외(핵심 코어·적 코어)는 금색
    const [c0, c1, edge, ink] = cell.sub
      ? ['#e6f6ff', '#3a8fd0', '#bfe6ff', '#0f3a66']
      : ['#fff6c8', '#e0a400', '#fff1a0', '#7a4a00'];
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, cs * 0.7);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(px + m, py + m, s, s);
    ctx.strokeStyle = edge; ctx.lineWidth = 2;
    ctx.strokeRect(px + m + 1, py + m + 1, s - 2, s - 2);
    ctx.fillStyle = ink;
    star(ctx, cx, cy, cs * (cell.sub ? 0.24 : 0.3)); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = cell.color;
  ctx.fillRect(px + m, py + m, s, s);
  const b = Math.max(2, cs * 0.09);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(px + m, py + m, s, b); ctx.fillRect(px + m, py + m, b, s);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(px + m, py + m + s - b, s, b); ctx.fillRect(px + m + s - b, py + m, b, s);

  // 남은 체력에 맞는 단계로 표시: 방패(3) → 맞으면 하트(2) → 맞으면 일반(1)
  //  (지정된 강화 cell.tier 는 그대로라 전투가 끝나면 원래 단계로 돌아옴)
  let shown = cell.tier;
  while (shown > 0 && cellHpMax(shown) > cell.hp) shown--;
  if (shown === 1) {
    heart(ctx, cx, cy + cs * 0.03, cs * 0.62);
    ctx.fillStyle = '#ff2d4a'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  } else if (shown >= 2) {
    shield(ctx, cx, cy, cs * 0.66);
    ctx.fillStyle = '#cfd8e6'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#2b3a55'; ctx.stroke();
    ctx.fillStyle = '#5874a8';
    shield(ctx, cx, cy, cs * 0.34); ctx.fill();
  }
  ctx.restore();
}

export function drawBody(ctx, body, ox, oy, cs, alpha = 1) {
  body.cells.forEach((c, i) => {
    if (!c) return;
    const x = i % body.w, y = Math.floor(i / body.w);
    drawCell(ctx, c, ox + x * cs, oy + y * cs, cs, alpha);
  });
}

// list: [[x,y]] 또는 [{x,y}]
export function drawMarks(ctx, list, ox, oy, cs, kind) {
  const st = MARK[kind];
  ctx.save();
  for (const it of list) {
    const x = Array.isArray(it) ? it[0] : it.x, y = Array.isArray(it) ? it[1] : it.y;
    const px = ox + x * cs, py = oy + y * cs;
    if (st.fill) { ctx.fillStyle = st.fill; ctx.fillRect(px, py, cs, cs); }
    ctx.strokeStyle = st.stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash(st.dash ? [4, 3] : []);
    ctx.strokeRect(px + 1.5, py + 1.5, cs - 3, cs - 3);
    if (st.lock) { ctx.setLineDash([]); lockIcon(ctx, px + cs / 2, py + cs / 2, cs * 0.6); }
    if (st.cross) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(px + cs * 0.25, py + cs * 0.25); ctx.lineTo(px + cs * 0.75, py + cs * 0.75);
      ctx.moveTo(px + cs * 0.75, py + cs * 0.25); ctx.lineTo(px + cs * 0.25, py + cs * 0.75);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 공격 도형 자체를 그림 (두께 그대로)
export function drawShape(ctx, placed, ox, oy, cs, color, label) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lines = placed.prims.filter(p => p.type === 'line');
  if (lines.length) {
    ctx.strokeStyle = color.fill;
    ctx.lineWidth = Math.max(2, placed.width * cs);
    ctx.beginPath();
    for (const p of lines) {
      p.points.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * cs, oy + y * cs) : ctx.moveTo(ox + x * cs, oy + y * cs)));
    }
    ctx.stroke();
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (const p of placed.prims.filter(q => q.type === 'circle' || q.type === 'ring')) {
    const cx = ox + p.center[0] * cs, cy = oy + p.center[1] * cs;
    ctx.beginPath();
    ctx.arc(cx, cy, p.r * cs, 0, Math.PI * 2);
    if (p.type === 'ring') { ctx.moveTo(cx + p.inner * cs, cy); ctx.arc(cx, cy, p.inner * cs, 0, Math.PI * 2, true); }
    ctx.fillStyle = color.fill; ctx.fill('evenodd');
    ctx.strokeStyle = color.line; ctx.lineWidth = 2; ctx.stroke();
  }
  // 다각형(철퇴 별): 삼각형 2개를 따로 칠해 겹치는 가운데 육각형(2배 피해)이 더 진하게 보임
  for (const p of placed.prims.filter(q => q.type === 'poly')) {
    ctx.beginPath();
    p.points.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * cs, oy + y * cs) : ctx.moveTo(ox + x * cs, oy + y * cs)));
    ctx.closePath();
    if (p.core) {
      ctx.setLineDash([3, 2]); ctx.strokeStyle = color.line; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = color.fill; ctx.fill();
      ctx.strokeStyle = color.line; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  const [x, y] = placed.origin;
  ctx.fillStyle = color.line;
  ctx.beginPath(); ctx.arc(ox + x * cs, oy + y * cs, 3, 0, Math.PI * 2); ctx.fill();
  if (label) {
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    ctx.strokeText(label, ox + x * cs, oy + y * cs - 8);
    ctx.fillText(label, ox + x * cs, oy + y * cs - 8);
  }
  ctx.restore();
}

export const ENEMY_SHAPE = { fill: 'rgba(255,60,60,0.45)', line: '#ffd0d0' };
export const PLAYER_SHAPE = { fill: 'rgba(70,200,255,0.5)', line: '#e0f8ff' };

// 조각 미리보기 캔버스
export function pieceThumb(offsets, color, cs = 16, tiers = null) {
  const w = Math.max(...offsets.map(o => o[0])) + 1, h = Math.max(...offsets.map(o => o[1])) + 1;
  const c = document.createElement('canvas');
  c.width = w * cs + 4; c.height = h * cs + 4;
  const ctx = c.getContext('2d');
  offsets.forEach(([x, y], i) => {
    const tier = tiers ? tiers[i] : 0;
    drawCell(ctx, { tier, hp: cellHpMax(tier), color }, 2 + x * cs, 2 + y * cs, cs);
  });
  return c;
}

// 공격 모양 미리보기 캔버스 (작은 판 위)
export function shapeThumb(placed, w, h, cs = 12) {
  const c = document.createElement('canvas');
  c.width = w * cs; c.height = h * cs;
  const ctx = c.getContext('2d');
  drawGrid(ctx, w, h, 0, 0, cs);
  drawShape(ctx, placed, 0, 0, cs, PLAYER_SHAPE);
  return c;
}
