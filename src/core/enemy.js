// 적 생성과 AI
import { CONFIG } from '../config/gameConfig.js';
import { cellHpMax, cellsBBox, createBody, maxTier, nonCoreCells } from './body.js';
import { scatterBody } from './pieces.js';
import { buildAttack, simulateAttacks } from './attack.js';
import { pick, randFloat, randInt, shuffle } from './rng.js';

export function createEnemy(kind, stage) {
  const E = CONFIG.enemies;
  const def = E.types[`s${stage}_${kind}`];
  const body = createBody(CONFIG.board.enemyW, CONFIG.board.enemyH);
  scatterBody(body, randInt(def.cells[0], def.cells[1]));
  // 강화: 무작위 칸에 1단계씩, 다 돌면 다시 2단계
  const cells = shuffle(nonCoreCells(body));
  let left = def.enhance ?? 0;
  for (let tier = 1; tier <= maxTier() && left > 0; tier++) {
    for (const { cell } of cells) {
      if (left <= 0) break;
      if (cell.tier < tier) { cell.tier = tier; cell.hp = cellHpMax(tier); left--; }
    }
  }
  const who = pick(def.names);
  return { kind, stage, def, name: who.name, sprite: who.sprite, body, damage: def.damage ?? E.damage };
}

const attackPool = spec => spec.shapes ?? spec.patterns.flatMap(t => CONFIG.enemies.patternTiers[t]);

function randomCandidate(spec, target, width) {
  const bb = cellsBBox(target);
  const m = CONFIG.enemies.aimMargin;
  return buildAttack({
    shapeKey: pick(attackPool(spec)),
    x: randFloat(bb.x0 - m, bb.x1 + m),
    y: randFloat(bb.y0 - m, bb.y1 + m),
    rotation: randInt(0, 3),
    scale: spec.scale ?? 1,
    owner: 'enemy',
    width, // 대상의 민첩에 따라 얇아진 선 두께 (없으면 기본값)
  });
}

// 공격마다 후보 N 개 중 점수가 가장 높은 것 선택. 두 번째 공격은 첫 공격 결과 위에서 고름
//  점수 = 파괴 칸 + 붕괴 칸 + 잠긴 칸(🔒 이번 턴 회피 불가)을 맞힌 수 × lockedTargetBonus (+ 맞힌 칸 조금)
//  isLocked(cell): 대상의 잠긴 칸 판별 (Combat 이 넘겨줌)
export function chooseEnemyAttacks(enemy, targetBody, { isLocked = () => false } = {}) {
  if (enemy.scriptedAttacks) return enemy.scriptedAttacks(targetBody); // 튜토리얼 등 정해진 공격
  const def = enemy.def;
  const bonus = CONFIG.enemies.lockedTargetBonus;
  let body = targetBody;
  const chosen = [];
  for (const spec of def.attacks) {
    let best = null;
    for (let i = 0; i < def.candidates; i++) {
      const atk = randomCandidate(spec, body, enemy.lineWidth);
      const sim = simulateAttacks(body, [atk], enemy.damage);
      const lockedHits = sim.hits.filter(h => { const c = body.cells[h.y * body.w + h.x]; return c && isLocked(c); }).length;
      const score = sim.destroyed.length + sim.collapsed.length + lockedHits * bonus + sim.hits.length * 0.01;
      if (!best || score > best.score) best = { atk, sim, score };
    }
    chosen.push(best.atk);
    body = best.sim.body;
  }
  return chosen;
}
