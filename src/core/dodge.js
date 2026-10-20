// 회피: 틀(칸 그리드) 안의 몸 칸을 들어 다른 위치로 옮김
import { CONFIG } from '../config/gameConfig.js';
import { cloneBody, getCell, idx, inBounds, removeDisconnected, setCell } from './body.js';
import { parseGrid, rotateOffsets } from './pieces.js';

export function dodgeFrameOffsets(key, rotation = 0) {
  return rotateOffsets(parseGrid(CONFIG.dodgeSkills[key].grid), rotation);
}

// (ax, ay): 틀 위치, (sx, sy): 옮길 거리
// isLocked(cell): 이번 회피에서 옮길 수 없는 칸 (직전 턴에 회피로 옮긴 칸). 틀 안에 있어도 제자리에 남음
// 옮긴 칸이 다른 칸 위에 내려앉으면 원래 있던 칸은 사라짐 (crushed)
// 반환: { valid, reason, movable, empty, blocked, locked, targets, crushed, body, collapsed }
// rot: 들어 올린 블록을 시계 방향 90° × rot 만큼 꺾어서 내려놓음 (틀 중심 기준)
export function computeDodge(body, offs, ax, ay, sx, sy, isLocked = () => false, rot = 0) {
  const r = { valid: false, reason: '', movable: [], empty: [], blocked: [], locked: [], targets: [], crushed: [], body: null, collapsed: [] };
  const movIdx = [];
  offs.forEach(([dx, dy], i) => {
    const x = ax + dx, y = ay + dy;
    if (!inBounds(body, x, y)) return;
    const c = getCell(body, x, y);
    if (!c) r.empty.push([x, y]);
    else if (c.core) r.blocked.push([x, y]);
    else if (isLocked(c)) r.locked.push([x, y]);
    else { r.movable.push([x, y]); movIdx.push(i); }
  });
  // 회전한 틀 모양에서 같은 순번의 칸으로 이동 (중심이 제자리에 오도록 보정)
  const ro = rot % 4 ? rotateOffsets(offs, rot) : offs;
  const center = o => [o.reduce((s, p) => s + p[0], 0) / o.length, o.reduce((s, p) => s + p[1], 0) / o.length];
  const [c0x, c0y] = center(offs), [c1x, c1y] = center(ro);
  const fx = Math.round(c0x - c1x), fy = Math.round(c0y - c1y);
  r.targets = movIdx.map(i => [ax + ro[i][0] + fx + sx, ay + ro[i][1] + fy + sy]);
  r.rotated = rot % 4 !== 0;

  if (!r.movable.length) {
    r.reason = r.locked.length ? '직전 턴에 옮긴 칸은 연속으로 옮길 수 없습니다' : '틀 안에 옮길 칸이 없습니다';
    return r;
  }
  if (!sx && !sy && !r.rotated) { r.reason = '옮길 위치를 고르세요'; return r; }
  const max = CONFIG.dodge.maxShift;
  if (max != null && (Math.abs(sx) > max || Math.abs(sy) > max)) { r.reason = `최대 ${max}칸까지 옮길 수 있습니다`; return r; }

  const moving = new Set(r.movable.map(([x, y]) => idx(body, x, y)));
  for (const [x, y] of r.targets) {
    if (!inBounds(body, x, y)) { r.reason = '판 밖으로 옮길 수 없습니다'; return r; }
    const c = getCell(body, x, y);
    if (c && !moving.has(idx(body, x, y))) {
      if (c.core) { r.reason = '코어 위로 옮길 수 없습니다'; return r; }
      r.crushed.push({ x, y, cell: c }); // 겹친 칸은 사라짐
    }
  }

  const b = cloneBody(body);
  const cells = r.movable.map(([x, y]) => getCell(b, x, y));
  r.movable.forEach(([x, y]) => setCell(b, x, y, null));
  r.targets.forEach(([x, y], i) => setCell(b, x, y, cells[i]));
  r.collapsed = removeDisconnected(b);
  r.body = b;
  r.valid = true;
  return r;
}
