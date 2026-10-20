// 테트리스형 조각: '#' 그리드 파싱, 회전, 몸 자동 생성
import { CONFIG } from '../config/gameConfig.js';
import { countCells, getCell, inBounds, makeCell, setCell } from './body.js';
import { pick, randInt, shuffle } from './rng.js';

export function parseGrid(rows) {
  const out = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') out.push([x, y]); }));
  return out;
}

export function normalizeOffsets(offs) {
  const mx = Math.min(...offs.map(o => o[0])), my = Math.min(...offs.map(o => o[1]));
  return offs.map(([x, y]) => [x - mx, y - my]);
}

export function rotateOffsets(offs, quarter) {
  let o = offs;
  for (let i = 0; i < ((quarter % 4) + 4) % 4; i++) o = o.map(([x, y]) => [-y, x]);
  return normalizeOffsets(o);
}

const keysOfSize = size => Object.keys(CONFIG.pieces.shapes).filter(k => parseGrid(CONFIG.pieces.shapes[k]).length === size);

// exclude: 이미 고른 모양 키 (회전만 다른 같은 모양도 같은 키)
export function randomPiece(size, exclude = []) {
  const all = CONFIG.pieces.shapes;
  let keys = keysOfSize(size).filter(k => !exclude.includes(k));
  if (!keys.length) keys = keysOfSize(size);
  if (!keys.length) keys = ['dot'];
  const key = pick(keys);
  return {
    key,
    offsets: rotateOffsets(parseGrid(all[key]), randInt(0, 3)),
    color: pick(CONFIG.pieces.palette),
  };
}

// 서로 다른 모양 n 개 (크기는 sizes 중 무작위, 남은 모양이 있는 크기만)
export function distinctPieces(n, sizes) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const used = out.map(p => p.key);
    const open = sizes.filter(s => keysOfSize(s).some(k => !used.includes(k)));
    out.push(randomPiece(pick(open.length ? open : sizes), used));
  }
  return out;
}

export function canPlace(body, offs, ax, ay) {
  return offs.every(([x, y]) => inBounds(body, ax + x, ay + y) && !getCell(body, ax + x, ay + y));
}

export function placePiece(body, offs, ax, ay, color) {
  const id = body.nextPieceId++;
  for (const [x, y] of offs) setCell(body, ax + x, ay + y, makeCell(color, id));
  return id;
}

// 판 안 아무 데나 조각을 흩뿌려 target 칸이 될 때까지 채움 (적 몸, 시작 몸).
//  조각이 더 안 들어가면 남은 빈칸을 1칸 조각으로 채움
export function scatterBody(body, target) {
  target = Math.min(target, body.w * body.h);
  for (let guard = 0; countCells(body) < target && guard < 3000; guard++) {
    const remaining = target - countCells(body);
    const sizes = CONFIG.pieces.genSizes.filter(s => s <= remaining);
    const piece = randomPiece(sizes.length ? pick(sizes) : remaining);
    const ax = randInt(0, body.w - 1), ay = randInt(0, body.h - 1);
    if (canPlace(body, piece.offsets, ax, ay)) placePiece(body, piece.offsets, ax, ay, piece.color);
  }
  const empties = [];
  body.cells.forEach((c, i) => { if (!c) empties.push([i % body.w, Math.floor(i / body.w)]); });
  for (const [x, y] of shuffle(empties)) {
    if (countCells(body) >= target) break;
    placePiece(body, [[0, 0]], x, y, pick(CONFIG.pieces.palette));
  }
}