// 효과음: WebAudio 로 즉석 합성 (음원 파일 필요 없음)
import { CONFIG } from '../config/gameConfig.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let volume = CONFIG.sound.volume;
try {
  muted = localStorage.getItem('bb-muted') === '1';
  const v = localStorage.getItem('bb-volume');
  if (v != null) volume = Number(v);
} catch { /* 저장 불가 환경 */ }

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(g, t, vol, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ freq = 440, to = null, dur = 0.1, type = 'sine', vol = 0.2, delay = 0 }) {
  const c = ac();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, vol, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.2, freq = 1000, to = null, q = 1, type = 'bandpass', delay = 0 }) {
  const c = ac();
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  env(g, t, vol, dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
}

const play = fn => (...args) => {
  if (muted) return;
  try { fn(...args); } catch { /* 오디오 미지원 */ }
};

export const sfx = {
  click: play(() => tone({ freq: 660, dur: 0.05, type: 'square', vol: 0.05 })),
  dice: play(() => { noise({ dur: 0.04, freq: 2800, q: 4, vol: 0.25 }); tone({ freq: 900 + Math.random() * 600, dur: 0.03, type: 'triangle', vol: 0.05 }); }),
  diceLand: play(() => { noise({ dur: 0.08, freq: 1500, q: 2, vol: 0.3 }); tone({ freq: 880, dur: 0.15, type: 'triangle', vol: 0.12, delay: 0.05 }); }),
  slash: play(() => { noise({ dur: 0.22, freq: 5000, to: 900, q: 1.5, vol: 0.35 }); }),
  smash: play(() => { tone({ freq: 160, to: 45, dur: 0.3, type: 'sine', vol: 0.5 }); noise({ dur: 0.18, freq: 600, q: 0.8, vol: 0.3, type: 'lowpass' }); }),
  punch: play(() => { tone({ freq: 220, to: 70, dur: 0.12, type: 'sine', vol: 0.45 }); noise({ dur: 0.06, freq: 1200, q: 1, vol: 0.2 }); }),
  hit: play(n => { for (let i = 0; i < Math.min(n, 6); i++) noise({ dur: 0.07, freq: 1800 + Math.random() * 1500, q: 3, vol: 0.18, delay: i * 0.035 }); }),
  collapse: play(() => { noise({ dur: 0.6, freq: 900, to: 120, q: 0.7, vol: 0.35, type: 'lowpass' }); tone({ freq: 300, to: 60, dur: 0.5, type: 'sawtooth', vol: 0.06 }); }),
  enemyAttack: play(() => { tone({ freq: 140, to: 70, dur: 0.25, type: 'sawtooth', vol: 0.15 }); noise({ dur: 0.25, freq: 3000, to: 500, q: 1, vol: 0.3 }); }),
  warn: play(() => { tone({ freq: 520, dur: 0.09, type: 'square', vol: 0.06 }); tone({ freq: 390, dur: 0.12, type: 'square', vol: 0.06, delay: 0.1 }); }),
  dodge: play(() => { noise({ dur: 0.25, freq: 600, to: 3500, q: 2, vol: 0.25 }); }),
  rotate: play(() => tone({ freq: 500, to: 700, dur: 0.06, type: 'triangle', vol: 0.08 })),
  pick: play(() => tone({ freq: 400, to: 600, dur: 0.07, type: 'triangle', vol: 0.12 })),
  place: play(() => { tone({ freq: 300, dur: 0.06, type: 'square', vol: 0.08 }); noise({ dur: 0.05, freq: 1200, q: 2, vol: 0.15 }); }),
  enhance: play(() => { tone({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.12 }); tone({ freq: 990, dur: 0.12, type: 'triangle', vol: 0.12, delay: 0.07 }); }),
  coin: play(() => { tone({ freq: 1320, dur: 0.07, type: 'square', vol: 0.06 }); tone({ freq: 1760, dur: 0.15, type: 'square', vol: 0.06, delay: 0.07 }); }),
  step: play(() => { noise({ dur: 0.07, freq: 500, q: 1, vol: 0.2, type: 'lowpass' }); noise({ dur: 0.07, freq: 500, q: 1, vol: 0.2, type: 'lowpass', delay: 0.15 }); }),
  win: play(() => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.15, delay: i * 0.11 }))),
  lose: play(() => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'sawtooth', vol: 0.07, delay: i * 0.18 }))),
  error: play(() => tone({ freq: 180, dur: 0.12, type: 'square', vol: 0.07 })),
};

export const getVolume = () => volume;
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
  try { localStorage.setItem('bb-volume', String(v)); } catch { /* 무시 */ }
}

export const isMuted = () => muted;
export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('bb-muted', v ? '1' : '0'); } catch { /* 무시 */ }
}
