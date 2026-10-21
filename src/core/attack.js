// 공격 생성과 피해·붕괴 시뮬레이션 (예고·조준 미리보기·실제 적용 모두 이 함수 사용)
import { CONFIG } from '../config/gameConfig.js';
import { cellsHitByShape, placeShape, resolveShape } from './geometry.js';
import { cloneBody, getCell, idx, removeDisconnected, setCell } from './body.js';

// width: 선 두께 직접 지정(없으면 owner 기본값), widthBonus: 두께 추가 (고리는 안쪽으로 두꺼워짐)
export function buildAttack({ shapeKey, x, y, rotation = 0, extend = 0, owner = 'player', scale = 1, width, widthBonus = 0 }) {
  const def = CONFIG.shapes[shapeKey];
  const base = width ?? (owner === 'enemy' ? CONFIG.attack.enemyLineWidth : CONFIG.attack.playerLineWidth);
  const shape = resolveShape(def, { rotation, extend, width: base + widthBonus, sizeScale: scale, ringBonus: widthBonus });
  return { shapeKey, x, y, rotation, extend, owner, scale, placed: placeShape(shape, x, y) };
}

// attacks 를 순서대로 적용. 공격마다 끝나고 연결 붕괴 판정.
// 반환: { body(결과), hits:[{x,y,damage,destroyed}], destroyed:[{x,y,cell}], collapsed:[{x,y,cell}] }
export function simulateAttacks(body, attacks, damage) {
  const b = cloneBody(body);
  const hitMap = new Map();
  const destroyed = [];
  const collapsed = [];
  for (const atk of attacks) {
    for (const [x, y, mult] of cellsHitByShape(atk.placed, b.w, b.h)) {
      const c = getCell(b, x, y);
      if (!c || c.core) continue;
      c.hp -= damage * mult;
      const k = idx(b, x, y);
      const h = hitMap.get(k) ?? { x, y, damage: 0, destroyed: false };
      h.damage += damage * mult;
      hitMap.set(k, h);
      if (c.hp <= 0) {
        setCell(b, x, y, null);
        h.destroyed = true;
        destroyed.push({ x, y, cell: c });
      }
    }
    collapsed.push(...removeDisconnected(b));
  }
  return { body: b, hits: [...hitMap.values()], destroyed, collapsed };
}
