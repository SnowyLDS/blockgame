// 화면 전환만 담당. 게임 규칙은 src/core, 그리기는 src/ui
import { startScreen } from './ui/screens/startScreen.js';
import { mapScreen } from './ui/screens/mapScreen.js';
import { combatScreen } from './ui/screens/combatScreen.js';
import { rewardScreen } from './ui/screens/rewardScreen.js';
import { shopScreen } from './ui/screens/shopScreen.js';
import { innScreen } from './ui/screens/innScreen.js';
import { trainerScreen } from './ui/screens/trainerScreen.js';
import { formationScreen } from './ui/screens/formationScreen.js';
import { endScreen } from './ui/screens/endScreen.js';
import { menuScreen } from './ui/screens/menuScreen.js';
import { settingsScreen } from './ui/screens/settingsScreen.js';
import { tutorialScreen } from './ui/screens/tutorialScreen.js';
import { el } from './ui/dom.js';
import { isMuted, setMuted, sfx } from './ui/sound.js';
import { icon } from './ui/sprites.js';
import { applyTheme } from './ui/theme.js';
import { closeInventory, inventoryOpen, toggleInventory } from './ui/inventory.js';

const screens = {
  menu: menuScreen,
  settings: settingsScreen,
  tutorial: tutorialScreen,
  start: startScreen,
  map: mapScreen,
  combat: combatScreen,
  reward: rewardScreen,
  shop: shopScreen,
  inn: innScreen,
  trainer: trainerScreen,
  formation: formationScreen,
  end: endScreen,
};

const root = document.getElementById('app');

const app = {
  run: null,
  cleanup: null,
  inventory: null, // 인벤토리를 열 수 있는 화면이 { back, onChange } 를 넣음
  go(name, params = {}) {
    closeInventory(null);
    this.inventory = null;
    this.cleanup?.();
    this.cleanup = null;
    root.replaceChildren();
    window.scrollTo(0, 0);
    this.cleanup = screens[name](this, root, params) || null;
  },
};

// 버튼·카드 클릭음
document.addEventListener('click', e => {
  const t = e.target.closest('button, .card, .tray-item');
  if (t && !t.disabled && !t.classList.contains('mute-btn')) sfx.click();
}, true);

// 소리 켜기/끄기
const muteBtn = el('button', { class: 'mute-btn', title: '소리 켜기/끄기' });
const syncMute = () => { muteBtn.replaceChildren(icon(isMuted() ? 'sound_off' : 'sound_on', 24)); };
muteBtn.addEventListener('click', () => { setMuted(!isMuted()); syncMute(); sfx.click(); });
syncMute();
window.addEventListener('bb-sound-change', syncMute);
document.body.append(muteBtn);

// 인벤토리: I / Tab 으로 열고 닫기, Esc 로 닫기
window.addEventListener('keydown', e => {
  if (e.target.matches?.('input, select, textarea')) return;
  const isToggle = e.key === 'i' || e.key === 'I' || e.key === 'ㅑ' || e.key === 'Tab';
  if (isToggle && app.inventory && app.run) { e.preventDefault(); toggleInventory(app); }
  else if (e.key === 'Escape' && inventoryOpen()) { e.preventDefault(); closeInventory(app); }
}, true);

window.app = app; // 디버깅용 (콘솔에서 app.run 확인)
applyTheme();
app.go('menu');
