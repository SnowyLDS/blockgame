// 튜토리얼: 단계마다 실제 전투 화면에서 직접 해 보며 규칙을 익힘
//  combat 단계: combatScreen 에 정해진 몸·적·목표(check)를 넘김
//  formation 단계: 재정비 화면에서 회복 조각 붙이기
import { CONFIG } from '../../config/gameConfig.js';
import { el, setChildren } from '../dom.js';
import { countCells, createBody, makeCell, makeCoreCell, setCell } from '../../core/body.js';
import { buildAttack } from '../../core/attack.js';
import { makeItem } from '../../core/items.js';
import { combatScreen } from './combatScreen.js';
import { sfx } from '../sound.js';
import { npcBanner } from '../widgets.js';
import { icon } from '../sprites.js';

// 문자 지도 → 몸.  C = 코어(플레이어면 중앙 핵심 코어), c = 보조 코어, # = 칸, h = 하트(1차 강화), s = 방패(2차 강화)
function bodyFromMap(rows, w, h, isPlayer) {
  const b = createBody(w, h, []);
  const ox = Math.floor((w - rows[0].length) / 2), oy = Math.floor((h - rows.length) / 2);
  const pal = CONFIG.pieces.palette;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const X = ox + x, Y = oy + y;
    if (ch === 'C') setCell(b, X, Y, { ...makeCoreCell(), main: isPlayer });
    else if (ch === 'c') setCell(b, X, Y, { ...makeCoreCell(), sub: true });
    else if ('#hs'.includes(ch)) {
      const color = pal[(Math.floor(X / 2) + Math.floor(Y / 2) * 3) % pal.length];
      setCell(b, X, Y, makeCell(color, 1, ch === 'h' ? 1 : ch === 's' ? 2 : 0));
    }
  }));
  b.nextPieceId = 2;
  return b;
}

function makeRun(map, skills) {
  return {
    stats: { str: 3, agi: 3, tec: 10, vit: 3, int: 9 },
    gold: 0,
    body: bodyFromMap(map, CONFIG.board.playerW, CONFIG.board.playerH, true),
    weapon: makeItem('weapon', 0, 'sword'), armor: null,
    inventory: [], pending: [],
    learned: { sword: skills }, learnedDodge: ['roll'],
    equippedAttack: skills, equippedDodge: 'roll',
    stage: 1, map: null, pos: null, path: [], visit: {}, battlesWon: 0,
  };
}

function makeEnemy(map, def = {}) {
  return {
    kind: 'monster', name: '훈련용 허수아비', sprite: 'dummy',
    def: { attacks: [], candidates: 1, ...def },
    body: bodyFromMap(map, CONFIG.board.enemyW, CONFIG.board.enemyH, false),
    damage: 1,
  };
}

// 5×5 판 기준
const PLAYER = [
  '#####',
  '#.#.#',
  '#####',
  '#.#.#',
  '#####',
];

let tutRun = null; // 재정비 단계에서 화면을 오가는 동안 유지

const STEPS = [
  {
    type: 'combat', title: '조준하고 공격하기',
    text: '오른쪽 판 위에서 마우스를 움직여 보세요. 파란 선이 내 공격이고, 주황 칸은 피해, 빨간 X 칸은 부서질 칸입니다. ' +
      '위치는 칸 단위가 아니라 아주 조금씩 움직여요 — 선이 칸에 조금이라도 걸치면 맞습니다. 한 번에 4칸 이상 부숴 보세요! (1·2 키로 기술 변경)',
    build: () => ({
      run: makeRun(PLAYER, ['slashV', 'slashH']),
      enemy: makeEnemy(['.###.', '#####', '#####', '#####', '.###.']),
      check(evt, d) {
        if (evt === 'won') return { done: '모두 부쉈네요!' };
        if (evt !== 'attack') return null;
        const n = d.sim.destroyed.length;
        return n >= 4
          ? { done: `${n}칸을 한 번에 부쉈어요! 선을 칸 경계에 걸치면 두 줄을 한꺼번에 벨 수 있습니다.` }
          : { hint: `${n}칸 부쉈어요. 선을 칸과 칸 사이 경계에 살짝 걸쳐 보세요. 한 번 더!` };
      },
    }),
  },
  {
    type: 'combat', title: '체력과 강화 칸',
    text: '체력은 판(6×6)에 놓인 칸 수입니다 — 최대 36칸. 칸이 하나도 안 남으면 집니다. ' +
      '🛡 방패 칸은 맞으면 ❤ 하트로, 하트 칸은 맞으면 일반 칸으로 한 단계씩 내려가고, 일반 칸이 맞으면 부서져요. 강화된 칸을 공격해 보세요.',
    build: () => ({
      run: makeRun(PLAYER, ['slashV', 'slashH']),
      enemy: makeEnemy(['#####', '#hhh#', '#sss#', '#hhh#', '#####']),
      check(evt, d) {
        if (evt !== 'attack') return null;
        return d.sim.hits.some(h => !h.destroyed)
          ? { done: '부서지지 않고 한 단계 내려갔죠? (방패 → 하트 → 일반) 내 몸에도 강화를 지정할 수 있어요 (출발 전 정비·여관에서). 전투가 끝나면 원래 단계로 돌아옵니다.' }
          : { hint: '하트나 방패가 그려진 칸을 맞혀 보세요.' };
      },
    }),
  },
  {
    type: 'combat', title: '적 예고와 회피',
    text: '빨간 선은 적이 곧 할 공격(예고)입니다. 이대로 맞으면 빨간 X 칸이 부서져요. ' +
      '회피(구르기): 3칸 틀을 몸 위에 놓고 클릭해 들어 올린 뒤, 맞지 않는 곳에 클릭해 내려놓으세요. ' +
      '다른 칸 위에 내려놓으면 그 칸은 사라지니, 빈칸으로 옮기는 게 좋아요. (R 또는 우클릭: 틀 회전)',
    build: () => ({
      run: makeRun(['.###.', '.###.', '.....', '.....', '.....'], ['slashV']),
      enemy: makeEnemy(['.###.', '#####', '.###.']),
      setup(combat) {
        combat.phase = 'dodge';
        combat.forecast = [buildAttack({ shapeKey: 'DASH', x: 2.5, y: 1.5, owner: 'enemy', scale: 0.5 })];
      },
      check(evt, d) {
        if (evt === 'skipDodge') return { fail: '회피하지 않으면 그대로 맞아요. 다시 해 보세요.' };
        if (evt !== 'dodge') return null;
        const lossBefore = d.before.destroyed.length;
        const lossAfter = d.after.destroyed.length + d.d.crushed.length; // 겹쳐서 사라진 칸도 손해
        return lossAfter < lossBefore
          ? { done: `잃을 칸을 ${lossBefore}칸 → ${lossAfter}칸으로 줄였어요! 실전에서는 매 턴 예고를 보고 회피합니다.` }
          : { fail: `잃는 칸이 ${lossBefore}칸 → ${lossAfter}칸이에요. 선이 닿지 않는 빈칸으로 옮겨 보세요.` };
      },
    }),
  },
  {
    type: 'combat', title: '실전 연습',
    text: '이제 실제 흐름입니다: ① 내 공격 → ② 적 예고 → ③ 회피 → ④ 적 공격. 항상 내가 먼저 공격해요. ' +
      '예고를 보고 회피하면서 적의 칸을 모두 부숴 보세요!',
    build: () => ({
      run: makeRun(PLAYER, ['slashV', 'slashH']),
      enemy: makeEnemy(['.#.#.', '#####', '.#.#.'], { attacks: [{ patterns: ['simple'] }], candidates: 2 }),
      check(evt) {
        if (evt === 'won') return { done: '훌륭해요! 실제 게임에서는 적이 더 단단하고, 공격 모양도 커집니다.' };
        return null;
      },
    }),
  },
  { type: 'formation', title: '블록으로 회복하기' },
  { type: 'end', title: '튜토리얼 완료' },
];
export const TUTORIAL_STEPS = STEPS;

function header(step, title) {
  return el('div', { class: 'tut-head' },
    el('span', { class: 'tut-step' }, `튜토리얼 ${step + 1} / ${STEPS.length}`), el('b', {}, title));
}

export function tutorialScreen(app, root, { step = 0, formationDone = false } = {}) {
  const def = STEPS[step];
  if (!def) { setTimeout(() => app.go('menu')); return null; }

  if (def.type === 'combat') {
    const b = def.build();
    return combatScreen(app, root, {
      kind: 'monster',
      tutorial: { ...b, title: def.title, text: def.text, index: step, total: STEPS.length },
    });
  }

  if (def.type === 'formation') {
    if (!formationDone || !tutRun) {
      // 몸 일부가 부서진 상태 + 회복 조각 1개
      tutRun = makeRun(['##...', '##...', '#####', '#####', '#####'], ['slashV']);
      tutRun.pending = [{ offsets: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#5cc96b' }];
    }
    const success = formationDone && tutRun.pending.length === 0;
    if (success) sfx.win();
    const open = () => {
      app.run = tutRun;
      app.go('formation', {
        mode: 'attach', back: 'tutorial', backParams: { step, formationDone: true },
        title: '회복 조각 붙이기 (튜토리얼)',
        intro: '오른쪽 보관함의 네모 조각을 클릭해 들고, 판의 빈 곳에 클릭해 놓은 뒤 완료를 누르세요.',
      });
    };
    root.append(el('div', { class: 'screen' },
      el('div', { class: `panel tutorial-box ${success ? 'done' : ''}` },
        header(step, def.title),
        el('div', { class: 'tut-text' },
          '체력은 숫자가 아니라 블록 칸 수입니다. 부서진 칸은 저절로 돌아오지 않아요. ' +
          '회복은 "조각을 몸에 붙이는 것"뿐입니다 — 회복물약도 블록 모양이고, 전투 보상·상점·여관에서 얻어요.'),
        formationDone && el('div', { class: `tut-msg ${success ? 'done' : 'fail'}` },
          success ? `조각을 붙여 ${countCells(tutRun.body)}칸이 되었어요! 판(25칸)이 꽉 찰 때까지 붙일 수 있습니다.` : '아직 조각을 붙이지 않았어요. 다시 해 보세요.'),
        el('div', { class: 'row-buttons' },
          el('button', { class: 'btn small', onclick: () => app.go('menu') }, '튜토리얼 나가기'),
          success
            ? el('button', { class: 'btn primary', onclick: () => { tutRun = null; app.go('tutorial', { step: step + 1 }); } }, '다음 ▶')
            : el('button', { class: 'btn primary with-icon', onclick: open }, icon('pending', 22), '조각 붙이러 가기')))));
    return null;
  }

  // 완료
  app.run = null;
  const box = el('div', { class: 'screen' });
  setChildren(box,
    el('div', { class: 'panel tutorial-box done' },
      header(step, def.title),
      el('div', { class: 'tut-text' }, '기본 규칙을 모두 익혔어요! 실제 게임에서 더 알아둘 것:'),
      el('ul', { class: 'tut-list' },
        [['map', '지도에서 길을 골라 10층 보스까지 올라갑니다 (스테이지 2개)'],
          ['victory', '전투에서 이기면 돈 + 스탯 3택1 + 장비 또는 회복물약 3택1'],
          ['node_inn', '여관: 회복 또는 훈련, 그리고 조각 배치·강화 재정비'],
          ['node_trainer', '훈련교관: 스탯이 오르면 해금된 공격·회피 기술을 배움'],
          ['node_shop', '상점: 회복물약과 장비 구매'],
          ['node_boss', '보스는 자기 이름 글자로 두 번 공격해요 (슬라임 엠페러 → S l i m e)'],
        ].map(([k, t]) => el('li', { class: 'with-icon' }, icon(k, 22), t))),
      el('div', { class: 'row-buttons' },
        el('button', { class: 'btn', onclick: () => app.go('menu') }, '메인 메뉴'),
        el('button', { class: 'btn primary big with-icon', onclick: () => app.go('start') }, icon('start', 24), '게임 시작'))),
    npcBanner('trainer', '잘 했다, 기사여. 이제 진짜 싸움이다.'));
  root.append(box);
  return null;
}
