// 설정: 효과음 볼륨 / 소리 켜기·끄기 / 그림 UI 테마
import { el, setChildren } from '../dom.js';
import { getVolume, isMuted, setMuted, setVolume, sfx } from '../sound.js';
import { icon } from '../sprites.js';
import { applyTheme, setThemeEnabled, themeEnabled } from '../theme.js';

export function settingsScreen(app, root) {
  const label = el('b', {}, `${Math.round(getVolume() * 100)}%`);
  const slider = el('input', { type: 'range', min: 0, max: 100, value: Math.round(getVolume() * 100), class: 'slider' });
  slider.addEventListener('input', () => {
    setVolume(slider.value / 100);
    label.textContent = `${slider.value}%`;
  });
  slider.addEventListener('change', () => sfx.coin());

  const mute = el('input', { type: 'checkbox', checked: !isMuted() });
  mute.addEventListener('change', () => {
    setMuted(!mute.checked);
    window.dispatchEvent(new Event('bb-sound-change'));
    sfx.click();
  });

  const theme = el('input', { type: 'checkbox', checked: themeEnabled() });
  const themeNote = el('div', { class: 'muted small-note' });
  const showTheme = st => setChildren(themeNote, st.available
    ? (st.on ? '양피지·나무 UI 적용 중' : '기본 UI 사용 중')
    : `UI 이미지가 아직 없어요 (없는 파일: ${st.missing.join(', ')})`);
  theme.addEventListener('change', async () => showTheme(await setThemeEnabled(theme.checked)));
  applyTheme().then(showTheme);

  root.append(el('div', { class: 'screen settings-screen' },
    el('h1', { class: 'title with-icon' }, icon('settings', 40), '설정'),
    el('div', { class: 'panel settings' },
      el('label', { class: 'set-row' }, el('span', { class: 'with-icon' }, icon('sound_on', 20), '효과음 켜기'), mute),
      el('div', { class: 'set-row' }, el('span', { class: 'with-icon' }, icon('sound_on', 20), '효과음 볼륨'), slider, label),
      el('div', { class: 'set-row' }, el('span', { class: 'with-icon' }, icon('dice', 20), '소리 확인'),
        el('button', { class: 'btn small', onclick: () => sfx.slash() }, '베기'),
        el('button', { class: 'btn small', onclick: () => sfx.smash() }, '내려찍기'),
        el('button', { class: 'btn small', onclick: () => sfx.collapse() }, '붕괴'),
        el('button', { class: 'btn small', onclick: () => sfx.win() }, '승리')),
      el('label', { class: 'set-row' }, el('span', { class: 'with-icon' }, icon('map', 20), '그림 UI 테마'), theme, themeNote),
      el('div', { class: 'row-buttons' }, el('button', { class: 'btn primary', onclick: () => app.go('menu') }, '◀ 메인 메뉴'))),
  ));
}
