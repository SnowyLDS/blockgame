// 전투 상태 기계 (화면과 무관)
//  한 턴: 'attack'(내 공격) → applyAttack → 적 공격 예고 → 'dodge'(회피 1회) → 'enemy' → enemyAct → 다음 턴 'attack'
//  승리 'won' / 패배 'lost'  — 코어(여러 개면 아무 코어나)에 이어진 칸이 하나도 없으면 패배
import { cloneBody, countCells } from './body.js';
import { buildAttack, simulateAttacks } from './attack.js';
import { chooseEnemyAttacks } from './enemy.js';
import { computeDodge } from './dodge.js';
import { dmgPerCell, enemyLineWidthVs, strWidthBonus, tecReachBonus, weaponExtend } from './stats.js';
import { CONFIG } from '../config/gameConfig.js';

export class Combat {
  constructor(run, enemy) {
    this.enemy = enemy;
    this.player = cloneBody(run.body);
    for (const c of this.player.cells) if (c) delete c.dodgedTurn; // 지난 전투 기록 지움
    this.dmg = dmgPerCell(run);
    this.extend = weaponExtend(run) + tecReachBonus(run); // 무기 등급 + 기술 스탯 포인트
    this.widthBonus = strWidthBonus(run);                 // 힘 스탯 포인트
    enemy.lineWidth = enemyLineWidthVs(run);              // 민첩 스탯 포인트: 나를 때리는 선이 얇아짐
    this.skills = run.equippedAttack.slice();
    this.dodgeKey = run.equippedDodge;
    this.turn = 1;
    this.phase = 'attack'; // 전투는 항상 플레이어 공격부터
    this.forecast = [];
  }

  // 예고된 적 공격을 body 에 맞았을 때 결과 (실제 적용 X)
  forecastOn(body = this.player) {
    return simulateAttacks(body, this.forecast, this.enemy.damage);
  }

  buildPlayerAttack(skillKey, x, y) {
    return buildAttack({
      shapeKey: CONFIG.attackSkills[skillKey].shape,
      x, y, rotation: 0, extend: this.extend, widthBonus: this.widthBonus, owner: 'player',
    });
  }

  previewAttack(atk) {
    return simulateAttacks(this.enemy.body, [atk], this.dmg);
  }

  // 내 공격 → 적이 살아 있으면 적 공격 예고 후 회피 단계로
  applyAttack(atk) {
    if (this.phase !== 'attack') return null;
    const sim = this.previewAttack(atk);
    this.enemy.body = sim.body;
    if (countCells(sim.body) === 0) {
      this.phase = 'won';
    } else {
      this.forecast = chooseEnemyAttacks(this.enemy, this.player, { isLocked: this.isDodgeLocked });
      this.phase = 'dodge';
    }
    return sim;
  }

  // 직전 턴에 회피로 옮긴 칸은 이번 턴에 다시 옮길 수 없음
  isDodgeLocked = cell => cell.dodgedTurn === this.turn - 1;

  dodgeLockedCells() {
    const out = [];
    this.player.cells.forEach((c, i) => { if (c && !c.core && this.isDodgeLocked(c)) out.push([i % this.player.w, Math.floor(i / this.player.w)]); });
    return out;
  }

  // rot: 들어 올린 블록 회전 (90° 단위)
  previewDodge(offs, ax, ay, sx, sy, rot = 0) {
    const dodge = computeDodge(this.player, offs, ax, ay, sx, sy, this.isDodgeLocked, rot);
    return { dodge, forecast: dodge.valid ? this.forecastOn(dodge.body) : null };
  }

  applyDodge(offs, ax, ay, sx, sy, rot = 0) {
    if (this.phase !== 'dodge') return null;
    const d = computeDodge(this.player, offs, ax, ay, sx, sy, this.isDodgeLocked, rot);
    if (!d.valid) return d;
    for (const [x, y] of d.targets) {
      const c = d.body.cells[y * d.body.w + x];
      if (c) c.dodgedTurn = this.turn; // 붕괴로 사라졌으면 무시
    }
    this.player = d.body;
    this.phase = countCells(this.player) === 0 ? 'lost' : 'enemy';
    return d;
  }

  skipDodge() {
    if (this.phase === 'dodge') this.phase = 'enemy';
  }

  enemyAct() {
    if (this.phase !== 'enemy') return null;
    const sim = this.forecastOn();
    this.player = sim.body;
    this.forecast = [];
    if (countCells(this.player) === 0) this.phase = 'lost';
    else { this.turn++; this.phase = 'attack'; }
    return sim;
  }
}
