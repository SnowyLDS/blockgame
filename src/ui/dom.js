// 작은 DOM 도우미
export function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : String(c));
  }
  return e;
}

// replaceChildren + 배열 펼치기, null/false 무시
export function setChildren(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter(c => c != null && c !== false));
}

let toastTimer = 0;
export function toast(msg) {
  if (!msg) return;
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
}

export const wait = ms => new Promise(r => setTimeout(r, ms));

// 캔버스 위 마우스 위치 (캔버스 픽셀 좌표)
export function canvasPoint(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { mx: (e.clientX - r.left) * canvas.width / r.width, my: (e.clientY - r.top) * canvas.height / r.height };
}
