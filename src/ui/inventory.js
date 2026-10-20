// 인벤토리 창 (I / Tab): 장비 칸·가방 칸·회복 조각·스탯·기술 장착을 한 곳에서
//  화면은 app.inventory = { back: 돌아올 화면 이름, onChange } 를 설정해야 열 수 있음 (전투 중에는 없음)
import { CONFIG } from '../config/gameConfig.js';
import { el, setChildren, toast } from './dom.js';
import { assignedEnhance, countCells } from '../core/body.js';
import { itemDesc } from '../core/items.js';
import { activeFamily, attackSlots, canWield, dmgPerCell, maxCells, totalEnhance, weaponExtend } from '../core/stats.js';
import { equipDodge, learnedOf, toggleEquipAttack } from '../core/skills.js';
import { equipItem, unequipSlot } from '../core/run.js';
import { buildAttack } from '../core/attack.js';
import { dodgeFrameOffsets } from '../core/dodge.js';
import { pieceThumb, shapeThumb } from './draw.js';
import { icon, itemIcon, playerSpriteKey, portrait, potionIcon } from './sprites.js';
import { sfx } from './sound.js';
import { statLine } from './widgets.js';

const BAG_SLOTS = 20; // 가방 칸 수 (5 × 4)
let overlay = null;
let hovered = null;  // 아래 정보 칸에 보여줄 대상

export const inventoryOpen = () => !!overlay;

export function toggleInventory(app) {
  if (overlay) closeInventory(app);
  else openInventory(app);
}

export function closeInventory(app) {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  hovered = null;
  app?.inventory?.onChange?.();
}

export function openInventory(app) {
  if (overlay || !app.run || !app.inventory) return;
  sfx.pick();
  overlay = el('div', { class: 'inv-overlay', onclick: e => { if (e.target === overlay) closeInventory(app); } });
  document.body.append(overlay);
  render(app);
}

function act(app, r) {
  toast(r.msg);
  if (r.ok) sfx.place(); else sfx.error();
  render(app);
}

// 칸 하나 (아이템 아이콘 + 등급 테두리)
function slot(content, { cls = '', grade = null, label = '', onClick, hover } = {}) {
  const s = el('div', {
    class: `inv-slot ${cls} ${content ? 'filled' : 'empty'}`,
    style: grade != null ? `--grade:${CONFIG.grades[grade].color}` : '',
    onclick: onClick,
  }, content, label && el('span', { class: 'slot-label' }, label));
  if (hover) s.addEventListener('mouseenter', () => { hovered = hover; renderInfo(); });
  return s;
}

let infoBox = null;
function renderInfo() {
  if (!infoBox) return;
  setChildren(infoBox, hovered
    ? [el('b', { style: hovered.color ? `color:${hovered.color}` : '' }, hovered.title), el('div', {}, hovered.text), hovered.hint && el('div', { class: 'muted' }, hovered.hint)]
    : el('span', { class: 'muted' }, '칸에 마우스를 올리면 정보가 보여요. 가방 아이템 클릭 = 장착, 장비 칸 클릭 = 해제'));
}

function render(app) {
  const run = app.run;
  const fam = activeFamily(run);
  const famCfg = CONFIG.weapons.families[fam];
  const enhLeft = totalEnhance(run) - assignedEnhance(run.body);

  // ── 장비 칸 ──
  const equipSlot = (slotName, label) => {
    const item = run[slotName];
    return slot(item ? itemIcon(item, 48) : el('span', { class: 'slot-ghost' }, slotName === 'weapon' ? icon('fam_sword', 30) : icon('cells', 30)), {
      cls: 'equip', grade: item?.grade, label,
      onClick: () => item && act(app, unequipSlot(run, slotName)),
      hover: item ? { title: item.name, text: itemDesc(item), hint: '클릭하면 해제', color: CONFIG.grades[item.grade].color } : { title: label, text: '비어 있음' },
    });
  };

  // ── 가방 칸 ──
  const bag = Array.from({ length: Math.max(BAG_SLOTS, run.inventory.length) }, (_, i) => {
    const item = run.inventory[i];
    if (!item) return slot(null);
    const blocked = item.kind === 'weapon' && !canWield(run, item);
    return slot(itemIcon(item, 48), {
      grade: item.grade, cls: blocked ? 'blocked' : '',
      onClick: () => act(app, equipItem(run, item)),
      hover: { title: item.name, text: itemDesc(item), hint: blocked ? `힘이 부족해 장착할 수 없어요` : '클릭하면 장착', color: CONFIG.grades[item.grade].color },
    });
  });

  // ── 회복 조각 (보관함) ──
  const potions = run.pending.map(p => slot(el('div', { class: 'potion-slot' }, potionIcon(p.offsets.length, 40), pieceThumb(p.offsets, p.color, 8)), {
    label: `${p.offsets.length}칸`,
    onClick: () => { closeInventory(app); app.go('formation', { mode: 'attach', back: app.inventory.back }); },
    hover: { title: `회복 조각 ${p.offsets.length}칸`, text: '몸에 붙이면 그만큼 체력(칸)이 늘어요', hint: '클릭하면 몸에 붙이러 가기' },
  }));

  // ── 기술 ──
  const learned = learnedOf(run, fam);
  const skillTile = k => {
    const s = CONFIG.attackSkills[k];
    const on = run.equippedAttack.includes(k);
    const atk = buildAttack({ shapeKey: s.shape, x: 2.5, y: 2.5, extend: weaponExtend(run) });
    return slot(shapeThumb(atk.placed, 5, 5, 10), {
      cls: on ? 'on' : '', label: s.name,
      onClick: () => act(app, toggleEquipAttack(run, k)),
      hover: { title: s.name, text: on ? '장착 중' : '배움', hint: '클릭하면 장착/해제' },
    });
  };
  const dodgeTile = k => {
    const s = CONFIG.dodgeSkills[k];
    const on = run.equippedDodge === k;
    return slot(pieceThumb(dodgeFrameOffsets(k), '#45a0c8', 9), {
      cls: on ? 'on' : '', label: s.name,
      onClick: () => act(app, equipDodge(run, k)),
      hover: { title: s.name, text: on ? '장착 중' : '배움', hint: '클릭하면 장착' },
    });
  };

  infoBox = el('div', { class: 'inv-info' });
  setChildren(overlay, el('div', { class: 'inv-window panel' },
    el('div', { class: 'inv-head' },
      el('h2', { class: 'with-icon' }, icon('pending', 28), '인벤토리'),
      el('span', { class: 'muted' }, 'I / Tab / Esc 로 닫기'),
      el('button', { class: 'btn small', onclick: () => closeInventory(app) }, '닫기 ✕')),
    el('div', { class: 'inv-body' },
      // 왼쪽: 캐릭터 + 장비 + 스탯
      el('div', { class: 'inv-left' },
        el('div', { class: 'inv-char' },
          equipSlot('weapon', '무기'),
          portrait(playerSpriteKey(fam), 120),
          equipSlot('armor', '방어구')),
        el('div', { class: 'inv-summary' },
          el('span', { class: 'with-icon' }, icon('gold'), run.gold),
          el('span', { class: 'with-icon' }, icon('cells'), `${countCells(run.body)} / ${maxCells(run)}`),
          el('span', { class: 'with-icon', title: '지정한 강화 / 전체' }, icon('enhance'), `${assignedEnhance(run.body)}/${totalEnhance(run)}${enhLeft > 0 ? ` (미지정 ${enhLeft})` : ''}`)),
        el('div', { class: 'equip-note with-icon' }, icon(`fam_${fam}`, 16), `${famCfg.name} · 범위 +${weaponExtend(run)} · 칸당 피해 ${dmgPerCell(run)}`),
        el('h4', {}, '스탯'),
        CONFIG.stats.keys.map(k => statLine(run, k))),
      // 오른쪽: 가방 + 회복 조각 + 기술
      el('div', { class: 'inv-right' },
        el('h4', {}, `가방 (${run.inventory.length}/${BAG_SLOTS})`),
        el('div', { class: 'inv-grid' }, bag),
        el('h4', {}, `회복 조각 (${run.pending.length})`),
        run.pending.length ? el('div', { class: 'inv-grid' }, potions) : el('div', { class: 'muted' }, '없음 — 전투 보상·상점·여관에서 얻어요'),
        el('h4', {}, `공격 기술 — 장착 ${run.equippedAttack.length}/${attackSlots(run)} (${famCfg.name})`),
        el('div', { class: 'inv-grid skills' }, learned.map(skillTile)),
        el('h4', {}, '회피 기술 — 1개 장착'),
        el('div', { class: 'inv-grid skills' }, run.learnedDodge.map(dodgeTile)))),
    infoBox));
  renderInfo();
}
