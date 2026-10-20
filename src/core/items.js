// 장비 아이템 생성
import { CONFIG } from '../config/gameConfig.js';
import { pick, weightedIndex, weightedKey } from './rng.js';

let uid = 1;

export function makeItem(kind, grade, family = null) {
  const g = CONFIG.grades[grade];
  const name = kind === 'weapon'
    ? `${g.name} ${CONFIG.weapons.families[family].name}`
    : `${g.name} ${CONFIG.items.armorName}`;
  return { id: uid++, kind, grade, family: kind === 'weapon' ? family : null, name };
}

export const rollGrade = oddsKey => weightedIndex(CONFIG.items.odds[oddsKey]);

export function randomItem(oddsKey) {
  const kind = weightedKey(CONFIG.items.kindWeights);
  return makeItem(kind, rollGrade(oddsKey), kind === 'weapon' ? pick(CONFIG.items.weaponDrops) : null);
}

export const itemPrice = item => CONFIG.grades[item.grade].price;

export function itemDesc(item) {
  const g = CONFIG.grades[item.grade];
  if (item.kind === 'weapon') {
    return `요구 힘 ${g.strReq} · 공격 범위 +${g.weaponExtend}칸`;
  }
  return `강화 횟수 +${g.armorEnhance}`;
}

export function itemIcon(item) {
  return item.kind === 'weapon' ? CONFIG.weapons.families[item.family].icon : '🛡️';
}
