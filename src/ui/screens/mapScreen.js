import { CONFIG } from '../../config/gameConfig.js';
import { canvasPoint, el } from '../dom.js';
import { moveTo, reachableNodes } from '../../core/run.js';
import { hud, screenHeader } from '../widgets.js';
import { sfx } from '../sound.js';
import { drawIconAt, icon } from '../sprites.js';

export function mapScreen(app, root) {
  const run = app.run;
  const floors = run.map.floors;
  const W = 760, H = 540, padX = 70, padY = 34;
  const canvas = el('canvas', { width: W, height: H, class: 'map-canvas' });
  const ctx = canvas.getContext('2d');
  const tip = el('div', { class: 'map-tip muted' }, '빛나는 노드를 클릭해 이동하세요');
  const reach = new Set(reachableNodes(run).map(([f, i]) => `${f},${i}`));
  const onPath = new Set(run.path.map(([f, i], k) => (k ? `${run.path[k - 1].join(',')}>${f},${i}` : '')));
  let hover = null;
  let raf = 0;

  const pos = (f, i) => {
    const n = floors[f][i];
    return [padX + n.x * (W - padX * 2), H - padY - f * (H - padY * 2) / (floors.length - 1)];
  };

  function nodeAt(mx, my) {
    for (let f = 0; f < floors.length; f++) {
      for (let i = 0; i < floors[f].length; i++) {
        const [x, y] = pos(f, i);
        const r = floors[f][i].type === 'boss' ? 28 : 20;
        if (Math.hypot(mx - x, my - y) <= r) return [f, i];
      }
    }
    return null;
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#10141e';
    ctx.fillRect(0, 0, W, H);
    // 층 번호
    ctx.fillStyle = '#4a5368'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
    for (let f = 0; f < floors.length; f++) ctx.fillText(`${f + 1}F`, 8, pos(f, 0)[1] + 4);
    // 연결선
    for (let f = 0; f < floors.length - 1; f++) {
      floors[f].forEach((n, i) => {
        const [x1, y1] = pos(f, i);
        for (const j of n.next) {
          const [x2, y2] = pos(f + 1, j);
          const walked = onPath.has(`${f},${i}>${f + 1},${j}`);
          const fromHere = run.pos && run.pos.floor === f && run.pos.index === i;
          ctx.strokeStyle = walked ? '#ffd54a' : fromHere ? '#8fb8ff' : '#2c3446';
          ctx.lineWidth = walked || fromHere ? 3 : 2;
          ctx.setLineDash(walked ? [] : [6, 5]);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        }
      });
    }
    ctx.setLineDash([]);
    // 노드
    floors.forEach((row, f) => row.forEach((n, i) => {
      const [x, y] = pos(f, i);
      const info = CONFIG.map.nodeInfo[n.type];
      const r = n.type === 'boss' ? 28 : 20;
      const key = `${f},${i}`;
      const canGo = reach.has(key);
      const isCur = run.pos && run.pos.floor === f && run.pos.index === i;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.visited ? '#3a4256' : canGo ? '#1f3150' : '#191e2a';
      ctx.fill();
      ctx.lineWidth = canGo ? 3 + Math.sin(t / 200) * 1.5 : 2;
      ctx.strokeStyle = isCur ? '#ffd54a' : canGo ? '#7fd3ff' : info.color;
      if (hover && hover[0] === f && hover[1] === i) ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.globalAlpha = n.visited || canGo ? 1 : 0.55;
      drawIconAt(ctx, `node_${n.type}`, x, y, r * 1.5);
      ctx.globalAlpha = 1;
    }));
    raf = requestAnimationFrame(draw);
  }

  canvas.addEventListener('mousemove', e => {
    const { mx, my } = canvasPoint(canvas, e);
    hover = nodeAt(mx, my);
    if (hover) {
      const n = floors[hover[0]][hover[1]];
      tip.textContent = `${hover[0] + 1}층 · ${CONFIG.map.nodeInfo[n.type].name}${reach.has(hover.join(',')) ? ' — 클릭해서 이동' : ''}`;
      canvas.style.cursor = reach.has(hover.join(',')) ? 'pointer' : 'default';
    } else canvas.style.cursor = 'default';
  });
  canvas.addEventListener('click', e => {
    const { mx, my } = canvasPoint(canvas, e);
    const h = nodeAt(mx, my);
    if (!h || !reach.has(h.join(','))) return;
    sfx.step();
    const node = moveTo(run, h[0], h[1]);
    const battle = ['monster', 'elite', 'boss'].includes(node.type);
    app.go(battle ? 'combat' : node.type, { kind: node.type });
  });

  const bar = hud(app);
  app.inventory = { back: 'map', onChange: () => bar.refresh() };
  root.append(el('div', { class: 'screen map-screen' },
    screenHeader(app, '지도', '', 'map'),
    bar,
    el('div', { class: 'map-wrap' }, canvas, tip,
      el('div', { class: 'legend' }, Object.entries(CONFIG.map.nodeInfo).map(([k, n]) => el('span', { class: 'with-icon' }, icon(`node_${k}`, 18), n.name))))));
  raf = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(raf);
}
