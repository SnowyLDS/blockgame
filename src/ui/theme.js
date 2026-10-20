// 그림 UI 테마: assets/ui 의 이미지가 모두 있으면 body.themed 를 켜서 양피지·나무 UI 로 바꿈
import { CONFIG } from '../config/gameConfig.js';
import { loadImage } from './sprites.js';

let available = null; // null = 아직 확인 전

export function themeEnabled() {
  try { return localStorage.getItem('bb-theme') !== '0'; } catch { return true; }
}

export function setThemeEnabled(v) {
  try { localStorage.setItem('bb-theme', v ? '1' : '0'); } catch { /* 무시 */ }
  return applyTheme();
}

// 반환: { available: 이미지가 다 있는지, missing: 없는 파일 목록, on: 적용 여부 }
export async function applyTheme() {
  const files = CONFIG.uiTheme.files;
  const results = await Promise.all(Object.entries(files).map(async ([k, path]) => [k, path, await loadImage(path)]));
  const missing = results.filter(r => !r[2]).map(r => r[1]);
  available = missing.length === 0;
  const on = available && themeEnabled();
  const st = document.documentElement.style;
  for (const [k, path] of Object.entries(files)) st.setProperty(`--ui-${k}`, `url("${path}")`);
  document.body.classList.toggle('themed', on);
  return { available, missing, on };
}
