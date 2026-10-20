// 전투 보상: 스탯 1개 + 아이템 1개(또는 받지 않기)를 고르고 "확정"을 눌러야 적용됨.
//  확정 전에는 같은 카드를 다시 누르면 선택 해제, 다른 카드를 누르면 바뀜
import { CONFIG } from '../../config/gameConfig.js';
import { el, setChildren } from '../dom.js';
import { addPending, advanceStage, gainStat, isLastStage, makeReward } from '../../core/run.js';
import { pieceThumb } from '../draw.js';
import { icon, itemIconCanvas, potionIcon } from '../sprites.js';
import { sfx } from '../sound.js';
import { itemCard, newCoreNotice, screenHeader } from '../widgets.js';

const SKIP = -1; // 아이템 받지 않기

export function rewardScreen(app, root, { kind }) {
  const run = app.run;
  if (!run.visit.reward) {
    run.visit.reward = makeReward(run, kind);
    run.gold += run.visit.reward.gold;
    sfx.coin();
  }
  const rw = run.visit.reward;
  rw.statPick ??= null;
  rw.itemPick ??= null;
  const S = CONFIG.stats;
  const box = el('div', { class: 'screen reward-screen' });

  const toggle = (field, value) => { rw[field] = rw[field] === value ? null : value; render(); };

  function card(node, field, value) {
    const picked = rw[field] === value;
    node.classList.toggle('picked', picked);
    node.classList.toggle('dim', rw[field] != null && !picked);
    node.addEventListener('click', () => toggle(field, value));
    return node;
  }

  function render() {
    const statOk = rw.statPick != null || !rw.statChoices.length;
    const itemOk = rw.itemPick != null;
    setChildren(box,
      screenHeader(app, kind === 'boss' ? '보스 격파!' : '승리!', '', kind === 'boss' ? 'node_boss' : 'victory'),
      el('div', { class: 'panel gold-row' }, itemIconCanvas('gold', 48), el('h3', {}, `+${rw.gold} 골드 (보유 ${run.gold})`)),
      el('div', { class: 'panel' },
        el('h3', {}, `스탯 강화 — 하나 선택 (+${rw.statAmount})`),
        el('div', { class: 'cards' }, rw.statChoices.map(k => card(el('div', { class: 'card stat-card' },
          icon(`stat_${k}`, 40),
          el('div', { class: 'card-title' }, `${S.names[k]} +${rw.statAmount}`),
          el('div', { class: 'card-sub' }, `${run.stats[k]} → ${Math.min(S.cap, run.stats[k] + rw.statAmount)}`),
          el('div', { class: 'card-desc' }, S.desc[k])), 'statPick', k)))),
      el('div', { class: 'panel' },
        el('h3', {}, '아이템 — 하나 선택 (회복물약은 보관함에 들어갑니다)'),
        el('div', { class: 'cards' }, rw.offers.map((o, i) => card(o.type === 'gear'
          ? itemCard(o.item)
          : el('div', { class: 'card' },
            potionIcon(o.piece.offsets.length, 72),
            el('div', { class: 'card-title' }, `회복물약 ${o.piece.offsets.length}칸`),
            el('div', { class: 'thumb' }, pieceThumb(o.piece.offsets, o.piece.color, 20))), 'itemPick', i))),
        el('button', { class: `btn small ${rw.itemPick === SKIP ? 'skill on' : ''}`, onclick: () => toggle('itemPick', SKIP) }, '아이템 받지 않기')),
      el('div', { class: 'row-buttons' },
        el('span', { class: 'muted pick-hint' }, '확정 전에는 다시 눌러 바꿀 수 있어요'),
        el('button', { class: 'btn primary big', disabled: !(statOk && itemOk), onclick: confirm },
          statOk && itemOk ? '확정 ▶' : '스탯과 아이템을 고르세요')),
    );
  }

  // 고른 것을 한꺼번에 적용하고 다음으로
  function confirm() {
    if (rw.statPick != null && gainStat(run, rw.statPick, rw.statAmount)) newCoreNotice();
    const o = rw.itemPick != null && rw.itemPick !== SKIP ? rw.offers[rw.itemPick] : null;
    if (o?.type === 'gear') run.inventory.push(o.item);
    if (o?.type === 'potion') addPending(run, o.piece);
    if (kind === 'boss') {
      if (isLastStage(run)) return app.go('end', { victory: true });
      advanceStage(run);
      return app.go('inn', { between: true }); // 스테이지 사이에는 여관을 반드시 한 번 들름
    }
    app.go('map');
  }

  root.append(box);
  render();
}
