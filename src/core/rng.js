// 난수 도우미. 시드가 필요해지면 이 파일의 rand 만 바꾸면 됩니다.
export const rand = () => Math.random();
export const randFloat = (a, b) => a + rand() * (b - a);
export const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));
export const pick = arr => arr[Math.floor(rand() * arr.length)];

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedIndex(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

export function weightedKey(obj) {
  const keys = Object.keys(obj);
  return keys[weightedIndex(keys.map(k => obj[k]))];
}
