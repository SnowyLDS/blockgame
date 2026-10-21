// 블록 몸: 칸 배열 + 코어. 플레이어·적 공통.
//  cell = { tier, hp, color, piece, core? }
import { CONFIG } from '../config/gameConfig.js';

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const maxTier = () => CONFIG.body.tierHp.length - 1;
export const cellHpMax = tier => CONFIG.body.tierHp[tier];

// 현재 규칙: 코어 없음 (corePositions 기본 []). 코어 관련 함수는 예전 규칙용으로 남겨 둠
export function createBody(w, h, corePositions = []) {
  const b = { w, h, cells: new Array(w * h).fill(null), nextPieceId: 1 };
  for (const [x, y] of corePositions) b.cells[idx(b, x, y)] = makeCoreCell();
  return b;
}

export const makeCoreCell = () => ({ core: true, tier: 0, hp: 1, color: CONFIG.colors.core, piece: 0 });

export function coreCells(b) {
  const out = [];
  b.cells.forEach((c, i) => { if (c?.core) out.push({ x: i % b.w, y: Math.floor(i / b.w) }); });
  return out;
}

// (x, y) 에서 가장 가까운 코어까지 맨해튼 거리
export function distToCore(b, x, y, cores = coreCells(b)) {
  return Math.min(...cores.map(c => Math.abs(c.x - x) + Math.abs(c.y - y)));
}

// 코어 count 개를 서로 minGap 칸 이상 띄워 무작위 배치
export function randomCorePositions(w, h, count, minGap, margin) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const out = [];
    for (let tries = 0; out.length < count && tries < 200; tries++) {
      const x = margin + Math.floor(Math.random() * (w - margin * 2));
      const y = margin + Math.floor(Math.random() * (h - margin * 2));
      if (out.every(([ox, oy]) => Math.max(Math.abs(ox - x), Math.abs(oy - y)) - 1 >= minGap)) out.push([x, y]);
    }
    if (out.length === count) return out;
  }
  return [[Math.floor(w / 2), Math.floor(h / 2)]];
}

export const inBounds = (b, x, y) => x >= 0 && y >= 0 && x < b.w && y < b.h;
export const idx = (b, x, y) => y * b.w + x;
export const getCell = (b, x, y) => (inBounds(b, x, y) ? b.cells[idx(b, x, y)] : null);
export function setCell(b, x, y, cell) { b.cells[idx(b, x, y)] = cell; }

export function makeCell(color, piece, tier = 0) {
  return { tier, hp: cellHpMax(tier), color, piece };
}

export function cloneBody(b) {
  return { ...b, cells: b.cells.map(c => (c ? { ...c } : null)) };
}

export function nonCoreCells(b) {
  const out = [];
  b.cells.forEach((c, i) => { if (c && !c.core) out.push({ x: i % b.w, y: Math.floor(i / b.w), cell: c }); });
  return out;
}

export const countCells = b => b.cells.reduce((n, c) => n + (c && !c.core ? 1 : 0), 0);
export const assignedEnhance = b => b.cells.reduce((n, c) => n + (c && !c.core ? c.tier : 0), 0);

// 코어(여러 개면 아무 코어나)에서 4방향으로 이어진 칸 표시
export function connectedMask(b) {
  const mask = new Uint8Array(b.w * b.h);
  const stack = [];
  b.cells.forEach((c, i) => { if (c?.core) { mask[i] = 1; stack.push(i); } });
  while (stack.length) {
    const i = stack.pop();
    const x = i % b.w, y = Math.floor(i / b.w);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(b, nx, ny)) continue;
      const j = idx(b, nx, ny);
      if (!mask[j] && b.cells[j]) { mask[j] = 1; stack.push(j); }
    }
  }
  return mask;
}

// 코어가 없으면 연결 붕괴도 없음 (모든 칸이 그대로 살아 있음)
export function disconnectedCells(b) {
  if (!b.cells.some(c => c?.core)) return [];
  const m = connectedMask(b);
  const out = [];
  b.cells.forEach((c, i) => { if (c && !m[i]) out.push({ x: i % b.w, y: Math.floor(i / b.w), cell: c }); });
  return out;
}

// 연결 붕괴: 코어와 끊긴 칸 제거, 제거된 칸 반환
export function removeDisconnected(b) {
  const d = disconnectedCells(b);
  d.forEach(({ x, y }) => setCell(b, x, y, null));
  return d;
}

// 판을 w×h 로 키움: 기존 칸은 가운데로 옮기고 둘레는 빈칸
export function growBody(b, w, h) {
  const ox = Math.floor((w - b.w) / 2), oy = Math.floor((h - b.h) / 2);
  const cells = new Array(w * h).fill(null);
  b.cells.forEach((c, i) => { if (c) cells[(Math.floor(i / b.w) + oy) * w + (i % b.w) + ox] = c; });
  b.w = w; b.h = h; b.cells = cells;
}

export function restoreHp(b) {
  for (const c of b.cells) if (c && !c.core) c.hp = cellHpMax(c.tier);
}

export function cellsBBox(b) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { x, y } of nonCoreCells(b)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  if (x0 === Infinity) {
    for (const { x, y } of coreCells(b)) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  return { x0, y0, x1, y1 };
}

// 같은 조각 번호 + 서로 이어진 칸 묶음
export function componentOf(b, x, y) {
  const start = getCell(b, x, y);
  if (!start || start.core) return [];
  const seen = new Set([idx(b, x, y)]);
  const out = [[x, y]];
  for (let k = 0; k < out.length; k++) {
    const [cx, cy] = out[k];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      const c = getCell(b, nx, ny);
      if (!c || c.core || c.piece !== start.piece || seen.has(idx(b, nx, ny))) continue;
      seen.add(idx(b, nx, ny));
      out.push([nx, ny]);
    }
  }
  return out;
}

// 부서져서 쪼개진 조각을 각각 별도 조각으로 번호 다시 매김 (여관 재정비용)
export function regroupPieces(b) {
  const seen = new Uint8Array(b.w * b.h);
  let id = 1;
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i];
    if (!c || c.core || seen[i]) continue;
    const comp = componentOf(b, i % b.w, Math.floor(i / b.w));
    for (const [x, y] of comp) { seen[idx(b, x, y)] = 1; getCell(b, x, y).piece = -id; }
    id++;
  }
  for (const c of b.cells) if (c && !c.core) c.piece = -c.piece;
  b.nextPieceId = id;
}
