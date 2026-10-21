// 기술: 스탯이 요구치에 닿으면 자동으로 배움 (공격 = 기술 스탯, 회피 = 민첩) → 인벤토리에서 장착
import { CONFIG } from '../config/gameConfig.js';
import { activeFamily, attackSlots } from './stats.js';

const ok = msg => ({ ok: true, msg });
const fail = msg => ({ ok: false, msg });

export const familySkills = family =>
  Object.keys(CONFIG.attackSkills).filter(k => CONFIG.attackSkills[k].family === family);

// 지금 스탯으로 쓸 수 있는 기술 (설정 순서대로)
const unlockedAttacks = (run, family) => familySkills(family).filter(k => run.stats.tec >= CONFIG.attackSkills[k].tecReq);
const unlockedDodges = run => Object.keys(CONFIG.dodgeSkills).filter(k => run.stats.agi >= CONFIG.dodgeSkills[k].agiReq);

export function learnedOf(run, family) {
  run.learned[family] = unlockedAttacks(run, family);
  return run.learned[family];
}

export function toggleEquipAttack(run, key) {
  const s = CONFIG.attackSkills[key];
  if (s.family !== activeFamily(run)) return fail('현재 무기 계열 기술이 아닙니다');
  if (!learnedOf(run, s.family).includes(key)) return fail('배우지 않은 기술입니다');
  const eq = run.equippedAttack;
  const i = eq.indexOf(key);
  if (i >= 0) {
    if (eq.length <= 1) return fail('공격 기술은 1개 이상 장착해야 합니다');
    eq.splice(i, 1);
    return ok('해제');
  }
  if (eq.length >= attackSlots(run)) eq.shift(); // 슬롯이 가득 차면 가장 오래된 것과 교체
  eq.push(key);
  return ok('장착');
}

export function equipDodge(run, key) {
  if (!run.learnedDodge.includes(key)) return fail('배우지 않은 기술입니다');
  run.equippedDodge = key;
  return ok('장착');
}

// 무기·스탯이 바뀐 뒤 배운 기술·장착 상태를 맞춤
//  반환: 이번에 새로 배운 기술 이름 목록 (공격은 지금 무기 계열만)
export function normalizeLoadout(run) {
  const fam = activeFamily(run);
  const had = new Set([...(run.learned[fam] ?? []), ...run.learnedDodge]);
  const list = learnedOf(run, fam);
  run.learnedDodge = unlockedDodges(run);
  const fresh = [...list, ...run.learnedDodge].filter(k => !had.has(k));
  const slots = attackSlots(run);
  run.equippedAttack = run.equippedAttack.filter(k => list.includes(k)).slice(0, slots);
  for (const k of list) {
    if (run.equippedAttack.length >= slots) break;
    if (!run.equippedAttack.includes(k)) run.equippedAttack.push(k);
  }
  // 새 회피 기술을 배우면 바로 장착 (인벤토리에서 바꿀 수 있음)
  const newDodge = fresh.filter(k => CONFIG.dodgeSkills[k]).pop();
  if (newDodge) run.equippedDodge = newDodge;
  if (!run.learnedDodge.includes(run.equippedDodge)) run.equippedDodge = run.learnedDodge[0] ?? null;
  return fresh.map(k => (CONFIG.attackSkills[k] ?? CONFIG.dodgeSkills[k]).name);
}
