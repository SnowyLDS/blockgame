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

// 내 판 한 변 칸 수 (체력 스탯 구간)
export const boardSize = (run, vit = run.stats.vit) => tableValue(CONFIG.board.playerByVit, vit);

// 최대 체력(칸) = 내 판 칸 수 (빈칸 포함)
export function maxCells(run) {
  return boardSize(run) ** 2;
}

export function totalEnhance(run, armor = run.armor) {
  return CONFIG.body.baseEnhance + run.stats.vit * CONFIG.stats.enhancePerVit + armorEnhance(armor);
}

// 장비 요구 스탯 없음 — 어떤 무기든 장착 가능
export const canWield = () => true;

export function activeFamily(run) {
  return run.weapon && canWield(run, run.weapon) ? run.weapon.family : 'fist';
}

// 무기 등급의 범위 보너스 × 계열 배율 (활은 원이 작아 0.25)
export const gradeExtend = item => CONFIG.grades[item.grade].weaponExtend * (CONFIG.weapons.families[item.family].extendScale ?? 1);

export function weaponExtend(run) {
  return activeFamily(run) === 'fist' ? 0 : gradeExtend(run.weapon);
}

// ── 매 포인트 효과 ──
const PP = () => CONFIG.stats.perPoint;
export const strWidthBonus = run => run.stats.str * PP().strLineWidth;            // 내 공격 선 두께 +
export const tecReachBonus = run => run.stats.tec * PP().tecReach;                // 기술 선 길이·원 반경 +
export function enemyLineWidthVs(run) {                                           // 나를 때리는 적 선 두께
  return Math.max(PP().agiEnemyWidthMin, CONFIG.attack.enemyLineWidth + run.stats.agi * PP().agiEnemyWidth);
}

// ── 스탯 구간(눈에 띄는 효과가 생기는 값) ──
export function statMilestones(key) {
  const S = CONFIG.stats;
  const list = [];
  const add = (at, label) => { if (at > 0) list.push({ at, label }); };
  if (key === 'str') {
    S.damageByStr.forEach(([at, d]) => add(at, `칸당 피해 ${d}`));
  }
  if (key === 'agi') Object.values(CONFIG.dodgeSkills).forEach(d => add(d.agiReq, `${d.name} 습득`));
  if (key === 'tec') Object.values(CONFIG.attackSkills).forEach(a => add(a.tecReq, `${a.name} 습득`));
  if (key === 'vit') CONFIG.board.playerByVit.forEach(([at, n]) => add(at, `판 ${n}×${n}`));
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
  if (key === 'int') return `공격 슬롯 ${attackSlots(run)}개`;
  return '';
}
