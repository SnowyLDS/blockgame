// 분기 맵 생성 (층마다 2~4 노드, 아래층 → 위층 방향으로 교차 없이 연결)
//  층마다 성격(전투 / 상점·교관 / 여관)을 정하고 노드는 그 성격 안에서 고름.
//  비전투 성격은 연속 두 층에 오지 않음 → 같은 비전투 칸이 연달아 이어지지 않음
import { CONFIG } from '../config/gameConfig.js';
import { rand, randFloat, randInt, weightedKey } from './rng.js';

const kindOfType = type => {
  if (type === 'boss' || type === 'elite') return 'combat';
  return Object.keys(CONFIG.map.floorKinds).find(k => type in CONFIG.map.floorKinds[k].types) ?? 'combat';
};

// 각 층의 성격 정하기
function rollFloorKinds() {
  const cfg = CONFIG.map;
  const kinds = [];
  for (let f = 1; f <= cfg.floors; f++) {
    const fixed = cfg.fixedFloors[f];
    if (fixed) { kinds.push(kindOfType(fixed)); continue; }
    const w = Object.fromEntries(Object.entries(cfg.floorKinds).map(([k, v]) => [k, v.weight]));
    const prev = kinds[kinds.length - 1];
    const nextFixed = cfg.fixedFloors[f + 1] && kindOfType(cfg.fixedFloors[f + 1]);
    for (const banned of [prev, nextFixed]) if (banned && banned !== 'combat') delete w[banned];
    kinds.push(weightedKey(w));
  }
  return kinds;
}

function rollType(floorNo, kind) {
  const cfg = CONFIG.map;
  if (cfg.fixedFloors[floorNo]) return cfg.fixedFloors[floorNo];
  const type = weightedKey(cfg.floorKinds[kind].types);
  if (type === 'monster' && floorNo >= cfg.eliteMinFloor && rand() < cfg.eliteChance) return 'elite';
  return type;
}

export function generateMap(stage) {
  const cfg = CONFIG.map;
  const kinds = rollFloorKinds();
  const floors = [];
  for (let f = 1; f <= cfg.floors; f++) {
    const n = f === cfg.floors ? 1 : f === 1 ? cfg.firstFloorNodes : randInt(cfg.minNodes, cfg.maxNodes);
    const nodes = [];
    for (let i = 0; i < n; i++) {
      nodes.push({
        floor: f - 1, index: i, type: rollType(f, kinds[f - 1]), next: [], visited: false,
        x: n === 1 ? 0.5 : (i + 0.5) / n + randFloat(-0.05, 0.05),
      });
    }
    floors.push(nodes);
  }
  // i 번째 노드 → 다음 층의 비례 구간 노드들. 구간이 순서대로라 선이 교차하지 않음
  for (let f = 0; f < floors.length - 1; f++) {
    const a = floors[f].length, b = floors[f + 1].length;
    floors[f].forEach((node, i) => {
      const lo = Math.floor(i * b / a);
      const hi = Math.max(lo, Math.ceil((i + 1) * b / a) - 1);
      for (let j = lo; j <= hi; j++) node.next.push(j);
    });
  }
  return { stage, floors };
}
