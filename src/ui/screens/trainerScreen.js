import { CONFIG } from '../../config/gameConfig.js';
import { el, toast, setChildren } from '../dom.js';
import { attackStatus, dodgeStatus, familySkills, learnedOf } from '../../core/skills.js';
import { trainerLearn } from '../../core/run.js';
import { buildAttack } from '../../core/attack.js';
import { dodgeFrameOffsets } from '../../core/dodge.js';
import { activeFamily, learnCost, learnDiscount, tecReachBonus, weaponExtend } from '../../core/stats.js';
import { pieceThumb, shapeThumb } from '../draw.js';
import { icon } from '../sprites.js';
import { hud, npcBanner, screenHeader } from '../widgets.js';

const STATUS = {
  locked:   { label: '🔒 잠김', cls: 'locked' },
  unlocked: { label: '✅ 해금 (배울 수 있음)', cls: 'unlocked' },
  learned:  { label: '📘 학습함', cls: 'learned' },
  equipped: { label: '⭐ 장착 중', cls: 'equipped' },
};

export function trainerScreen(app, root) {
  const run = app.run;
  run.visit.learnsLeft ??= CONFIG.trainer.learnsPerVisit;
  const box = el('div', { class: 'screen trainer-screen' });
  const forget = {}; // 계열별 잊을 기술 선택

  function learnButton(status, full, family, onLearn) {
    if (status !== 'unlocked') return null;
    const cost = learnCost(run);
    const disabled = run.visit.learnsLeft <= 0 || run.gold < cost;
    if (!full) return el('button', { class: 'btn small with-icon', disabled, onclick: onLearn }, '배우기 ', icon('gold', 16), cost);
    const list = family === 'dodge' ? run.learnedDodge : learnedOf(run, family);
    const names = k => (family === 'dodge' ? CONFIG.dodgeSkills[k].name : CONFIG.attackSkills[k].name);
    forget[family] ??= list[0];
    const sel = el('select', { onchange: e => { forget[family] = e.target.value; } },
      list.map(k => el('option', { value: k, selected: forget[family] === k }, names(k))));
    return el('div', { class: 'forget' }, el('span', { class: 'muted' }, '잊을 기술:'), sel,
      el('button', { class: 'btn small warn with-icon', disabled, onclick: onLearn }, '잊고 배우기 ', icon('gold', 16), cost));
  }

  function after(r) {
    toast(r.msg);
    if (r.ok) run.visit.learnsLeft--;
    render();
  }

  function attackSection(family) {
    const fam = CONFIG.weapons.families[family];
    const list = learnedOf(run, family);
    const full = list.length >= CONFIG.skills.maxLearnedPerFamily;
    return el('div', { class: 'panel' },
      el('h3', { class: 'with-icon' }, icon(`fam_${family}`, 24), `${fam.name} 공격 기술 (배움 ${list.length}/${CONFIG.skills.maxLearnedPerFamily})${activeFamily(run) === family ? ' — 현재 무기' : ''}`),
      el('div', { class: 'skill-list' }, familySkills(family).map(k => {
        const s = CONFIG.attackSkills[k];
        const status = attackStatus(run, k);
        const atk = buildAttack({ shapeKey: s.shape, x: 3.5, y: 3.5, extend: (activeFamily(run) === family ? weaponExtend(run) : 0) + tecReachBonus(run) });
        return el('div', { class: `skill-row ${STATUS[status].cls}` },
          shapeThumb(atk.placed, 7, 7, 10),
          el('div', { class: 'skill-info' },
            el('b', {}, s.name),
            el('div', { class: 'muted' }, `요구: 기술 ${s.tecReq}`),
            el('div', { class: `badge ${STATUS[status].cls}` }, STATUS[status].label)),
          learnButton(status, full, family, () => after(trainerLearn(run, 'attack', k, full ? forget[family] : null))));
      })));
  }

  function dodgeSection() {
    const full = run.learnedDodge.length >= CONFIG.skills.maxLearnedDodge;
    return el('div', { class: 'panel' },
      el('h3', { class: 'with-icon' }, icon('dodge', 24), `회피 기술 (배움 ${run.learnedDodge.length}/${CONFIG.skills.maxLearnedDodge})`),
      el('div', { class: 'skill-list' }, Object.keys(CONFIG.dodgeSkills).map(k => {
        const s = CONFIG.dodgeSkills[k];
        const status = dodgeStatus(run, k);
        return el('div', { class: `skill-row ${STATUS[status].cls}` },
          el('div', { class: 'thumb' }, pieceThumb(dodgeFrameOffsets(k), '#45a0c8', 12)),
          el('div', { class: 'skill-info' },
            el('b', {}, `${s.name} (${dodgeFrameOffsets(k).length}칸)`),
            el('div', { class: 'muted' }, `요구: 민첩 ${s.agiReq}`),
            el('div', { class: `badge ${STATUS[status].cls}` }, STATUS[status].label)),
          learnButton(status, full, 'dodge', () => after(trainerLearn(run, 'dodge', k, full ? forget.dodge : null))));
      })));
  }

  function render() {
    const families = Object.keys(CONFIG.weapons.families).filter(f => f !== 'fist');
    setChildren(box,
      screenHeader(app, '훈련교관', '', 'node_trainer'),
      bar,
      el('div', { class: 'side-row' },
        npcBanner('trainer', '기술은 스탯이 받쳐줘야 배울 수 있다. 준비됐나?'),
        el('div', { class: 'panel' },
          el('p', {}, `이번 방문에서 배울 수 있는 횟수: `, el('b', {}, run.visit.learnsLeft)),
          el('p', { class: 'with-icon' }, '학습 비용: ', icon('gold', 18), el('b', {}, learnCost(run)), `  (지능 할인 -${Math.round(learnDiscount(run) * 100)}%, 보유 ${run.gold})`),
          el('p', { class: 'muted' }, '해금 = 스탯 조건 충족 · 학습 = 교관에게 배움 · 장착 = 전투에 가져감 (인벤토리 I 에서 변경). 같은 계열 무기로 바꾸면 배운 기술이 유지됩니다.'))),
      el('div', { class: 'three-col' }, families.map(attackSection), dodgeSection()),
      el('div', { class: 'row-buttons' }, el('button', { class: 'btn primary', onclick: () => app.go('map') }, '떠나기 ▶')),
    );
    bar.refresh();
  }
  const bar = hud(app);
  app.inventory = { back: 'trainer', onChange: render };
  root.append(box);
  render();
}
