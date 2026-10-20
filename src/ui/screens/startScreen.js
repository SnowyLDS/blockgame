import { CONFIG } from '../../config/gameConfig.js';
import { el } from '../dom.js';
import { randInt } from '../../core/rng.js';
import { newRun, rollStat } from '../../core/run.js';
import { sfx } from '../sound.js';
import { icon } from '../sprites.js';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function startScreen(app, root) {
  const S = CONFIG.stats;
  const vals = Object.fromEntries(S.keys.map(k => [k, null]));
  const rolling = new Set();
  const timers = [];

  const rows = {};
  const startBtn = el('button', { class: 'btn primary big', disabled: true, onclick: start }, '모험 시작 ▶');
  const allBtn = el('button', { class: 'btn with-icon', onclick: rollAll }, icon('dice', 22), '남은 스탯 모두 굴리기');

  for (const k of S.keys) {
    const face = el('div', { class: 'die' }, '?');
    const btn = el('button', { class: 'btn small with-icon', onclick: () => roll(k) }, icon('dice', 18), '굴리기');
    rows[k] = { face, btn };
  }

  function update() {
    for (const k of S.keys) {
      const done = vals[k] != null;
      rows[k].btn.disabled = done || rolling.has(k);
      if (done) rows[k].face.textContent = vals[k];
    }
    const remaining = S.keys.some(k => vals[k] == null && !rolling.has(k));
    allBtn.disabled = !remaining;
    startBtn.disabled = S.keys.some(k => vals[k] == null);
  }

  function roll(k) {
    if (vals[k] != null || rolling.has(k)) return;
    rolling.add(k);
    let n = 0;
    const t = setInterval(() => {
      rows[k].face.textContent = FACES[randInt(0, 5)];
      rows[k].face.classList.add('rolling');
      sfx.dice();
      if (++n >= 10) {
        sfx.diceLand();
        clearInterval(t);
        rolling.delete(k);
        rows[k].face.classList.remove('rolling');
        vals[k] = rollStat();
        update();
      }
    }, 55);
    timers.push(t);
    update();
  }

  function rollAll() { S.keys.forEach(k => roll(k)); }

  function start() {
    app.run = newRun(vals);
    app.go('formation', { mode: 'full', back: 'map', title: '출발 전 정비', intro: '시작 몸을 확인하고 강화 횟수를 칸에 지정하세요. (이후 배치 수정은 여관에서만 가능)' });
  }

  root.append(el('div', { class: 'screen start' },
    el('h1', { class: 'title with-icon' }, icon('start', 40), '기사 출정 준비'),
    el('p', { class: 'muted' }, '주사위로 기사의 시작 스탯을 정하세요. 맨손, 최대 체력으로 출발합니다.'),
    el('div', { class: 'panel stat-roll' },
      el('h3', {}, `시작 스탯 (각 ${S.rollMin}~${S.rollMax})`),
      el('div', { class: 'muted' }, `주사위 확률: ${S.rollWeights.map((w, i) => `${S.rollMin + i} → ${w}%`).join(' · ')}`),
      S.keys.map(k => el('div', { class: 'roll-row' },
        el('div', { class: 'roll-name with-icon' }, icon(`stat_${k}`, 22), S.names[k]),
        el('div', { class: 'roll-desc muted' }, S.desc[k]),
        rows[k].face, rows[k].btn)),
      el('div', { class: 'row-buttons' },
        el('button', { class: 'btn', onclick: () => app.go('menu') }, '◀ 메인 메뉴'), allBtn, startBtn)),
    el('div', { class: 'panel help' },
      el('h3', {}, '조작'),
      el('ul', {},
        el('li', {}, '전투: 내 공격 → 적 공격 예고 → 회피 1회 → 적 공격 (항상 내가 먼저)'),
        el('li', {}, '공격: 기술 선택(1·2·3) 후 적 몸 위에서 마우스로 미세 조준, 클릭'),
        el('li', {}, '회피: 틀을 몸 위에 두고 클릭해 들어 올린 뒤, 옮길 곳에서 클릭 (휠 = 든 블록 90° 회전, R/우클릭 = 틀 회전, Esc 취소, Space 건너뛰기)'),
        el('li', {}, '체력 = 5×5 판에 놓인 칸 수 (최대 25). 하트·방패 강화 칸은 여러 번 맞아야 부서짐'),
        el('li', {}, '상대 칸을 모두 부수면 승리, 내 칸이 모두 부서지면 패배 — 인벤토리는 I / Tab'),
        el('li', {}, '주황 = 피해, 빨강 X = 파괴'))),
  ));
  update();
  return () => timers.forEach(clearInterval);
}
