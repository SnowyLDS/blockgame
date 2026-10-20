// 이미지: 스프라이트 시트를 균등 격자로 잘라 그림. 시트가 없으면 이모지 대체 그림
//  시트 설정(CONFIG.sprites / itemSprites / icons): { sheet, cols, rows, inset, bare, cells: { key: { at:[열,행], emoji, img? } } }
//  cell.img 가 있고 그 파일이 존재하면 시트 대신 그 그림 한 장을 씀
import { CONFIG } from '../config/gameConfig.js';
import { el } from './dom.js';

const images = new Map(); // 경로 → { promise, img(로드 완료 시) }

export function loadImage(path) {
  if (!images.has(path)) {
    const entry = { img: null };
    entry.promise = new Promise(resolve => {
      const img = new Image();
      img.onload = () => { entry.img = img; resolve(img); };
      img.onerror = () => resolve(null);
      img.src = path;
    });
    images.set(path, entry);
  }
  return images.get(path).promise;
}

function drawPlaceholder(ctx, w, h, cell, bare) {
  if (!bare) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#26304a'); g.addColorStop(1, '#141a28');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.floor(h * (bare ? 0.8 : 0.5))}px sans-serif`;
  ctx.fillText(cell?.emoji ?? '❔', w / 2, h / 2 + (bare ? h * 0.04 : 0));
  ctx.textBaseline = 'alphabetic';
}

// 시트에서 칸 잘라내기 영역 (inset 만큼 가장자리 제외)
function sliceRect(img, sheetCfg, cell) {
  const { cols, rows, inset = 0 } = sheetCfg;
  const cw = img.naturalWidth / cols, ch = img.naturalHeight / rows;
  return [cell.at[0] * cw + cw * inset, cell.at[1] * ch + ch * inset, cw * (1 - inset * 2), ch * (1 - inset * 2)];
}

// (x, y, w, h) 영역에 비율 유지해 그림 (img 는 Image 또는 canvas)
function drawFrom(ctx, img, src, x, y, w, h) {
  const [sx, sy, sw, sh] = src ?? [0, 0, img.naturalWidth ?? img.width, img.naturalHeight ?? img.height];
  const s = Math.min(w / sw, h / sh);
  const dw = sw * s, dh = sh * s;
  ctx.drawImage(img, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ── 누끼(배경 제거) ──
//  칸 가장자리에서 시작해 배경색과 비슷한 픽셀을 따라 퍼지며 투명하게 만듦 (그림 안쪽의 어두운 부분은 보존)
//  배경색 = 가장자리 픽셀들의 중앙값, tol = 색 차이 허용치(RGB 차 합)
const cutouts = new Map(); // 시트#키 → canvas

function cutoutCanvas(img, rect, tol) {
  const [sx, sy, sw, sh] = rect;
  const w = Math.round(sw), h = Math.round(sh);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  // 가장자리 픽셀의 채널별 중앙값 = 배경색
  const edge = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
  const med = ch => { const v = edge.map(i => p[i * 4 + ch]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const key = [med(0), med(1), med(2)];
  const dist = i => Math.abs(p[i * 4] - key[0]) + Math.abs(p[i * 4 + 1] - key[1]) + Math.abs(p[i * 4 + 2] - key[2]);
  // 가장자리에서 퍼지기
  const bg = new Uint8Array(w * h);
  const stack = edge.filter(i => dist(i) <= tol);
  stack.forEach(i => { bg[i] = 1; });
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && !bg[j] && dist(j) <= tol) { bg[j] = 1; stack.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { p[i * 4 + 3] = 0; continue; }
    // 배경과 맞닿은 경계 픽셀은 색 차이에 따라 반투명 (계단 현상 줄이기)
    const x = i % w, y = (i / w) | 0;
    const touches = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (touches) p[i * 4 + 3] = Math.round(p[i * 4 + 3] * Math.min(1, (dist(i) - tol) / tol + 0.35));
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function getCutout(sheetCfg, key, img, cell) {
  const ck = `${sheetCfg.sheet}#${key}`;
  if (!cutouts.has(ck)) cutouts.set(ck, cutoutCanvas(img, sliceRect(img, sheetCfg, cell), sheetCfg.cutoutTolerance ?? 36));
  return cutouts.get(ck);
}

// 캔버스 하나 전체에 그림 (비동기 로드 후 다시 그림)
export function drawSprite(canvas, key, sheetCfg = CONFIG.sprites) {
  const ctx = canvas.getContext('2d');
  const cell = sheetCfg.cells[key];
  const { width: w, height: h } = canvas;
  drawPlaceholder(ctx, w, h, cell, sheetCfg.bare);
  if (!cell) return;
  const paint = (img, src) => {
    ctx.clearRect(0, 0, w, h);
    if (!sheetCfg.bare && !sheetCfg.cutout) { ctx.fillStyle = '#141a28'; ctx.fillRect(0, 0, w, h); }
    drawFrom(ctx, img, src, 0, 0, w, h);
  };
  (cell.img ? loadImage(cell.img) : Promise.resolve(null)).then(own => {
    if (own) return paint(own, null);
    return loadImage(sheetCfg.sheet).then(img => {
      if (!img) return;
      if (sheetCfg.cutout) paint(getCutout(sheetCfg, key, img, cell), null);
      else paint(img, sliceRect(img, sheetCfg, cell));
    });
  });
}

// 매 프레임 그리는 캔버스(지도 등)용: 아이콘을 작은 캔버스에 한 번 그려 두고(배경 제거 포함) 재사용
const iconCache = new Map();
export function drawIconAt(ctx, key, x, y, size, sheetCfg = CONFIG.icons) {
  if (!sheetCfg.cells[key]) return;
  const ck = `${sheetCfg.sheet}#${key}`;
  let c = iconCache.get(ck);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 128;
    drawSprite(c, key, sheetCfg);
    iconCache.set(ck, c);
  }
  ctx.drawImage(c, x - size / 2, y - size / 2, size, size);
}

export function portrait(key, size = 160, cls = '') {
  const c = el('canvas', { width: size, height: size, class: `portrait ${cls}` });
  drawSprite(c, key);
  return c;
}

export const playerSpriteKey = family => `player_${family}`;

// ── 아이콘 (이모지 대신) ──
export function icon(key, size = 20, cls = '') {
  const c = el('canvas', { width: size * 2, height: size * 2, class: `icon ${cls}`, style: `width:${size}px;height:${size}px` });
  drawSprite(c, key, CONFIG.icons);
  return c;
}

// ── 아이템 ──
export const itemSpriteKey = item => (item.kind === 'weapon' ? `${item.family}_${item.grade}` : `armor_${item.grade}`);
export const potionSpriteKey = cells => (cells <= 2 ? 'potion_s' : cells === 3 ? 'potion_m' : cells === 4 ? 'potion_l' : 'potion_xl');

export function itemIconCanvas(key, size = 64, gradeColor = null) {
  const c = el('canvas', { width: size * 2, height: size * 2, class: 'item-icon', style: `width:${size}px;height:${size}px;${gradeColor ? `--grade:${gradeColor}` : ''}` });
  drawSprite(c, key, CONFIG.itemSprites);
  return c;
}

export const itemIcon = (item, size = 64) => itemIconCanvas(itemSpriteKey(item), size, CONFIG.grades[item.grade].color);
export const potionIcon = (cells, size = 64) => itemIconCanvas(potionSpriteKey(cells), size);
