// 메인 메뉴: 게임 시작 / 튜토리얼 / 설정
import { CONFIG } from '../../config/gameConfig.js';
import { el } from '../dom.js';
import { icon, portrait } from '../sprites.js';

export function menuScreen(app, root) {
  app.run = null;
  root.append(el('div', { class: 'screen menu-screen' },
    el('h1', { class: 'title big-title with-icon' }, icon('logo', 56), '블록 바디'),
    el('p', { class: 'muted center' }, '체력이 블록으로 된 기사의 턴제 로그라이크'),
    el('div', { class: 'menu-art' }, portrait('player_sword', 220)),
    el('div', { class: 'menu-buttons' },
      el('button', { class: 'btn primary big with-icon', onclick: () => app.go('start') }, icon('start', 26), '게임 시작'),
      el('button', { class: 'btn big with-icon', onclick: () => app.go('tutorial', { step: 0 }) }, icon('tutorial', 26), '튜토리얼'),
      el('button', { class: 'btn big with-icon', onclick: () => app.go('settings') }, icon('settings', 26), '설정')),
    el('div', { class: 'muted version' }, `버전 ${CONFIG.version}`),
  ));
}
