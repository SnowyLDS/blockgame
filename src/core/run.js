// 한 판(런)의 진행 상태: 스탯, 몸, 장비, 기술, 돈, 맵 위치
import { CONFIG } from '../config/gameConfig.js';
import { assignedEnhance, cellHpMax, cloneBody, countCells, createBody, growBody, nonCoreCells, restoreHp } from './body.js';
import { distinctPieces, randomPiece, scatterBody } from './pieces.js';
import { generateMap } from './map.js';
import { makeItem, randomItem } from './items.js';
import { normalizeLoadout } from './skills.js';
import { boardSize, canWield, maxCells, totalEnhance } from './stats.js';
import { pick, randInt, shuffle, weightedIndex, weightedKey } from './rng.js';

const ok = msg => ({ ok: true, msg });
const fail = msg => ({ ok: false, msg });

export function newRun(stats) {
  const run = {
    stats: { ...stats },
    gold: CONFIG.economy.startGold,
    body: null,
    weapon: null, armor: null,
    inventory: [],
    pending: [],                       // 아직 몸에 붙이지 않은 조각 [{offsets, color}]
    learned: {}, learnedDodge: [CONFIG.dodge.starting],
    equippedAttack: [], equippedDodge: CONFIG.dodge.starting,
    stage: 1, map: generateMap(1), pos: null, path: [],
    visit: {},                         // 현재 노드에서만 쓰는 상태 (상점 재고 등)
    battlesWon: 0,
  };
  run.body = createBody(boardSize(run), boardSize(run));
  scatterBody(run.body, Math.round(maxCells(run) * CONFIG.body.startFill));
  autoAssignEnhance(run);
  const start = CONFIG.weapons.starting;
  if (start) {
    const w = makeItem('weapon', start.grade, start.family);
    if (canWield(run, w)) run.weapon = w; else run.inventory.push(w);
  }
  normalizeLoadout(run);
  return run;
}

// 시작 강화: 판 가운데에 가까운 칸부터 1단계씩 (출발 전 정비에서 바꿀 수 있음)
function autoAssignEnhance(run) {
  const b = run.body;
  const cx = (b.w - 1) / 2, cy = (b.h - 1) / 2;
  const d = c => Math.abs(c.x - cx) + Math.abs(c.y - cy);
  const cells = shuffle(nonCoreCells(b)).sort((p, q) => d(p) - d(q));
  let left = totalEnhance(run);
  for (const { cell } of cells) {
    if (left <= 0) break;
    cell.tier = 1;
    cell.hp = cellHpMax(1);
    left--;
  }
}

// 시작 스탯 주사위 1개 (rollWeights 확률)
export function rollStat() {
  const S = CONFIG.stats;
  return S.rollMin + weightedIndex(S.rollWeights);
}

// 스탯 올리기. 반환: { grown: 판이 커졌으면 새 한 변 칸 수(아니면 0), learned: 새로 배운 기술 이름 목록 }
export function gainStat(run, key, amount) {
  run.stats[key] = Math.min(CONFIG.stats.cap, run.stats[key] + amount);
  const learned = normalizeLoadout(run);
  const n = boardSize(run);
  if (n <= run.body.w) return { grown: 0, learned };
  growBody(run.body, n, n);
  return { grown: n, learned };
}

function armorCheck(run, armor) {
  if (countCells(run.body) > maxCells(run, armor)) return '현재 칸 수가 바뀐 최대 칸 수보다 많습니다';
  if (assignedEnhance(run.body) > totalEnhance(run, armor)) return '지정된 강화가 바뀐 강화 횟수보다 많습니다 (여관에서 해제)';
  return null;
}

export function equipItem(run, item) {
  const i = run.inventory.indexOf(item);
  if (i < 0) return fail('가방에 없는 아이템');
  if (item.kind === 'weapon') {
    run.inventory.splice(i, 1);
    if (run.weapon) run.inventory.push(run.weapon);
    run.weapon = item;
  } else {
    const problem = armorCheck(run, item);
    if (problem) return fail(problem);
    run.inventory.splice(i, 1);
    if (run.armor) run.inventory.push(run.armor);
    run.armor = item;
  }
  normalizeLoadout(run);
  return ok('장착했습니다');
}

// 장비 획득: 가방에 넣고, 그 칸(무기/방어구)이 비어 있으면 바로 장착. 반환: 안내 문구
export function acquireItem(run, item) {
  run.inventory.push(item);
  const slot = item.kind === 'weapon' ? 'weapon' : 'armor';
  if (run[slot]) return `${item.name} — 가방에 넣었습니다`;
  const r = equipItem(run, item);
  return r.ok ? `${item.name} — 자동으로 장착했습니다` : `${item.name} — 가방에 넣었습니다 (${r.msg})`;
}

export function unequipSlot(run, slot) {
  const item = run[slot];
  if (!item) return fail('비어 있음');
  if (slot === 'armor') {
    const problem = armorCheck(run, null);
    if (problem) return fail(problem);
  }
  run[slot] = null;
  run.inventory.push(item);
  normalizeLoadout(run);
  return ok('해제했습니다');
}

export function makeReward(run, kind) {
  const r = CONFIG.rewards[kind];
  const open = CONFIG.stats.keys.filter(k => run.stats[k] < CONFIG.stats.cap);
  const n = CONFIG.rewards.itemChoices;
  // 카드마다 물약/장비를 따로 뽑음. 물약끼리는 모양이 겹치지 않음
  const kinds = Array.from({ length: n }, () => weightedKey({ potion: r.potionWeight, gear: r.gearWeight }));
  const potions = distinctPieces(kinds.filter(k => k === 'potion').length, CONFIG.rewards.potionSizes);
  const offers = kinds.map(k => (k === 'gear' ? { type: 'gear', item: randomItem(r.odds) } : { type: 'potion', piece: potions.pop() }));
  return {
    kind,
    gold: randInt(r.gold[0], r.gold[1]),
    statAmount: r.stat,
    statChoices: shuffle(open).slice(0, CONFIG.rewards.statChoices),
    offers,
    statTaken: null,
    itemTaken: null,
  };
}

export function makeShopStock() {
  return {
    potions: CONFIG.shop.potions.map(p => ({ ...p, piece: randomPiece(p.cells), sold: false })),
    items: Array.from({ length: CONFIG.shop.itemCount }, () => ({ item: randomItem(CONFIG.shop.odds), sold: false })),
  };
}

export const makeHealChoices = () => distinctPieces(CONFIG.inn.healChoices, CONFIG.inn.healSizes);

export function addPending(run, piece) {
  run.pending.push({ offsets: piece.offsets.map(o => o.slice()), color: piece.color });
}

export const currentNode = run => (run.pos ? run.map.floors[run.pos.floor][run.pos.index] : null);

export function reachableNodes(run) {
  if (!run.pos) return run.map.floors[0].map((_, i) => [0, i]);
  const node = currentNode(run);
  return node.next.map(i => [run.pos.floor + 1, i]);
}

export function moveTo(run, floor, index) {
  run.pos = { floor, index };
  run.path.push([floor, index]);
  run.visit = {};
  const node = currentNode(run);
  node.visited = true;
  return node;
}

export const isLastStage = run => run.stage >= CONFIG.map.stages;

export function advanceStage(run) {
  run.stage++;
  run.map = generateMap(run.stage);
  run.pos = null;
  run.path = [];
  run.visit = {};
}

export function finishBattle(run, body) {
  const b = cloneBody(body);
  if (CONFIG.body.restoreHpAfterBattle) restoreHp(b);
  run.body = b;
  run.battlesWon++;
}
