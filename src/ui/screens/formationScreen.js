// 재정비: 조각 드래그 배치 + 강화 지정
//  mode 'full'   : 여관/출발 전 — 모든 조각 이동, 강화 재지정, 조각 보관
//  mode 'attach' : 그 외 — 보관 중인 회복 조각만 새로 붙일 수 있음
import { canvasPoint, el, toast, setChildren } from '../dom.js';
import {
  assignedEnhance, cellHpMax, cloneBody, componentOf, countCells, disconnectedCells,
  getCell, inBounds, makeCell, maxTier, regroupPieces, removeDisconnected, setCell,
} from '../../core/body.js';
import { normalizeOffsets } from '../../core/pieces.js';
import { maxCells, totalEnhance } from '../../core/stats.js';
import { drawBody, drawCell, drawGrid, drawMarks, pieceThumb } from '../draw.js';
import { sfx } from '../sound.js';
import { icon } from '../sprites.js';
import { screenHeader } from '../widgets.js';

export function formationScreen(app, root, { mode = 'full', back = 'map', backParams = {}, title, intro } = {}) {
  const run = app.run;
  const body = cloneBody(run.body);
  if (mode === 'full') regroupPieces(body);
  const tray = run.pending.map(p => ({ offsets: p.offsets.map(o => o.slice()), color: p.color }));
  const sessionPieces = new Set();

  const cs = Math.floor(420 / Math.max(body.w, body.h)), pad = 14; // 판 크기와 상관없이 비슷한 크기로
  const canvas = el('canvas', { width: body.w * cs + pad * 2, height: body.h * cs + pad * 2, class: 'formation-canvas' });
  const ctx = canvas.getContext('2d');
  const infoBox = el('div', { class: 'panel-row big' });
  const trayBox = el('div', { class: 'tray' });
  const toolBox = el('div', { class: 'chips' });
  const heldBox = el('div', { class: 'chips' });
  const st = { tool: 'move', held: null, mouse: null };
  let raf = 0;

  const unassigned = () => totalEnhance(run) - assignedEnhance(body);

  function mouseCell() {
    if (!st.mouse) return null;
    const x = Math.floor((st.mouse.mx - pad) / cs), y = Math.floor((st.mouse.my - pad) / cs);
    return [x, y];
  }

  // ── 들기 / 놓기 ───────────────────────
  function pickFromBody(x, y) {
    const c = getCell(body, x, y);
    if (!c) return;
    if (mode === 'attach' && (c.core || !sessionPieces.has(c.piece))) {
      sfx.error();
      toast(c.core ? '코어 위치 수정은 여관에서만 가능합니다' : '기존 조각의 배치 수정은 여관에서만 가능합니다');
      return;
    }
    if (c.main) { sfx.error(); toast('핵심 코어는 중앙에 고정입니다 (보조 코어만 이동 가능)'); return; }
    sfx.pick();
    const comp = c.core ? [[x, y]] : componentOf(body, x, y);
    st.held = {
      source: 'body',
      cells: comp.map(([cx, cy]) => ({ dx: cx - x, dy: cy - y, cell: getCell(body, cx, cy) })),
      origin: comp.map(([cx, cy]) => ({ x: cx, y: cy, cell: getCell(body, cx, cy) })),
    };
    comp.forEach(([cx, cy]) => setCell(body, cx, cy, null));
    refresh();
  }

  function pickFromTray(i) {
    cancelHeld();
    const p = tray[i];
    const mx = p.offsets.reduce((s, o) => s + o[0], 0) / p.offsets.length;
    const my = p.offsets.reduce((s, o) => s + o[1], 0) / p.offsets.length;
    const pivot = p.offsets.reduce((b, o) => (Math.hypot(o[0] - mx, o[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? o : b));
    st.held = {
      source: 'tray', trayIndex: i,
      cells: p.offsets.map(([ox, oy]) => ({ dx: ox - pivot[0], dy: oy - pivot[1], cell: makeCell(p.color, 0) })),
    };
    sfx.pick();
    refresh();
  }

  function rotateHeld(times = 1) {
    if (!st.held) return;
    for (let k = 0; k < times; k++) for (const c of st.held.cells) [c.dx, c.dy] = [-c.dy, c.dx];
    sfx.rotate();
  }

  const heldIsCore = () => st.held?.cells.some(c => c.cell.core);

  function heldTargets() {
    const m = mouseCell();
    return m && st.held.cells.map(c => [m[0] + c.dx, m[1] + c.dy]);
  }

  // 회복 조각(보관함)은 다른 칸 위에도 놓을 수 있음 — 겹친 칸은 새 조각으로 바뀜.
  // 몸에 있던 조각을 옮길 때는 겹치면 안 됨
  const overlapped = targets => targets.filter(([x, y]) => getCell(body, x, y));

  function dropProblem(targets) {
    if (!targets) return '판 위에 놓으세요';
    if (targets.some(([x, y]) => !inBounds(body, x, y))) return '판 밖입니다';
    const over = overlapped(targets).length;
    if (over && st.held.source !== 'tray') return '다른 칸과 겹칩니다';
    if (st.held.source === 'tray' && countCells(body) + targets.length - over > maxCells(run)) return `최대 칸 수(${maxCells(run)})를 넘습니다`;
    return null;
  }

  function drop() {
    const targets = heldTargets();
    const problem = dropProblem(targets);
    if (problem) { sfx.error(); return toast(problem); }
    const over = st.held.source === 'tray' ? overlapped(targets).length : 0;
    if (over) toast(`겹친 ${over}칸은 새 조각으로 바뀌었어요`);
    sfx.place();
    const id = st.held.source === 'body' ? st.held.cells[0].cell.piece : body.nextPieceId++;
    st.held.cells.forEach((c, i) => setCell(body, targets[i][0], targets[i][1], { ...c.cell, piece: id }));
    if (st.held.source === 'tray') { tray.splice(st.held.trayIndex, 1); sessionPieces.add(id); }
    st.held = null;
    refresh();
  }

  function cancelHeld() {
    if (!st.held) return;
    if (st.held.source === 'body') st.held.origin.forEach(o => setCell(body, o.x, o.y, o.cell));
    st.held = null;
    refresh();
  }

  function stashHeld() {
    if (!st.held || st.held.source !== 'body' || heldIsCore()) return;
    tray.push({ offsets: normalizeOffsets(st.held.cells.map(c => [c.dx, c.dy])), color: st.held.cells[0].cell.color });
    st.held = null;
    toast('보관함으로 옮겼습니다 (강화는 반환됨)');
    refresh();
  }

  function enhanceAt(x, y, delta) {
    const c = getCell(body, x, y);
    if (!c || c.core) return;
    if (delta > 0) {
      if (c.tier >= maxTier()) { sfx.error(); return toast('이미 최대 강화입니다'); }
      if (unassigned() <= 0) { sfx.error(); return toast('남은 강화 횟수가 없습니다'); }
      c.tier++;
      sfx.enhance();
    } else {
      if (c.tier <= 0) return;
      c.tier--;
      sfx.click();
    }
    c.hp = cellHpMax(c.tier);
    refresh();
  }

  // ── 완료 / 취소 ──────────────────────
  function finish() {
    cancelHeld();
    const loose = disconnectedCells(body);
    if (loose.length) {
      if (mode === 'attach') return toast('모든 칸이 코어와 이어져야 합니다');
      if (!confirm(`코어와 연결되지 않은 칸 ${loose.length}개는 붕괴합니다. 계속할까요?`)) return;
      removeDisconnected(body);
    }
    run.body = body;
    run.pending = tray;
    app.go(back, backParams);
  }

  // ── UI ───────────────────────────────
  function refresh() {
    const enhLeft = unassigned();
    setChildren(infoBox, 
      el('span', { class: 'with-icon' }, icon('cells'), `칸 ${countCells(body)} / ${maxCells(run)}`),
      el('span', { class: `with-icon ${enhLeft < 0 ? 'bad-line' : ''}` }, icon('enhance'), `강화 ${assignedEnhance(body)} / ${totalEnhance(run)} (남음 ${enhLeft})`),
      el('span', { class: 'with-icon' }, icon('pending'), `보관 ${tray.length}`));
    setChildren(trayBox, ...(tray.length ? tray.map((p, i) => {
      const item = el('div', { class: `tray-item ${st.held?.source === 'tray' && st.held.trayIndex === i ? 'on' : ''}`, onclick: () => pickFromTray(i) },
        pieceThumb(p.offsets, p.color, 16), el('div', { class: 'muted' }, `${p.offsets.length}칸`));
      return item;
    }) : [el('div', { class: 'muted' }, '보관 중인 조각 없음')]));
    if (mode === 'full') {
      setChildren(toolBox, 
        el('button', { class: `chip ${st.tool === 'move' ? 'on' : ''}`, onclick: () => { cancelHeld(); st.tool = 'move'; refresh(); } }, '✋ 조각 이동'),
        el('button', { class: `chip ${st.tool === 'enhance' ? 'on' : ''}`, onclick: () => { cancelHeld(); st.tool = 'enhance'; refresh(); } }, '✨ 강화 지정'));
    }
    setChildren(heldBox, ...(st.held ? [
      el('button', { class: 'btn small', onclick: () => { rotateHeld(); } }, '↻ 회전 (R·휠)'),
      el('button', { class: 'btn small', onclick: cancelHeld }, '취소 (Esc)'),
      mode === 'full' && st.held.source === 'body' && !heldIsCore() && el('button', { class: 'btn small warn', onclick: stashHeld }, '보관함으로'),
    ] : []));
  }

  function render() {
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, body.w, body.h, pad, pad, cs);
    drawBody(ctx, body, pad, pad, cs);
    drawMarks(ctx, disconnectedCells(body), pad, pad, cs, 'collapse');
    const m = mouseCell();
    if (st.held) {
      const targets = heldTargets();
      if (targets) {
        const okDrop = !dropProblem(targets);
        st.held.cells.forEach((c, i) => {
          const [x, y] = targets[i];
          drawCell(ctx, c.cell, pad + x * cs, pad + y * cs, cs, 0.7);
        });
        drawMarks(ctx, targets, pad, pad, cs, okDrop ? 'ok' : 'invalid');
        if (okDrop) drawMarks(ctx, overlapped(targets), pad, pad, cs, 'hit'); // 주황 = 새 조각으로 바뀔 기존 칸
      }
    } else if (m && getCell(body, m[0], m[1])) {
      const isCore = getCell(body, m[0], m[1]).core;
      if (st.tool === 'move') drawMarks(ctx, isCore ? [m] : componentOf(body, m[0], m[1]), pad, pad, cs, 'hover');
      else drawMarks(ctx, [m], pad, pad, cs, 'hover');
    }
    raf = requestAnimationFrame(render);
  }

  canvas.addEventListener('mousemove', e => { st.mouse = canvasPoint(canvas, e); });
  canvas.addEventListener('mouseleave', () => { st.mouse = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  // 휠: 들고 있는 조각을 90°씩 돌림
  canvas.addEventListener('wheel', e => {
    if (!st.held) return;
    e.preventDefault();
    rotateHeld(e.deltaY > 0 ? 1 : 3);
  }, { passive: false });
  canvas.addEventListener('mousedown', e => {
    const m = mouseCell();
    if (!m) return;
    if (st.held) {
      if (e.button === 0) drop();
      else if (e.button === 2) rotateHeld();
      return;
    }
    if (st.tool === 'enhance' && mode === 'full') enhanceAt(m[0], m[1], e.button === 2 ? -1 : 1);
    else if (e.button === 0) pickFromBody(m[0], m[1]);
  });
  const onKey = e => {
    if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') rotateHeld();
    if (e.key === 'Escape') cancelHeld();
  };
  window.addEventListener('keydown', onKey);

  const help = mode === 'full'
    ? ['✋ 조각 이동: 조각을 클릭해 들고, 원하는 곳에서 클릭해 놓기 (휠·R·우클릭 회전)',
      '판(5×5) 칸 수가 최대 체력이에요. 연결은 상관없으니 원하는 곳에 흩어 배치하세요',
      '✨ 강화 지정: 좌클릭 = 강화 +1 (하트 → 방패), 우클릭 = 강화 -1',
      '오른쪽 보관함의 회복 조각을 클릭하면 들 수 있어요 — 다른 칸 위에 놓으면 그 칸은 새 조각으로 바뀌어요',
      '회피하려면 빈칸이 필요해요 — 빈칸을 남겨 두면 회피로 옮길 자리가 생깁니다']
    : ['보관함의 회복 조각을 클릭해 들고, 판 위 아무 곳에나 놓으세요 — 다른 칸 위에 놓으면 그 칸은 새 조각으로 바뀌어요 (휠·R·우클릭 회전)',
      '기존 조각 이동과 강화 재지정은 여관에서만 가능합니다',
      '붙이지 않은 조각은 보관함에 그대로 남습니다'];

  root.append(el('div', { class: 'screen formation-screen' },
    screenHeader(app, title ?? (mode === 'full' ? '재정비' : '회복 조각 붙이기'), intro ?? '', mode === 'full' ? 'node_inn' : 'pending'),
    el('div', { class: 'two-col' },
      el('div', { class: 'battle-wrap' }, canvas),
      el('div', { class: 'panel side' },
        infoBox, toolBox, heldBox,
        el('h4', {}, '보관함'), trayBox,
        el('ul', { class: 'help-list muted' }, help.map(h => el('li', {}, h))),
        el('div', { class: 'legend' },
          el('span', { class: 'lg tier1' }, '❤ 1차 강화 (체력 2)'),
          el('span', { class: 'lg tier2' }, '🛡 2차 강화 (체력 3)')),
        el('div', { class: 'row-buttons' },
          el('button', { class: 'btn', onclick: () => app.go(back, backParams) }, '변경 취소'),
          el('button', { class: 'btn primary', onclick: finish }, '완료 ✔'))))));

  refresh();
  raf = requestAnimationFrame(render);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
}
