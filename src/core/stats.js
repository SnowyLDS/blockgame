// 스탯에서 나오는 파생 수치
import { CONFIG } from '../config/gameConfig.js';

// [[최소값, 결과], ...] 표에서 v 에 해당하는 결과
export function tableValue(table, v) {
  let out = table[0][1];
  for (const [min, val] of table) if (v >= min) out = val;
  return out;
}

export const dmgPerCell = run => tableValue(CONFIG.stats.damageByStr, run.stats.str);
export const attackSlots = run => tableValue(CONFIG.stats.attackSlotsByInt, run.stats.int);

const armorEnhance = armor => (armor ? CONFIG.grades[armor.grade].armorEnhance : 0);

// 최대 체력(칸) = 내 판 칸 수 (5×5 = 25). 스탯·방어구와 무관
export function maxCells() {
  return CONFIG.board.playerW * CONFIG.board.playerH;
}

export function totalEnhance(run, armor = run.armor) {
  return CONFIG.body.baseEnhance + run.stats.vit * CONFIG.stats.enhancePerVit + armorEnhance(armor);
}

export const weaponStrReq = item => CONFIG.grades[item.grade].strReq;  // 무기 장착 힘 요구치 (등급별)
export const canWield = (run, item) => run.stats.str >= weaponStrReq(item);

export function activeFamily(run) {
  return run.weapon && canWield(run, run.weapon) ? run.weapon.family : 'fist';
}

export function weaponExtend(run) {
  return activeFamily(run) === 'fist' ? 0 : CONFIG.grades[run.weapon.grade].weaponExtend;
}

// ── 매 포인트 효과 ──
const PP = () => CONFIG.stats.perPoint;
export const strWidthBonus = run => run.stats.str * PP().strLineWidth;            // 내 공격 선 두께 +
export const tecReachBonus = run => run.stats.tec * PP().tecReach;                // 기술 선 길이·원 반경 +
export function enemyLineWidthVs(run) {                                           // 나를 때리는 적 선 두께
  return Math.max(PP().agiEnemyWidthMin, CONFIG.attack.enemyLineWidth + run.stats.agi * PP().agiEnemyWidth);
}
export const learnDiscount = run => Math.min(PP().intLearnDiscountMax, run.stats.int * PP().intLearnDiscount);
export const learnCost = run => Math.round(CONFIG.trainer.learnCost * (1 - learnDiscount(run)));

// ── 스탯 구간(눈에 띄는 효과가 생기는 값) ──
export function statMilestones(key) {
  const S = CONFIG.stats;
  const list = [];
  const add = (at, label) => { if (at > 0) list.push({ at, label }); };
  if (key === 'str') {
    S.damageByStr.forEach(([at, d]) => add(at, `칸당 피해 ${d}`));
    CONFIG.grades.forEach(g => add(g.strReq, `${g.name} 무기`));
  }
  if (key === 'agi') Object.values(CONFIG.dodgeSkills).forEach(d => add(d.agiReq, `${d.name} 해금`));
  if (key === 'tec') Object.values(CONFIG.attackSkills).forEach(a => add(a.tecReq, `${a.name} 해금`));
  // 체력은 구간 없이 포인트마다 강화 +1
  if (key === 'int') S.attackSlotsByInt.forEach(([at, n]) => add(at, `공격 슬롯 ${n}개`));
  // 같은 값끼리 합치기
  const byAt = new Map();
  for (const m of list) byAt.set(m.at, byAt.has(m.at) ? `${byAt.get(m.at)}, ${m.label}` : m.label);
  return [...byAt.entries()].sort((a, b) => a[0] - b[0]).map(([at, label]) => ({ at, label }));
}

// 다음 구간까지: { next, label, remain, prev } (더 없으면 null)
export function nextMilestone(run, key) {
  const v = run.stats[key];
  const ms = statMilestones(key).filter(m => m.at <= CONFIG.stats.cap);
  const next = ms.find(m => m.at > v);
  if (!next) return null;
  const prev = [...ms].reverse().find(m => m.at <= v)?.at ?? 0;
  return { next: next.at, label: next.label, remain: next.at - v, prev };
}

// 스탯별 포인트 효과 설명
export function perPointText(run, key) {
  const f = n => (Math.round(n * 100) / 100).toString();
  if (key === 'str') return `선 두께 +${f(strWidthBonus(run))}`;
  if (key === 'agi') return `적 선 두께 ${f(enemyLineWidthVs(run))}`;
  if (key === 'tec') return `사거리 +${f(tecReachBonus(run))}`;
  if (key === 'vit') return `강화 +${run.stats.vit * CONFIG.stats.enhancePerVit}`;
  if (key === 'int') return `학습비 -${Math.round(learnDiscount(run) * 100)}%`;
  return '';
}
