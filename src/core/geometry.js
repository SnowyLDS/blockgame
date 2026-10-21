// 벡터 도형(두께 있는 선·원)과 칸(1x1 사각형)의 겹침 판정
import { CONFIG } from '../config/gameConfig.js';

const EPS = 1e-9;

// y축 아래가 + 인 화면 좌표에서 시계 방향 90° × quarter
function rotatePoint([x, y], quarter) {
  const q = ((quarter % 4) + 4) % 4;
  for (let i = 0; i < q; i++) [x, y] = [-y, x];
  return [x, y];
}

// 꺾은선 양 끝을 d 만큼 바깥으로 늘림 (무기 등급 확장)
function extendPolyline(pts, d) {
  if (d <= 0 || pts.length < 2) return pts;
  const out = pts.map(p => p.slice());
  const push = (i, j) => {
    const dx = out[i][0] - out[j][0], dy = out[i][1] - out[j][1];
    const len = Math.hypot(dx, dy) || 1;
    out[i][0] += dx / len * d;
    out[i][1] += dy / len * d;
  };
  push(0, 1);
  push(out.length - 1, out.length - 2);
  return out;
}

// 모양 정의 → 회전·확장이 적용된 로컬 도형
// sizeScale: 모양 전체 크기 배율 (두께는 그대로)
export function resolveShape(def, { rotation = 0, extend = 0, width = 0.3, sizeScale = 1, ringBonus = 0 } = {}) {
  const scale = (def.letter ? CONFIG.attack.letterSize : (def.scale ?? 1)) * sizeScale;
  const prims = def.prims.map(p => {
    if (p.type === 'line') {
      let pts = p.points.map(([x, y]) => [x * scale, y * scale]);
      pts = extendPolyline(pts, extend / 2);
      return { type: 'line', points: pts.map(pt => rotatePoint(pt, rotation)) };
    }
    const c = p.center ?? [0, 0];
    const grow = extend * CONFIG.weapons.circleExtendFactor;
    if (p.type === 'star') return starPrims(c[0] * scale, c[1] * scale, p.r * scale + grow, p.coreMult ?? 2).map(q => ({ ...q, points: q.points.map(pt => rotatePoint(pt, rotation)) }));
    const out = {
      type: p.type,
      center: rotatePoint([c[0] * scale, c[1] * scale], rotation),
      r: p.r * scale + grow,
    };
    if (p.type === 'ring') out.inner = Math.max(0, p.inner * scale + grow - ringBonus); // 커질 땐 두께 유지, 두께 보너스는 안쪽으로
    return out;
  }).flat();
  return { prims, width: def.width ?? width };
}

// 다윗의 별(육각별): 뾰족한 삼각형 2개(피해 ×1) + 가운데 육각형(피해 ×coreMult)
//  r = 별 끝까지 반지름, 가운데 육각형 꼭짓점 반지름 = r/√3
function starPrims(cx, cy, r, coreMult) {
  const ring = (n, rad, start) => Array.from({ length: n }, (_, i) => {
    const a = (start + i * 360 / n) * Math.PI / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  });
  return [
    { type: 'poly', points: ring(3, r, -90), mult: 1 },
    { type: 'poly', points: ring(3, r, 90), mult: 1 },
    { type: 'poly', points: ring(6, r / Math.sqrt(3), 0), mult: coreMult, core: true },
  ];
}

// 로컬 도형을 판 좌표 (px, py) 에 놓음 (연속 좌표)
export function placeShape(shape, px, py) {
  return {
    width: shape.width,
    origin: [px, py],
    prims: shape.prims.map(p => p.points
      ? { ...p, points: p.points.map(([x, y]) => [x + px, y + py]) }
      : { ...p, center: [p.center[0] + px, p.center[1] + py] }),
  };
}

function pointRectDist(px, py, x0, y0, x1, y1) {
  const dx = Math.max(x0 - px, 0, px - x1);
  const dy = Math.max(y0 - py, 0, py - y1);
  return Math.hypot(dx, dy);
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Liang–Barsky: 선분이 사각형을 지나가는가
function segIntersectsRect(ax, ay, bx, by, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - x0, x1 - ax, ay - y0, y1 - ay];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
  }
  return true;
}

function segRectDist(ax, ay, bx, by, x0, y0, x1, y1) {
  if (segIntersectsRect(ax, ay, bx, by, x0, y0, x1, y1)) return 0;
  return Math.min(
    pointRectDist(ax, ay, x0, y0, x1, y1),
    pointRectDist(bx, by, x0, y0, x1, y1),
    pointSegDist(x0, y0, ax, ay, bx, by),
    pointSegDist(x1, y0, ax, ay, bx, by),
    pointSegDist(x0, y1, ax, ay, bx, by),
    pointSegDist(x1, y1, ax, ay, bx, by),
  );
}

// 볼록 다각형과 칸 사각형이 넓이를 가지고 겹치는가 (분리축 판정, 변끼리 닿기만 하면 제외)
function convexHitsRect(pts, x, y) {
  const rect = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
  const axes = [[1, 0], [0, 1]];
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; axes.push([q[1] - p[1], p[0] - q[0]]); });
  for (const [ax, ay] of axes) {
    const len = Math.hypot(ax, ay) || 1;
    const proj = list => list.map(([px, py]) => (px * ax + py * ay) / len);
    const a = proj(pts), b = proj(rect);
    if (Math.min(Math.max(...a), Math.max(...b)) - Math.max(Math.min(...a), Math.min(...b)) <= EPS) return false;
  }
  return true;
}

// 도형 하나가 칸 (x, y) 와 조금이라도 겹치는가 (경계에 딱 닿기만 하면 제외)
export function primHitsCell(prim, halfWidth, x, y) {
  if (prim.type === 'poly') return convexHitsRect(prim.points, x, y);
  if (prim.type === 'circle') {
    return pointRectDist(prim.center[0], prim.center[1], x, y, x + 1, y + 1) < prim.r - EPS;
  }
  if (prim.type === 'ring') {
    // 고리(바깥 원 - 안쪽 원): 칸이 바깥 원과 겹치고, 안쪽 구멍에 완전히 들어가 있지 않아야 함
    const [cx, cy] = prim.center;
    const far = Math.hypot(Math.max(Math.abs(x - cx), Math.abs(x + 1 - cx)), Math.max(Math.abs(y - cy), Math.abs(y + 1 - cy)));
    return pointRectDist(cx, cy, x, y, x + 1, y + 1) < prim.r - EPS && far > prim.inner + EPS;
  }
  const pts = prim.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = segRectDist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x, y, x + 1, y + 1);
    if (d < halfWidth - EPS) return true;
  }
  return false;
}

function shapeBounds(placed) {
  const hw = placed.width / 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of placed.prims) {
    if (p.points) {
      const m = p.type === 'line' ? hw : 0;
      for (const [x, y] of p.points) {
        x0 = Math.min(x0, x - m); y0 = Math.min(y0, y - m);
        x1 = Math.max(x1, x + m); y1 = Math.max(y1, y + m);
      }
    } else {
      x0 = Math.min(x0, p.center[0] - p.r); y0 = Math.min(y0, p.center[1] - p.r);
      x1 = Math.max(x1, p.center[0] + p.r); y1 = Math.max(y1, p.center[1] + p.r);
    }
  }
  return { x0, y0, x1, y1 };
}

// 놓인 도형이 걸치는 판 위 칸 목록 [[x, y, 피해 배율], ...] — 배율 = 겹친 도형 중 가장 큰 mult (기본 1)
export function cellsHitByShape(placed, w, h) {
  const hw = placed.width / 2;
  const b = shapeBounds(placed);
  const out = [];
  const ys = Math.max(0, Math.floor(b.y0)), ye = Math.min(h - 1, Math.floor(b.y1));
  const xs = Math.max(0, Math.floor(b.x0)), xe = Math.min(w - 1, Math.floor(b.x1));
  for (let y = ys; y <= ye; y++) {
    for (let x = xs; x <= xe; x++) {
      let mult = 0;
      for (const p of placed.prims) if (primHitsCell(p, hw, x, y)) mult = Math.max(mult, p.mult ?? 1);
      if (mult) out.push([x, y, mult]);
    }
  }
  return out;
}
