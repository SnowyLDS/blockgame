// 메인 메뉴: 전체 화면 메인 아트 + 왼쪽 위 제목 + 왼쪽 아래 버튼
import { CONFIG } from '../../config/gameConfig.js';
import { el } from '../dom.js';
import { icon, loadImage } from '../sprites.js';

export function menuScreen(app, root) {
  app.run = null;
  document.title = CONFIG.title.ko;

  const hero = el('div', { class: 'menu-hero' });
  // 메인 아트가 있으면 배경으로 (없으면 CSS 기본 배경)
  loadImage(CONFIG.menuArt).then(img => {
    if (img) { hero.style.setProperty('--menu-art', `url("${CONFIG.menuArt}")`); hero.classList.add('has-art'); }
  });

  const menuBtn = (iconKey, label, onclick, primary = false) =>
    el('button', { class: `menu-btn ${primary ? 'primary' : ''}`, onclick }, icon(iconKey, 30), el('span', {}, label));

  hero.append(
    el('div', { class: 'menu-shade' }),
    el('div', { class: 'menu-content' },
      el('div', { class: 'menu-title' },
        el('div', { class: 'menu-title-en' }, CONFIG.title.en),
        el('h1', { class: 'menu-title-ko' }, CONFIG.title.ko)),
      el('nav', { class: 'menu-nav' },
        menuBtn('start', '게임 시작', () => app.go('start'), true),
        menuBtn('tutorial', '튜토리얼', () => app.go('tutorial', { step: 0 })),
        menuBtn('settings', '설정', () => app.go('settings')))),
    el('div', { class: 'menu-version' }, `v ${CONFIG.version}`),
  );
  root.append(hero);
}
