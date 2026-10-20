import { el, toast, setChildren } from '../dom.js';
import { addPending, makeShopStock } from '../../core/run.js';
import { itemPrice } from '../../core/items.js';
import { pieceThumb } from '../draw.js';
import { icon, potionIcon } from '../sprites.js';
import { hud, itemCard, npcBanner, screenHeader } from '../widgets.js';
import { sfx } from '../sound.js';

export function shopScreen(app, root) {
  const run = app.run;
  if (!run.visit.shop) run.visit.shop = makeShopStock();
  const stock = run.visit.shop;
  const box = el('div', { class: 'screen shop-screen' });

  function buy(price, onBuy) {
    if (run.gold < price) { sfx.error(); return toast('골드가 부족합니다'); }
    run.gold -= price;
    sfx.coin();
    onBuy();
    render();
  }

  function render() {
    setChildren(box,
      screenHeader(app, '상점', '', 'node_shop'),
      bar,
      el('div', {},
        el('div', { class: 'side-row' },
          npcBanner('shopkeeper', '어서 오게. 블록 물약도, 장비도 있다네.'),
          el('div', { class: 'panel' },
            el('h3', { class: 'with-icon' }, icon('heal', 24), '회복물약 (블록 조각 — 사면 보관함에 들어갑니다)'),
            el('div', { class: 'cards' }, stock.potions.map(p => el('div', { class: `card ${p.sold ? 'dim' : ''}` },
              potionIcon(p.cells, 72),
              el('div', { class: 'card-title' }, `회복물약 ${p.cells}칸`),
              el('div', { class: 'thumb' }, pieceThumb(p.piece.offsets, p.piece.color, 18)),
              el('button', { class: 'btn small', disabled: p.sold || run.gold < p.price,
                onclick: () => buy(p.price, () => { p.sold = true; addPending(run, p.piece); }) },
              p.sold ? '판매 완료' : [icon('gold', 16), ` ${p.price}`])))))),
          el('div', { class: 'panel' },
            el('h3', { class: 'with-icon' }, icon('attack', 24), '장비'),
            el('div', { class: 'cards' }, stock.items.map(s => {
              const price = itemPrice(s.item);
              const c = itemCard(s.item, el('button', { class: 'btn small', disabled: s.sold || run.gold < price,
                onclick: () => buy(price, () => { s.sold = true; run.inventory.push(s.item); toast('가방에 넣었습니다'); }) },
              s.sold ? '판매 완료' : [icon('gold', 16), ` ${price}`]));
              c.classList.toggle('dim', s.sold);
              return c;
            }))),
          el('div', { class: 'row-buttons' }, el('button', { class: 'btn primary', onclick: () => app.go('map') }, '떠나기 ▶'))),
    );
    bar.refresh();
  }
  const bar = hud(app);
  app.inventory = { back: 'shop', onChange: render };
  root.append(box);
  render();
}
