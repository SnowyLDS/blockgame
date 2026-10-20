// 기술 해금 → 학습 → 장착
import { CONFIG } from '../config/gameConfig.js';
import { activeFamily, attackSlots } from './stats.js';

const ok = msg => ({ ok: true, msg });
const fail = msg => ({ ok: false, msg });

export const familySkills = family =>
  Object.keys(CONFIG.attackSkills).filter(k => CONFIG.attackSkills[k].family === family);

export const baseSkill = family =>
  familySkills(family).find(k => CONFIG.attackSkills[k].tecReq <= 0);

export function learnedOf(run, family) {
  if (!run.learned[family]) run.learned[family] = [];
  return run.learned[family];
}

// 'locked' | 'unlocked' | 'learned' | 'equipped'
export function attackStatus(run, key) {
  const s = CONFIG.attackSkills[key];
  if (activeFamily(run) === s.family && run.equippedAttack.includes(key)) return 'equipped';
  if (learnedOf(run, s.family).includes(key)) return 'learned';
  return run.stats.tec >= s.tecReq ? 'unlocked' : 'locked';
}

export function dodgeStatus(run, key) {
  if (run.equippedDodge === key) return 'equipped';
  if (run.learnedDodge.includes(key)) return 'learned';
  return run.stats.agi >= CONFIG.dodgeSkills[key].agiReq ? 'unlocked' : 'locked';
}

function learnInto(list, key, max, forgetKey) {
  if (list.includes(key)) return fail('이미 배운 기술입니다');
  if (list.length >= max) {
    if (!forgetKey || !list.includes(forgetKey)) return fail(`최대 ${max}개까지 배울 수 있어요. 잊을 기술을 고르세요`);
    list.splice(list.indexOf(forgetKey), 1);
  }
  list.push(key);
  return ok('배웠습니다');
}

export function learnAttack(run, key, forgetKey) {
  const s = CONFIG.attackSkills[key];
  if (run.stats.tec < s.tecReq) return fail(`기술 ${s.tecReq} 이상 필요`);
  const r = learnInto(learnedOf(run, s.family), key, CONFIG.skills.maxLearnedPerFamily, forgetKey);
  if (r.ok) {
    if (forgetKey) run.equippedAttack = run.equippedAttack.filter(k => k !== forgetKey);
    normalizeLoadout(run);
  }
  return r;
}

export function learnDodge(run, key, forgetKey) {
  const s = CONFIG.dodgeSkills[key];
  if (run.stats.agi < s.agiReq) return fail(`민첩 ${s.agiReq} 이상 필요`);
  const r = learnInto(run.learnedDodge, key, CONFIG.skills.maxLearnedDodge, forgetKey);
  if (r.ok) normalizeLoadout(run);
  return r;
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

// 무기·스탯이 바뀐 뒤 장착 상태를 맞춤
export function normalizeLoadout(run) {
  const fam = activeFamily(run);
  const list = learnedOf(run, fam);
  if (!list.length) {
    const b = baseSkill(fam);
    if (b) list.push(b); // 계열 기본 기술은 처음 쥘 때 자동 습득
  }
  const slots = attackSlots(run);
  run.equippedAttack = run.equippedAttack.filter(k => list.includes(k)).slice(0, slots);
  for (const k of list) {
    if (run.equippedAttack.length >= slots) break;
    if (!run.equippedAttack.includes(k)) run.equippedAttack.push(k);
  }
  if (!run.learnedDodge.includes(run.equippedDodge)) run.equippedDodge = run.learnedDodge[0] ?? null;
}
