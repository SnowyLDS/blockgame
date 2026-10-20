import { CONFIG } from '../../config/gameConfig.js';
import { el } from '../dom.js';
import { icon } from '../sprites.js';

export function endScreen(app, root, { victory }) {
  const run = app.run;
  root.append(el('div', { class: 'screen end-screen' },
    el('h1', { class: 'title with-icon' }, icon(victory ? 'victory' : 'defeat', 48), victory ? '모든 스테이지 클리어!' : '몸이 무너졌다...'),
    run && el('div', { class: 'panel' },
      el('p', {}, `도달: 스테이지 ${run.stage} · ${run.pos ? run.pos.floor + 1 : 0}층`),
      el('p', {}, `승리한 전투: ${run.battlesWon}`),
      el('p', {}, `최종 스탯: ${CONFIG.stats.keys.map(k => `${CONFIG.stats.names[k]} ${run.stats[k]}`).join(' · ')}`)),
    el('div', { class: 'row-buttons' },
      el('button', { class: 'btn big', onclick: () => { app.run = null; app.go('menu'); } }, '메인 메뉴'),
      el('button', { class: 'btn primary big', onclick: () => { app.run = null; app.go('start'); } }, '새 게임'))));
}
