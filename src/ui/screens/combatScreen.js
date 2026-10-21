import { CONFIG } from '../../config/gameConfig.js';
import { canvasPoint, el, setChildren, toast, wait } from '../dom.js';
import { countCells } from '../../core/body.js';
import { Combat } from '../../core/combat.js';
import { createEnemy } from '../../core/enemy.js';
import { computeDodge, dodgeFrameOffsets } from '../../core/dodge.js';
import { finishBattle } from '../../core/run.js';
import { activeFamily } from '../../core/stats.js';
import { ENEMY_SHAPE, PLAYER_SHAPE, drawBody, drawCell, drawGrid, drawMarks, drawShape } from '../draw.js';
import { sfx } from '../sound.js';
import { icon, playerSpriteKey, portrait } from '../sprites.js';
import { screenHeader } from '../widgets.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ATTACK_SFX = { fist: 'punch', sword: 'slash', mace: 'smash', bow: 'arrow' };

// tutorial: 튜토리얼 단계 정의 (tutorialScreen 참고). 있으면 정해진 몸·적으로 싸우고, 결과를 tutorial.check 로 판정
export function combatScreen(app, root, { kind, tutorial: tut = null }) {
  const run = tut?.run ?? app.run;
  const enemy = tut?.enemy ?? createEnemy(kind, run.stage);
  const combat = new Combat(run, enemy);
  tut?.setup?.(combat);

  // 내 판과 상대 판은 따로 그림. 칸 수가 달라도 판 전체 크기는 같게 맞춤
  const PW = combat.player.w, PH = combat.player.h, EW = enemy.body.w, EH = enemy.body.h;
  const BOARD_PX = 351, pad = 12;
  const pcs = Math.floor(BOARD_PX / Math.max(PW, PH)), ecs = Math.floor(BOARD_PX / Math.max(EW, EH));
  const makeBoard = (cs, w, h, cls) => {
    const c = el('canvas', { width: BOARD_PX + pad * 2, height: BOARD_PX + pad * 2, class: `battle-canvas ${cls}` });
    return { canvas: c, ctx: c.getContext('2d'), cs, o: { x: pad + Math.round((BOARD_PX - w * cs) / 2), y: pad + Math.round((BOARD_PX - h * cs) / 2) } };
  };
  const P = makeBoard(pcs, PW, PH, 'me'), E = makeBoard(ecs, EW, EH, 'foe');
  const pO = P.o, eO = E.o;

  const phaseBox = el('div', { class: 'phase' });
  const controls = el('div', { class: 'controls' });
  const infoBox = el('div', { class: 'info' });
  const logBox = el('div', { class: 'log' });

  // 캐릭터 초상화 카드
  const pCount = el('div', { class: 'fighter-sub' });
  const eCount = el('div', { class: 'fighter-sub' });
  const pCard = el('div', { class: 'fighter me' },
    portrait(playerSpriteKey(activeFamily(run)), 150), el('div', { class: 'fighter-name' }, '기사 (나)'), pCount);
  const eCard = el('div', { class: 'fighter foe' },
    portrait(enemy.sprite, 150), el('div', { class: 'fighter-name' }, enemy.name), eCount);

  const ui = { rot: 0, lift: null, mouse: null, skill: combat.skills[0], busy: false, locked: false, flashes: [], view: null };
  let alive = true;
  let raf = 0;

  // ── 튜토리얼 ─────────────────────────
  const tutBox = el('div', { class: 'panel tutorial-box' });
  function tutShow(state, msg) {
    if (!tut) return;
    const head = el('div', { class: 'tut-head' },
      el('span', { class: 'tut-step' }, `튜토리얼 ${tut.index + 1} / ${tut.total}`), el('b', {}, tut.title));
    const buttons = el('div', { class: 'row-buttons' },
      el('button', { class: 'btn small', onclick: () => app.go('menu') }, '튜토리얼 나가기'),
      el('button', { class: 'btn small', onclick: () => app.go('tutorial', { step: tut.index }) }, '↺ 처음부터 다시'),
      state === 'done' && el('button', { class: 'btn primary', onclick: () => app.go('tutorial', { step: tut.index + 1 }) }, '다음 ▶'));
    setChildren(tutBox, head,
      el('div', { class: 'tut-text' }, tut.text),
      msg && el('div', { class: `tut-msg ${state}` }, msg),
      buttons);
    tutBox.className = `panel tutorial-box ${state ?? ''}`;
  }
  // 반환 true = 튜토리얼이 결과를 처리함 (성공/실패로 입력 잠금)
  function tutEvent(evt, data = {}) {
    if (!tut) return false;
    const r = tut.check?.(evt, data, combat);
    if (!r) return false;
    if (r.done) { ui.locked = true; sfx.win(); tutShow('done', r.msg); return true; }
    if (r.fail) { ui.locked = true; sfx.error(); tutShow('fail', r.msg); return true; }
    if (r.hint) tutShow('hint', r.hint);
    return false;
  }

  function updateCounts(body = combat.player) {
    setChildren(pCount, icon('cells', 16), `${countCells(body)} / ${body.w * body.h}칸`);
    setChildren(eCount, icon('cells', 16), `${countCells(enemy.body)}칸`);
  }

  function anim(card, cls) {
    card.classList.remove(cls);
    void card.offsetWidth; // 애니메이션 재시작
    card.classList.add(cls);
  }

  // ── 좌표 ─────────────────────────────
  // ui.mouse = { board: 'p' | 'e', mx, my } (각 판 캔버스 기준 픽셀)
  function playerCell() {
    if (ui.mouse?.board !== 'p') return null;
    const fx = (ui.mouse.mx - pO.x) / pcs, fy = (ui.mouse.my - pO.y) / pcs;
    if (fx < -1 || fy < -1 || fx > PW + 1 || fy > PH + 1) return null;
    return [Math.floor(fx), Math.floor(fy)];
  }
  function enemyPoint() {
    if (ui.mouse?.board !== 'e') return null;
    const fx = (ui.mouse.mx - eO.x) / ecs, fy = (ui.mouse.my - eO.y) / ecs;
    if (fx < -0.5 || fy < -0.5 || fx > EW + 0.5 || fy > EH + 0.5) return null;
    return [fx, fy];
  }
  const frameOffsets = () => dodgeFrameOffsets(combat.dodgeKey, ui.rot);
  function frameAnchor(cell, offs) {
    const mx = Math.max(...offs.map(o => o[0])), my = Math.max(...offs.map(o => o[1]));
    return [cell[0] - Math.floor(mx / 2), cell[1] - Math.floor(my / 2)];
  }

  // ── 화면용 계산 (마우스·상태가 바뀔 때마다) ──
  function updateView() {
    const v = { pBody: combat.player, forecast: null, frame: null, dodge: null, aim: null };
    if (combat.phase === 'dodge' && combat.dodgeKey && !ui.busy) {
      const offs = frameOffsets();
      if (ui.lift) {
        const c = playerCell() ?? ui.lift.start;
        const max = CONFIG.dodge.maxShift ?? Infinity;
        const sx = clamp(c[0] - ui.lift.start[0], -max, max), sy = clamp(c[1] - ui.lift.start[1], -max, max);
        const pre = combat.previewDodge(offs, ui.lift.anchor[0], ui.lift.anchor[1], sx, sy, ui.lift.rot);
        v.dodge = { ...pre.dodge, sx, sy, anchor: ui.lift.anchor, offs, rot: ui.lift.rot };
        if (pre.dodge.valid) { v.pBody = pre.dodge.body; v.forecast = pre.forecast; }
      } else {
        const c = playerCell();
        if (c) {
          const a = frameAnchor(c, offs);
          v.frame = { anchor: a, offs, info: computeDodge(combat.player, offs, a[0], a[1], 0, 0, combat.isDodgeLocked) };
        }
      }
    }
    if (!v.forecast) v.forecast = combat.forecastOn(v.pBody);
    if (combat.phase === 'attack' && !ui.busy && ui.skill) {
      const p = enemyPoint();
      if (p) {
        const atk = combat.buildPlayerAttack(ui.skill, p[0], p[1]);
        v.aim = { atk, sim: combat.previewAttack(atk) };
      }
    }
    ui.view = v;
    updateInfo();
    updateCounts(v.pBody);
  }

  function summary(sim) {
    const dmg = sim.hits.filter(h => !h.destroyed).length;
    return `피해 ${dmg}칸 · 파괴 ${sim.destroyed.length}칸`;
  }

  function updateInfo() {
    const v = ui.view;
    const lines = [];
    if (combat.forecast.length) lines.push(el('div', { class: 'enemy-line' }, `🔴 적 공격 예고 (${combat.forecast.length}회): ${summary(v.forecast)}`));
    if (v.dodge) {
      lines.push(el('div', { class: v.dodge.valid ? 'ok-line' : 'bad-line' },
        v.dodge.valid
          ? `🔷 회피 미리보기: ${v.dodge.movable.length}칸 이동${v.dodge.locked.length ? ` (🔒 ${v.dodge.locked.length}칸은 제자리)` : ''}${v.dodge.crushed.length ? ` · 겹쳐서 ${v.dodge.crushed.length}칸 사라짐!` : ''}`
          : `⛔ ${v.dodge.reason}`));
    }
    if (combat.phase === 'dodge' && combat.dodgeLockedCells().length) {
      lines.push(el('div', { class: 'muted' }, `🔒 직전 턴에 회피로 옮긴 칸 ${combat.dodgeLockedCells().length}개는 이번 턴에 옮길 수 없어요 (틀에 넣어도 그 칸만 빼고 이동)`));
    }
    if (v.aim) lines.push(el('div', { class: 'aim-line' }, `🔵 내 공격 조준: ${summary(v.aim.sim)}`));
    setChildren(infoBox, lines);
  }

  // ── 조작 패널 ─────────────────────────
  function refreshControls() {
    const ph = combat.phase;
    const dodgeName = combat.dodgeKey ? CONFIG.dodgeSkills[combat.dodgeKey].name : '없음';
    if (ui.busy) {
      phaseBox.textContent = `턴 ${combat.turn} · ⏳ 진행 중...`;
      setChildren(controls);
      return;
    }
    if (ph === 'attack') {
      const volley = combat.shotsLeft; // 여러 발 기술을 쏘는 중이면 남은 발 수
      phaseBox.innerHTML = volley
        ? `턴 ${combat.turn} · <b>① 내 공격</b> — 남은 화살 <b>${volley}발</b>: 다음 위치를 조준해 클릭`
        : `턴 ${combat.turn} · <b>① 내 공격</b> — 기술을 고르고 적 몸 위에서 위치를 맞춘 뒤 클릭`;
      setChildren(controls, combat.skills.map((k, i) => {
        const s = CONFIG.attackSkills[k];
        return el('button', {
          class: `btn skill ${ui.skill === k ? 'on' : ''}`, disabled: !!volley && ui.skill !== k,
          onclick: () => { if (combat.shotsLeft) return; ui.skill = k; refreshControls(); updateView(); },
        }, `${i + 1}. ${s.name}${s.shots > 1 ? ` (${s.shots}발)` : ''}`);
      }));
    } else if (ph === 'dodge') {
      phaseBox.innerHTML = `턴 ${combat.turn} · <b>② 회피</b> — 빨간 예고를 보고 [${dodgeName}] 틀을 몸 위에 놓고 클릭해 들어 올린 뒤, 옮길 곳에서 클릭 (휠: 든 블록 90° 회전)${CONFIG.dodge.maxShift != null ? ` (최대 ${CONFIG.dodge.maxShift}칸)` : ''}`;
      setChildren(controls,
        el('button', { class: 'btn', onclick: rotateFrame }, '↻ 틀 회전 (R·휠)'),
        ui.lift && el('button', { class: 'btn', onclick: cancelLift }, '들기 취소 (Esc)'),
        el('button', { class: 'btn warn', onclick: skipDodge }, '회피 안 함 (Space)'));
    } else {
      phaseBox.textContent = `턴 ${combat.turn}`;
      setChildren(controls);
    }
  }

  function addLog(msg, cls = '') {
    logBox.prepend(el('div', { class: cls }, msg));
    while (logBox.children.length > 40) logBox.lastChild.remove();
  }

  function flash(board, sim) {
    const cells = [
      ...sim.hits.filter(h => !h.destroyed).map(h => ({ x: h.x, y: h.y, kind: 'hit' })),
      ...sim.destroyed.map(d => ({ x: d.x, y: d.y, kind: 'destroy', cell: d.cell })),
      ...sim.collapsed.map(d => ({ x: d.x, y: d.y, kind: 'collapse', cell: d.cell })),
    ];
    ui.flashes.push({ board, cells, t0: performance.now(), dur: 750 });
  }

  function impactSounds(sim) {
    if (sim.hits.length) sfx.hit(sim.hits.length);
    if (sim.collapsed.length) setTimeout(() => sfx.collapse(), 150);
  }

  // ── 행동 ─────────────────────────────
  function rotateFrame(dir = 1) { ui.rot = (ui.rot + dir + 4) % 4; sfx.rotate(); updateView(); }
  // 휠: 들어 올린 블록이 있으면 그 블록을, 없으면 틀을 90°씩 돌림 (공격 모양은 안 돌아감)
  function onWheel(e) {
    if (combat.phase !== 'dodge' || ui.busy || ui.locked) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    if (ui.lift) { ui.lift.rot = (ui.lift.rot + dir + 4) % 4; sfx.rotate(); updateView(); } else rotateFrame(dir);
  }
  function cancelLift() { ui.lift = null; refreshControls(); updateView(); }

  function skipDodge() {
    if (ui.busy || ui.locked || combat.phase !== 'dodge') return;
    combat.skipDodge();
    ui.lift = null;
    addLog('회피하지 않음');
    if (tutEvent('skipDodge')) return;
    enemyTurn();
  }

  function onLeft() {
    if (ui.busy || ui.locked) return;
    const v = ui.view;
    if (combat.phase === 'attack') {
      if (v.aim) playerAttack(v.aim.atk);
      return;
    }
    if (combat.phase !== 'dodge' || !combat.dodgeKey) return;
    if (!ui.lift) {
      if (v.frame && v.frame.info.movable.length) {
        ui.lift = { anchor: v.frame.anchor, start: playerCell(), rot: 0 };
        sfx.pick();
        refreshControls(); updateView();
      } else if (v.frame) { sfx.error(); toast(v.frame.info.reason || '틀 안에 옮길 칸이 없습니다'); }
      return;
    }
    if (!v.dodge?.valid) { sfx.error(); toast(v.dodge?.reason); return; }
    const before = combat.forecastOn();
    const d = combat.applyDodge(v.dodge.offs, v.dodge.anchor[0], v.dodge.anchor[1], v.dodge.sx, v.dodge.sy, v.dodge.rot);
    ui.lift = null;
    sfx.dodge();
    anim(pCard, 'dodging');
    addLog(`🔷 ${CONFIG.dodgeSkills[combat.dodgeKey].name}: ${d.movable.length}칸 이동${d.crushed.length ? `, 겹쳐서 ${d.crushed.length}칸 사라짐` : ''}`);
    if (d.crushed.length) { flash('player', { hits: [], destroyed: d.crushed, collapsed: [] }); sfx.hit(d.crushed.length); }
    if (combat.phase === 'lost') return lose();
    tutEvent('dodge', { d, before, after: combat.forecastOn() }); // 성공해도 적 공격 결과는 보여줌
    enemyTurn();
  }

  async function playerAttack(atk) {
    ui.busy = true;
    const skill = CONFIG.attackSkills[ui.skill];
    const res = combat.applyAttack(atk);
    ui.lastAtk = { atk, until: performance.now() + 700 };
    sfx[ATTACK_SFX[skill.family] ?? 'slash']();
    anim(pCard, 'lunge');
    if (res.hits.length) setTimeout(() => anim(eCard, 'hurt'), 120);
    setTimeout(() => impactSounds(res), 120);
    flash('enemy', res);
    const shots = skill.shots ?? 1;
    addLog(`▶ ${skill.name}${shots > 1 ? ` (${shots - (combat.shotsLeft ?? 0)}/${shots}발)` : ''}: ${summary(res)}`, 'me');
    refreshControls(); updateView();
    await wait(750);
    if (!alive) return;
    if (combat.phase === 'won') {
      addLog('적을 쓰러뜨렸다!', 'me');
      if (tut) {
        ui.busy = false; refreshControls();
        if (!tutEvent('won', { atk, sim: res })) { ui.locked = true; sfx.win(); tutShow('done', '적을 쓰러뜨렸습니다!'); }
        return;
      }
      sfx.win();
      await wait(700);
      return alive && win();
    }
    // 여러 발 기술: 아직 쏠 발이 남았으면 공격 단계 유지 (다음 발 조준)
    if (combat.phase === 'attack' && combat.shotsLeft) { ui.busy = false; refreshControls(); updateView(); return; }
    if (tutEvent('attack', { atk, sim: res })) { ui.busy = false; refreshControls(); return; }
    // 적이 공격하지 않는 경우 (튜토리얼 허수아비 등) 바로 다음 턴
    if (!combat.forecast.length) {
      combat.skipDodge();
      combat.enemyAct();
      ui.busy = false;
      refreshControls(); updateView();
      return;
    }
    // 적이 공격을 예고함 → 회피 단계
    sfx.warn();
    addLog(`⚠ ${enemy.name}이(가) 공격을 준비한다 (${combat.forecast.length}회)`, 'enemy');
    ui.busy = false;
    refreshControls(); updateView();
  }

  async function enemyTurn() {
    ui.busy = true;
    refreshControls(); updateView();
    await wait(350);
    if (!alive) return;
    const er = combat.enemyAct();
    sfx.enemyAttack();
    anim(eCard, 'lunge');
    if (er.hits.length) setTimeout(() => anim(pCard, 'hurt'), 120);
    setTimeout(() => impactSounds(er), 150);
    flash('player', er);
    addLog(`◀ ${enemy.name}의 공격: ${summary(er)}`, 'enemy');
    updateView();
    await wait(850);
    if (!alive) return;
    if (combat.phase === 'lost') return lose();
    ui.busy = false;
    ui.lift = null;
    tutEvent('enemy', er);
    refreshControls(); updateView();
  }

  function win() {
    finishBattle(run, combat.player);
    app.go('reward', { kind });
  }
  function lose() {
    if (tut) { ui.locked = true; ui.busy = false; sfx.lose(); tutShow('fail', '몸이 모두 무너졌어요. 다시 해 보세요.'); return; }
    alive = false;
    sfx.lose();
    setTimeout(() => app.go('end', { victory: false }), 900);
  }

  // ── 그리기 ───────────────────────────
  function clearBoard(B) {
    B.ctx.fillStyle = '#0d1018';
    B.ctx.fillRect(0, 0, B.canvas.width, B.canvas.height);
  }

  function render(now) {
    const v = ui.view;
    const cs = pcs;
    let ctx = P.ctx;

    // 내 판
    clearBoard(P);
    drawGrid(ctx, PW, PH, pO.x, pO.y, cs);
    drawBody(ctx, v.pBody, pO.x, pO.y, cs);
    if (v.dodge) {
      drawMarks(ctx, v.dodge.movable, pO.x, pO.y, cs, 'frame');
      if (v.dodge.valid) {
        drawMarks(ctx, v.dodge.targets, pO.x, pO.y, cs, 'move');
        drawMarks(ctx, v.dodge.crushed, pO.x, pO.y, cs, 'destroy'); // 겹쳐서 사라질 칸 (그 자리에 옮긴 칸이 들어감)
      } else {
        for (let i = 0; i < v.dodge.movable.length; i++) {
          const [sx, sy] = v.dodge.movable[i], [tx, ty] = v.dodge.targets[i];
          const cell = combat.player.cells[sy * PW + sx];
          if (cell && tx >= 0 && ty >= 0 && tx < PW && ty < PH) drawCell(ctx, cell, pO.x + tx * cs, pO.y + ty * cs, cs, 0.45);
        }
        drawMarks(ctx, v.dodge.targets.filter(([x, y]) => x >= 0 && y >= 0 && x < PW && y < PH), pO.x, pO.y, cs, 'invalid');
      }
    }
    // 이번 턴 회피로 옮길 수 없는 칸 (직전 턴에 옮김) — 옮겨도 제자리라 원래 위치에 표시
    if (combat.phase === 'dodge') drawMarks(ctx, combat.dodgeLockedCells(), pO.x, pO.y, cs, 'locked');
    if (combat.forecast.length) {
      const f = v.forecast;
      drawMarks(ctx, f.hits.filter(h => !h.destroyed), pO.x, pO.y, cs, 'hit');
      drawMarks(ctx, f.hits.filter(h => h.destroyed), pO.x, pO.y, cs, 'destroy');
      drawMarks(ctx, f.collapsed, pO.x, pO.y, cs, 'collapse');
      combat.forecast.forEach((atk, i) =>
        drawShape(ctx, atk.placed, pO.x, pO.y, cs, ENEMY_SHAPE, combat.forecast.length > 1 ? `${i + 1}` : ''));
    }
    if (v.frame) {
      drawMarks(ctx, v.frame.info.movable, pO.x, pO.y, cs, 'move');
      drawMarks(ctx, v.frame.info.empty, pO.x, pO.y, cs, 'frame');
    }

    // 상대 판
    ctx = E.ctx;
    clearBoard(E);
    drawGrid(ctx, EW, EH, eO.x, eO.y, ecs);
    drawBody(ctx, enemy.body, eO.x, eO.y, ecs);
    if (v.aim) {
      const s = v.aim.sim;
      drawMarks(ctx, s.hits.filter(h => !h.destroyed), eO.x, eO.y, ecs, 'hit');
      drawMarks(ctx, s.hits.filter(h => h.destroyed), eO.x, eO.y, ecs, 'destroy');
      drawMarks(ctx, s.collapsed, eO.x, eO.y, ecs, 'collapse');
      drawShape(ctx, v.aim.atk.placed, eO.x, eO.y, ecs, PLAYER_SHAPE);
    }
    if (ui.lastAtk && now < ui.lastAtk.until) drawShape(ctx, ui.lastAtk.atk.placed, eO.x, eO.y, ecs, PLAYER_SHAPE);

    // 맞은 칸 번쩍임
    ui.flashes = ui.flashes.filter(fl => now - fl.t0 < fl.dur);
    for (const fl of ui.flashes) {
      const B = fl.board === 'enemy' ? E : P;
      const a = 1 - (now - fl.t0) / fl.dur;
      for (const c of fl.cells) {
        const x = B.o.x + c.x * B.cs, y = B.o.y + c.y * B.cs;
        if (c.cell) drawCell(B.ctx, c.cell, x, y, B.cs, a * 0.8);
        B.ctx.fillStyle = c.kind === 'collapse' ? `rgba(190,110,255,${a})` : c.kind === 'destroy' ? `rgba(255,70,50,${a})` : `rgba(255,230,120,${a * 0.8})`;
        B.ctx.fillRect(x, y, B.cs, B.cs);
      }
    }
    raf = requestAnimationFrame(render);
  }

  // ── 입력 ─────────────────────────────
  for (const [B, board] of [[P, 'p'], [E, 'e']]) {
    const c = B.canvas;
    c.addEventListener('mousemove', e => { ui.mouse = { board, ...canvasPoint(c, e) }; updateView(); });
    c.addEventListener('mouseleave', () => { ui.mouse = null; updateView(); });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', onWheel, { passive: false });
    c.addEventListener('mousedown', e => {
      if (e.button === 0) onLeft();
      if (e.button === 2 && combat.phase === 'dodge' && !ui.busy && !ui.locked) {
        if (ui.lift) cancelLift(); else rotateFrame();
      }
    });
  }  const onKey = e => {
    if (ui.busy || ui.locked) return;
    if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') { if (combat.phase === 'dodge' && !ui.lift) rotateFrame(); }
    else if (e.key === 'Escape') { if (ui.lift) cancelLift(); }
    else if (e.key === ' ') { e.preventDefault(); skipDodge(); }
    else if (/^[1-3]$/.test(e.key) && combat.phase === 'attack') {
      const k = combat.skills[Number(e.key) - 1];
      if (k && !combat.shotsLeft) { ui.skill = k; sfx.click(); refreshControls(); updateView(); }
    }
  };
  window.addEventListener('keydown', onKey);

  const info = CONFIG.map.nodeInfo[kind];
  root.append(el('div', { class: 'screen combat-screen' },
    tut ? tutBox : screenHeader(app, `${info.name} — ${enemy.name}`, '', `node_${kind}`),
    phaseBox,
    el('div', { class: 'battle-row' }, pCard, P.canvas, el('div', { class: 'vs' }, 'VS'), E.canvas, eCard),
    el('div', { class: 'battle-bottom' },
      el('div', { class: 'col' }, controls, infoBox,
        el('div', { class: 'legend' },
          el('span', { class: 'lg hit' }, '피해'), el('span', { class: 'lg destroy' }, '파괴'),
          el('span', { class: 'lg move' }, '옮겨질 칸'),
          el('span', { class: 'lg frame' }, '틀 빈칸'),
          el('span', { class: 'with-icon' }, icon('lock', 14), '이번 턴 회피 불가 (직전 턴에 옮긴 칸)'),
          el('span', {}, '상대 판의 칸을 모두 부수면 승리, 내 칸이 모두 부서지면 패배'))),
      logBox)));

  addLog(`${enemy.name} 등장! (${countCells(enemy.body)}칸)`, 'enemy');
  tutShow();
  refreshControls();
  updateView();
  raf = requestAnimationFrame(render);
  return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
}
