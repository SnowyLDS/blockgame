import { CONFIG } from '../../config/gameConfig.js';
import { el, setChildren } from '../dom.js';
import { addPending, gainStat, makeHealChoices } from '../../core/run.js';
import { pieceThumb } from '../draw.js';
import { icon } from '../sprites.js';
import { hud, npcBanner, screenHeader, statGainNotice } from '../widgets.js';

export function innScreen(app, root) {
  const run = app.run;
  const v = run.visit;
  v.inn ??= { choice: null, round: 0, options: null };
  const st = v.inn;
  const S = CONFIG.stats;
  const between = !run.pos; // 스테이지 사이 (보스 처치 후, 새 지도 시작 전) 에 들르는 황금 여관
  const rounds = between ? CONFIG.inn.goldenHealRounds : CONFIG.inn.healRounds;
  const box = el('div', { class: 'screen inn-screen' });

  function chooseHeal() {
    st.choice = 'heal';
    st.options = makeHealChoices();
    render();
  }

  function pickPiece(p) {
    addPending(run, p);
    st.round++;
    st.options = st.round < rounds ? makeHealChoices() : null;
    if (!st.options) return app.go('formation', { mode: 'full', back: 'inn', title: '여관 재정비', intro: '받은 조각을 몸에 붙이고, 배치와 강화를 다시 정하세요.' });
    render();
  }

  function body() {
    if (!st.choice) {
      return el('div', { class: 'cards' },
        el('div', { class: 'card big-card', onclick: chooseHeal },
          icon('heal', 56),
          el('div', { class: 'card-title' }, '회복'),
          el('div', { class: 'card-desc' }, `조각 ${CONFIG.inn.healChoices}택1 을 ${rounds}번 받습니다`)),
        el('div', { class: 'card big-card', onclick: () => { st.choice = 'train'; render(); } },
          icon('train', 56),
          el('div', { class: 'card-title' }, '훈련'),
          el('div', { class: 'card-desc' }, `원하는 스탯 +${CONFIG.inn.trainAmount}`)));
    }
    if (st.choice === 'heal' && st.options) {
      return el('div', {},
        el('h3', {}, `회복 조각 고르기 (${st.round + 1} / ${rounds})`),
        el('div', { class: 'cards' }, st.options.map(p => el('div', { class: 'card', onclick: () => pickPiece(p) },
          el('div', { class: 'card-title' }, `${p.offsets.length}칸 조각`),
          el('div', { class: 'thumb' }, pieceThumb(p.offsets, p.color, 20))))));
    }
    if (st.choice === 'train' && !st.trained) {
      return el('div', {},
        el('h3', {}, '훈련할 스탯'),
        el('div', { class: 'cards' }, S.keys.map(k => el('div', {
          class: `card stat-card ${run.stats[k] >= S.cap ? 'dim' : ''}`,
          onclick: () => {
            if (run.stats[k] >= S.cap) return;
            statGainNotice(gainStat(run, k, CONFIG.inn.trainAmount));
            st.trained = k; render();
          },
        },
        icon(`stat_${k}`, 40),
        el('div', { class: 'card-title' }, `${S.names[k]} ${run.stats[k]}`),
        el('div', { class: 'card-desc' }, S.desc[k])))));
    }
    return el('p', { class: 'muted' }, st.choice === 'train'
      ? `훈련 완료: ${S.names[st.trained]} +${CONFIG.inn.trainAmount}`
      : '회복 조각을 받았습니다. 재정비에서 몸에 붙일 수 있어요.');
  }

  function render() {
    setChildren(box,
      screenHeader(app, between ? `${CONFIG.inn.goldenName} — 스테이지 ${run.stage} 출발 전` : '여관', '', 'node_inn'),
      bar,
      el('div', { class: 'side-row' },
        el('div', {},
          npcBanner('innkeeper', between ? `보스를 쓰러뜨렸군요! ${CONFIG.inn.goldenName}에 오신 걸 환영해요. 오늘은 회복을 ${rounds}번 해 드릴게요.` : '푹 쉬고 가요. 몸도 다시 맞춰 드릴게요.'),
          el('div', { class: 'panel' },
            el('h3', {}, '재정비 (항상 가능)'),
            el('p', { class: 'muted' }, '조각 배치·위치 수정, 강화 재지정, 보관 중인 조각 붙이기'),
            el('button', { class: 'btn', onclick: () => app.go('formation', { mode: 'full', back: 'inn', title: '여관 재정비' }) }, '재정비 하기'))),
        el('div', { class: 'panel' }, el('h3', {}, '휴식 — 하나만 선택'), body())),
      el('div', { class: 'row-buttons' }, el('button', { class: 'btn primary', onclick: () => app.go('map') }, '떠나기 ▶')),
    );
    bar.refresh();
  }
  const bar = hud(app);
  app.inventory = { back: 'inn', onChange: render };
  root.append(box);
  render();
}
