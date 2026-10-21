// 여러 화면에서 쓰는 UI 조각
import { CONFIG } from '../config/gameConfig.js';
import { el, toast, setChildren } from './dom.js';
import { assignedEnhance, countCells } from '../core/body.js';
import { itemDesc } from '../core/items.js';
import { activeFamily, dmgPerCell, maxCells, nextMilestone, perPointText, totalEnhance, attackSlots } from '../core/stats.js';
import { openInventory } from './inventory.js';
import { icon, itemIcon, playerSpriteKey, portrait } from './sprites.js';
import { sfx } from './sound.js';

export function itemCard(item, extra = []) {
  const g = CONFIG.grades[item.grade];
  return el('div', { class: 'card item-card', style: `--grade:${g.color}` },
    itemIcon(item, 80),
    el('div', { class: 'card-title', style: `color:${g.color}` }, item.name),
    el('div', { class: 'card-sub' }, `[${g.name}] ${item.kind === 'weapon' ? '무기' : '방어구'}`),
    el('div', { class: 'card-desc' }, itemDesc(item)),
    extra,
  );
}

export function statLine(run, key) {
  const s = CONFIG.stats;
  const v = run.stats[key];
  let note = '';
  if (key === 'str') note = `칸당 피해 ${dmgPerCell(run)}`;
  if (key === 'agi') note = Object.values(CONFIG.dodgeSkills).filter(d => v >= d.agiReq).map(d => d.name).join('·') + ' 습득';
  if (key === 'tec') {
    const fam = activeFamily(run);
    note = Object.values(CONFIG.attackSkills).filter(a => a.family === fam && v >= a.tecReq).map(a => a.name).join('·') + ' 습득';
  }
  if (key === 'vit') note = '포인트마다 강화 +1';
  if (key === 'int') note = `공격 슬롯 ${attackSlots(run)}`;
  const ms = nextMilestone(run, key);
  return el('div', { class: 'stat-block', title: s.desc[key] },
    el('div', { class: 'stat-line' },
      el('span', { class: 'stat-name with-icon' }, icon(`stat_${key}`, 18), s.names[key]),
      el('b', { class: 'stat-val' }, v),
      el('span', { class: 'stat-note' }, note)),
    el('div', { class: 'stat-progress' },
      perPointText(run, key) && el('span', { class: 'per-point' }, perPointText(run, key)),
      ms && el('div', { class: 'bar', title: `${ms.next}: ${ms.label}` },
        el('div', { class: 'fill', style: `width:${Math.round((v - ms.prev) / (ms.next - ms.prev) * 100)}%` })),
      el('span', {}, ms ? `다음 구간까지 ${ms.remain} (${ms.label})` : '모든 구간 달성')));
}

// 화면 위쪽 한 줄 상태 표시줄 (자세한 정보·장비·기술은 인벤토리 창에서)
export function hud(app) {
  const box = el('div', { class: 'hud panel' });
  const render = () => {
    const run = app.run;
    const fam = activeFamily(run);
    const enhLeft = totalEnhance(run) - assignedEnhance(run.body);
    setChildren(box,
      portrait(playerSpriteKey(fam), 44),
      el('div', { class: 'hud-name' }, el('b', {}, '기사'), el('div', { class: 'muted icon-line' }, icon(`fam_${fam}`, 14), CONFIG.weapons.families[fam].name)),
      el('span', { class: 'with-icon', title: '골드' }, icon('gold'), run.gold),
      el('span', { class: 'with-icon', title: '현재 칸 / 최대 칸' }, icon('cells'), `${countCells(run.body)} / ${maxCells(run)}`),
      el('span', { class: 'with-icon', title: '지정한 강화 / 전체 강화' }, icon('enhance'), `${assignedEnhance(run.body)}/${totalEnhance(run)}${enhLeft > 0 ? '!' : ''}`),
      el('span', { class: 'hud-gap' }),
      run.pending.length > 0 && el('button', { class: 'btn small with-icon', onclick: () => app.go('formation', { mode: 'attach', back: app.inventory?.back ?? 'map' }) },
        icon('heal', 18), `회복 조각 ${run.pending.length}개 붙이기`),
      el('button', { class: 'btn primary with-icon', onclick: () => openInventory(app) }, icon('pending', 20), '인벤토리 (I)'));
  };
  render();
  box.refresh = render;
  return box;
}
// 스탯을 올린 결과 알림 (gainStat 반환값): 판이 커짐 / 새 기술 습득
export function statGainNotice({ grown, learned }) {
  const msgs = [];
  if (grown) msgs.push(`판이 ${grown}×${grown} 으로 커졌습니다! 최대 체력 ${grown * grown}칸 — 빈칸은 회복 조각으로 채우세요`);
  if (learned.length) msgs.push(`새 기술: ${learned.join(', ')} — 인벤토리(I)에서 장착을 바꿀 수 있어요`);
  if (!msgs.length) return;
  sfx.enhance();
  toast(`☆ ${msgs.join(' / ')}`);
}

// 상점 주인·여관 주인·교관 등 NPC 초상화 + 대사
export function npcBanner(spriteKey, line) {
  return el('div', { class: 'panel npc' },
    portrait(spriteKey, 96),
    el('div', {},
      el('b', {}, CONFIG.sprites.cells[spriteKey]?.desc.split(' — ')[0] ?? ''),
      el('p', { class: 'muted' }, `“${line}”`)));
}

// iconKey: CONFIG.icons 의 키 (제목 앞 아이콘)
export function screenHeader(app, title, sub = '', iconKey = null) {
  const run = app.run;
  const floor = run?.pos ? run.pos.floor + 1 : 0;
  return el('div', { class: 'header' },
    el('h2', { class: 'with-icon' }, iconKey && icon(iconKey, 30), title),
    el('div', { class: 'muted' }, sub || (run ? `스테이지 ${run.stage} / ${CONFIG.map.stages} · ${floor ? `${floor}층` : '출발 전'}` : '')));
}
