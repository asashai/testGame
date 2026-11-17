let ws;
let MAPS_CATALOG = {};
const VIEW_RADIUS = 9; // туман войны: мобы/НПС/дропы дальше — не рисуются

const state = {
  screen: 'login',
  characters: [], character: null, maps: [],
  players: new Map(), mobs: new Map(), drops: [], npcs: [],
  self: { x: 0, y: 0 },
  inventory: [], equipment: {}, items: {}, keys: {},
  hitFlash: new Map(),
  mapPalette: null,
  mapId: null,
  shopItems: null,
  shopNpcName: '',
};

const W = () => window.innerWidth, H = () => window.innerHeight;
const TILE_W = 64, TILE_H = 32;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = W(); canvas.height = H(); }
window.addEventListener('resize', resize); resize();

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  state.screen = name;
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    send({ action: 'get_items_catalog' });
    send({ action: 'get_map_catalog' });
  };
  ws.onmessage = (e) => handleMessage(JSON.parse(e.data));
  ws.onclose = () => { alert('Соединение закрыто'); location.reload(); };
}
function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

// ============ ПИКСЕЛЬНЫЕ ИКОНКИ ============
const ICON_CACHE = {};
const ICON_IMG_CACHE = {};

function getIcon(itemId) {
  if (ICON_CACHE[itemId]) return ICON_CACHE[itemId];
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawIconPixels(g, itemId);
  ICON_CACHE[itemId] = c.toDataURL();
  return ICON_CACHE[itemId];
}
function getIconImg(itemId) {
  if (!ICON_IMG_CACHE[itemId]) {
    const img = new Image();
    img.src = getIcon(itemId);
    ICON_IMG_CACHE[itemId] = img;
  }
  return ICON_IMG_CACHE[itemId];
}
function drawIconPixels(g, id) {
  const R = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  g.clearRect(0, 0, 16, 16);
  if (id === 'hp_potion') { R(6,2,4,2,'#888'); R(5,4,6,10,'#ccc'); R(6,6,4,7,'#d33'); R(6,5,4,1,'#8a3a3a'); return; }
  if (id === 'fp_potion') { R(6,2,4,2,'#888'); R(5,4,6,10,'#ccc'); R(6,6,4,7,'#38d'); R(6,5,4,1,'#2a4a7a'); return; }
  if (id === 'sp_potion') { R(6,2,4,2,'#888'); R(5,4,6,10,'#ccc'); R(6,6,4,7,'#3c5'); R(6,5,4,1,'#2a5a3a'); return; }
  if (id === 'return_scroll' || id === 'elan_scroll' || id === 'ether_scroll' || id === 'sette_scroll') {
    R(3,2,10,12,'#eed'); R(4,3,8,10,'#f8f0d0'); R(6,5,4,1,'#a00'); R(6,7,4,1,'#a00'); R(6,9,4,1,'#a00');
    return;
  }
  if (id === 'knife') { R(7,2,2,9,'#ccc'); R(6,3,1,3,'#aaa'); R(9,3,1,3,'#aaa'); R(7,11,2,3,'#643'); R(6,11,4,1,'#543'); return; }
  if (id === 'dual_swords') { for (let i = 0; i < 9; i++) { R(3+i,3+i,1,1,'#ccc'); R(12-i,3+i,1,1,'#ccc'); } R(2,2,2,2,'#643'); R(12,2,2,2,'#643'); return; }
  if (id === 'bow') { R(5,2,1,1,'#864'); R(4,3,1,1,'#864'); R(3,4,1,8,'#864'); R(4,12,1,1,'#864'); R(5,13,1,1,'#864'); R(11,2,1,12,'#ddd'); return; }
  if (id === 'staff') { R(7,4,2,11,'#864'); R(6,2,4,3,'#8bf'); R(7,2,2,1,'#cdf'); R(5,3,1,1,'#8bf'); R(10,3,1,1,'#8bf'); return; }
  if (id === 'warrior_armor' || id === 'bellato_warrior_armor' || id === 'cora_warrior_armor') {
    R(4,3,8,10,'#a33'); R(2,4,2,6,'#a33'); R(12,4,2,6,'#a33'); R(6,3,4,2,'#c55'); R(6,6,4,1,'#7a1e1e'); R(6,9,4,1,'#7a1e1e'); return;
  }
  if (id === 'ranger_armor' || id === 'bellato_ranger_armor' || id === 'cora_ranger_armor') {
    R(4,3,8,10,'#3a3'); R(2,4,2,6,'#3a3'); R(12,4,2,6,'#3a3'); R(6,3,4,2,'#5c5'); R(6,6,4,1,'#1e5a1e'); R(6,9,4,1,'#1e5a1e'); return;
  }
  if (id === 'amulet') { R(4,2,1,3,'#dd0'); R(11,2,1,3,'#dd0'); R(5,4,1,2,'#dd0'); R(10,4,1,2,'#dd0'); R(6,6,4,4,'#dd0'); R(7,7,2,2,'#f80'); R(6,9,4,1,'#b80'); return; }
  if (id === 'ring') { R(6,5,4,1,'#ff0'); R(5,6,1,4,'#ff0'); R(10,6,1,4,'#ff0'); R(6,10,4,1,'#ff0'); R(7,6,2,4,'#ffee44'); R(7,4,2,2,'#f80'); return; }
  if (id === 'cloak') { R(4,3,8,11,'#663'); R(2,3,2,4,'#663'); R(12,3,2,4,'#663'); R(4,12,8,2,'#442'); R(5,5,6,6,'#885'); return; }
  // Launcher / Accretia
  R(2,6,12,4,'#666'); R(2,4,3,8,'#888'); R(13,6,2,4,'#bbb'); R(4,7,2,2,'#444'); R(8,7,2,2,'#444');
}

// ============ UI ============
document.getElementById('btn-login').onclick = () => {
  const login = document.getElementById('login').value.trim();
  const password = document.getElementById('password').value;
  if (!login || !password) return;
  const remember = document.getElementById('remember')?.checked;
  try {
    if (remember) localStorage.setItem('rf_login', JSON.stringify({ login, password }));
    else localStorage.removeItem('rf_login');
  } catch { /* ignore */ }
  send({ action: 'login', login, password });
};
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-login').click();
});
document.getElementById('btn-create').onclick = () => {
  document.getElementById('new-name').value = '';
  document.getElementById('create-error').textContent = '';
  showScreen('create');
};
document.getElementById('btn-cancel-create').onclick = () => showScreen('lobby');
document.getElementById('new-race').addEventListener('change', e => {
  document.getElementById('gender-wrap').style.display = (e.target.value === 'acretia') ? 'none' : 'block';
});
document.getElementById('new-race').dispatchEvent(new Event('change'));
document.getElementById('btn-submit-create').onclick = () => {
  const name = document.getElementById('new-name').value.trim();
  const race = document.getElementById('new-race').value;
  const gender = document.getElementById('new-gender').value;
  if (!name) return (document.getElementById('create-error').textContent = 'Введите имя');
  send({ action: 'create_char', name, race, gender });
};
document.getElementById('btn-back-lobby').onclick = () => { showScreen('lobby'); send({ action: 'list_chars' }); };
document.getElementById('btn-inv').onclick = () => document.getElementById('inventory-panel').classList.toggle('hidden');
document.getElementById('btn-char').onclick = () => {
  document.getElementById('char-panel').classList.toggle('hidden');
  renderCharPanel();
};
document.getElementById('btn-exit').onclick = () => location.reload();
document.getElementById('btn-logout')?.addEventListener('click', () => send({ action: 'logout' }));

window.addEventListener('keydown', (e) => {
  state.keys[e.key.toLowerCase()] = true;
  if (state.screen === 'game') {
    if (e.key.toLowerCase() === 'i') document.getElementById('btn-inv').click();
    if (e.key.toLowerCase() === 'c') document.getElementById('btn-char').click();
    if (e.key.toLowerCase() === 'e') pickupNearest();
  }
});
window.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });

// ============ КЛИК ПО CANVAS: NPC → МОБ ============
canvas.addEventListener('click', (e) => {
  if (state.screen !== 'game') return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  // NPC
  for (const npc of state.npcs) {
    if (Math.hypot(npc.x - state.self.x, npc.y - state.self.y) > VIEW_RADIUS) continue;
    const { sx, sy } = worldToScreen(npc.x, npc.y);
    if (mx >= sx - 15 && mx <= sx + 15 && my >= sy - 48 && my <= sy) {
      const dist = Math.hypot(npc.x - state.self.x, npc.y - state.self.y);
      if (dist > 3) { flashMessage('Подойдите ближе к NPC'); return; }
      if (npc.type === 'portal') openTeleportMenu();
      else if (npc.type === 'banker') send({ action: 'npc_interact', npc_id: npc.id });
      else if (npc.type.startsWith('merchant')) send({ action: 'npc_interact', npc_id: npc.id });
      return;
    }
  }

  // Мобы
  let bestMob = null, bestMobD = 28;
  for (const m of state.mobs.values()) {
    if (m.hp <= 0) continue;
    if (Math.hypot(m.x - state.self.x, m.y - state.self.y) > VIEW_RADIUS) continue;
    const { sx, sy } = worldToScreen(m.rx ?? m.x, m.ry ?? m.y);
    const d = Math.hypot(sx - mx, sy - my);
    if (d < bestMobD) { bestMobD = d; bestMob = m; }
  }
  if (bestMob) send({ action: 'attack', mobId: bestMob.id });
});

function pickupNearest() {
  if (!state.drops.length) return;
  let best = null, bestD = Infinity;
  for (const d of state.drops) {
    if (Math.hypot(d.x - state.self.x, d.y - state.self.y) > VIEW_RADIUS) continue;
    const dist = Math.hypot(d.x - state.self.x, d.y - state.self.y);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  if (!best) return;
  if (bestD <= 3.5) send({ action: 'pickup', dropId: best.id });
  else flashMessage(`Ближайший дроп в ${bestD.toFixed(1)} клетках — подойдите ближе (E)`);
}

// ============ МЕНЮ ТЕЛЕПОРТА (NPC-портал) ============
function openTeleportMenu() {
  const race = state.character.race;
  const lvl = state.character.level || 1;
  const available = [];
  for (const [id, map] of Object.entries(MAPS_CATALOG)) {
    if (map.race !== 'all' && map.race !== race) continue;
    if (id === state.mapId) continue;
    if (id === 'ether' && lvl < 35) continue;
    available.push({ id, name: map.name });
  }
  if (!available.length) return flashMessage('Нет доступных локаций');
  let menu = 'Доступные локации:\n';
  available.forEach((loc, i) => { menu += `${i + 1}. ${loc.name}\n`; });
  menu += '\nВведите номер:';
  const choice = prompt(menu);
  if (!choice) return;
  const idx = parseInt(choice) - 1;
  if (idx < 0 || idx >= available.length) return;
  send({ action: 'teleport', target_map: available[idx].id });
}

// ============ МАГАЗИН ============
function renderShop() {
  const panel = document.getElementById('shop-panel');
  if (!state.shopItems) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  document.getElementById('shop-title').textContent = state.shopNpcName;

  const list = document.getElementById('shop-list');
  list.innerHTML = '';
  for (const it of state.shopItems) {
    const row = document.createElement('div');
    row.className = 'shop-row';
    const icon = getIcon(it.id);
    let stats = '';
    if (it.damage) stats = `Урон: ${it.damage}`;
    else if (it.defense) stats = `Защита: ${it.defense}`;
    row.innerHTML = `
      <img class="shop-icon" src="${icon}" alt="">
      <div class="shop-info">
        <strong>${it.name}</strong>
        <span class="shop-price">${it.price} gold</span>
        ${stats ? `<span class="shop-stats">${stats}</span>` : ''}
      </div>
      <button class="shop-buy">Купить</button>
    `;
    row.querySelector('.shop-buy').onclick = () => {
      send({ action: 'buy_item', item_id: it.id, qty: 1 });
    };
    list.appendChild(row);
  }

  // Список для продажи (инвентарь)
  const sellList = document.getElementById('sell-list');
  sellList.innerHTML = '';
  for (const inv of state.inventory) {
    const def = state.items[inv.item_id];
    if (!def) continue;
    const row = document.createElement('div');
    row.className = 'shop-row';
    const price = Math.floor((def.price || 0) * 0.5);
    row.innerHTML = `
      <img class="shop-icon" src="${getIcon(inv.item_id)}" alt="">
      <div class="shop-info">
        <strong>${def.name} ×${inv.quantity}</strong>
        <span class="shop-price">Продажа: ${price} gold</span>
      </div>
      <button class="shop-sell">Продать 1</button>
    `;
    row.querySelector('.shop-sell').onclick = () => {
      send({ action: 'sell_item', slot_index: inv.slot_index, qty: 1 });
    };
    sellList.appendChild(row);
  }
}

document.getElementById('shop-close')?.addEventListener('click', () => {
  document.getElementById('shop-panel').classList.add('hidden');
  state.shopItems = null;
});

// ============ MESSAGE HANDLER ============
function handleMessage(msg) {
  if (msg.ok === false) {
    if (msg.error) {
      if (state.screen === 'login') document.getElementById('login-error').textContent = msg.error;
      else if (state.screen === 'create') document.getElementById('create-error').textContent = msg.error;
      else alert(msg.error);
    }
    return;
  }

  if (msg.logged_out) {
    state.character = null; state.characters = [];
    state.mapId = null; state.mapPalette = null;
    state.players.clear(); state.mobs.clear(); state.drops = []; state.npcs = [];
    state.inventory = []; state.equipment = {}; state.self = { x: 0, y: 0 };
    document.getElementById('login-error').textContent = '';
    document.getElementById('inventory-panel').classList.add('hidden');
    document.getElementById('char-panel').classList.add('hidden');
    document.getElementById('shop-panel').classList.add('hidden');
    showScreen('login');
    return;
  }

  if (msg.type === 'you_died') { flashMessage(`💀 Вы погибли! Потеряно опыта: ${msg.expLost}`); return; }

  if (msg.type === 'map_changed') {
    state.mapId = msg.map.id;
    state.mapPalette = msg.map.palette || null;
    state.players.clear();
    (msg.players || []).forEach(p => state.players.set(p.charId, p));
    state.mobs.clear();
    (msg.mobs || []).forEach(m => state.mobs.set(m.id, m));
    state.drops = msg.drops || [];
    state.npcs = msg.npcs || [];
    state.self = msg.self_pos || { x: 0, y: 0 };
    renderHUD();
    send({ action: 'enter_map', map_id: msg.map.id });
    return;
  }

  if (msg.type === 'npc_dialog') { flashMessage(`[${msg.title}]: ${msg.text}`); return; }

  if (msg.type === 'shop_open') {
    state.shopItems = msg.items;
    state.shopNpcName = msg.npc_name;
    renderShop();
    return;
  }

  if (msg.map_catalog) { MAPS_CATALOG = msg.map_catalog; return; }

  if (msg.characters) { state.characters = msg.characters; renderCharList(); showScreen('lobby'); return; }
  if (msg.char_id !== undefined) { send({ action: 'list_chars' }); return; }

  if (msg.character && msg.maps) {
    state.character = msg.character;
    state.maps = msg.maps;
    renderMapList();
    showScreen('mapselect');
    return;
  }

  if (msg.map && msg.players) {
    state.mapId = msg.map.id;
    state.mapPalette = msg.map.palette || null;
    state.players.clear();
    msg.players.forEach(p => state.players.set(p.charId, p));
    state.mobs.clear();
    (msg.mobs || []).forEach(m => state.mobs.set(m.id, m));
    state.drops = msg.drops || [];
    state.npcs = msg.npcs || [];
    state.self = msg.self_pos || { x: 0, y: 0 };
    document.getElementById('inventory-panel').classList.remove('hidden');
    showScreen('game');
    return;
  }

  if (msg.type === 'self_state') {
    state.character = msg.character;
    state.inventory = msg.inventory;
    state.equipment = msg.equipment;
    renderHUD(); renderInventory();
    if (!document.getElementById('char-panel').classList.contains('hidden')) renderCharPanel();
    if (state.shopItems) renderShop();
    return;
  }
  if (msg.type === 'player_joined') { state.players.set(msg.charId, msg); return; }
  if (msg.type === 'player_left') { state.players.delete(msg.charId); return; }
  if (msg.type === 'player_moved') { const p = state.players.get(msg.charId); if (p) { p.x = msg.x; p.y = msg.y; } return; }

  if (msg.type === 'mobs_state') {
    const seen = new Set();
    for (const nm of msg.mobs) {
      seen.add(nm.id);
      const old = state.mobs.get(nm.id);
      if (old && old.rx !== undefined) { nm.rx = old.rx; nm.ry = old.ry; }
      state.mobs.set(nm.id, nm);
    }
    for (const k of [...state.mobs.keys()]) if (!seen.has(k)) state.mobs.delete(k);
    return;
  }
  if (msg.type === 'mob_hit') {
    const m = state.mobs.get(msg.mobId);
    if (m) { m.hp = msg.hp; m.maxHp = msg.maxHp; state.hitFlash.set(msg.mobId, performance.now()); }
    return;
  }
  if (msg.type === 'mob_died') { const m = state.mobs.get(msg.mobId); if (m) m.hp = 0; return; }
  if (msg.type === 'mob_respawned') {
    const m = state.mobs.get(msg.mobId);
    if (m) { m.hp = msg.hp; m.maxHp = msg.maxHp; m.x = msg.x; m.y = msg.y; m.rx = msg.x; m.ry = msg.y; }
    return;
  }
  if (msg.type === 'drops_state') { state.drops = msg.drops; return; }
  if (msg.type === 'combat_msg') { flashMessage(msg.text); return; }
  if (msg.items) { state.items = msg.items; return; }
  if (msg.ok === true) send({ action: 'list_chars' });
}

let flashTimer = null;
function flashMessage(text) {
  let el = document.getElementById('combat-flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'combat-flash';
    el.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#ffcc00;padding:8px 16px;border-radius:4px;font-size:14px;pointer-events:none;z-index:50;';
    document.body.appendChild(el);
  }
  el.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.remove(), 1500);
}

// ============ ЛОББИ / КАРТЫ ============
function renderCharList() {
  const el = document.getElementById('char-list');
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const ch = state.characters[i];
    const card = document.createElement('div');
    if (ch) {
      card.className = 'char-card';
      card.innerHTML = `<strong>${ch.name}</strong><br>Раса: ${ch.race}${ch.gender ? '<br>Пол: ' + ch.gender : ''}<br>Ур. ${ch.level}`;
      card.onclick = () => send({ action: 'select_char', char_id: ch.id });
    } else {
      card.className = 'char-card empty';
      card.innerHTML = `<div style="color:#666;text-align:center;line-height:160px;font-size:14px;">Слот ${i + 1}<br><span style="font-size:11px;">(пусто — нажмите, чтобы создать)</span></div>`;
      card.onclick = () => {
        document.getElementById('new-name').value = '';
        document.getElementById('create-error').textContent = '';
        showScreen('create');
      };
    }
    el.appendChild(card);
  }
  const btn = document.getElementById('btn-create');
  if (btn) btn.style.display = state.characters.length >= 3 ? 'none' : 'inline-block';
}

function renderMapList() {
  const el = document.getElementById('map-list');
  el.innerHTML = '';
  for (const m of state.maps) {
    const card = document.createElement('div');
    card.className = 'map-card';
    card.innerHTML = `<strong>${m.name}</strong><br><small>${m.type}</small>`;
    card.onclick = () => send({ action: 'enter_map', map_id: m.id });
    el.appendChild(card);
  }
}

function renderHUD() {
  const c = state.character;
  if (!c) return;
  const need = c.level * 100;
  document.getElementById('hud-info').innerHTML = `
    <div><b>${c.name}</b> (${c.race}) · Ур.${c.level}</div>
    <div>HP: ${c.hp} · FP: ${c.fp} · SP: ${c.sp}</div>
    <div>Exp: ${c.exp || 0} / ${need}</div>
    <div style="font-size:11px;color:#888">Клик по мобу — атака · E — дроп · 2× клик по свитку — телепорт</div>
  `;
}

// ============ ИНВЕНТАРЬ / ЭКИПИРОВКА ============
const INV_SLOTS = 24;
function renderInventory() {
  const grid = document.getElementById('inv-grid');
  grid.innerHTML = '';
  const bySlot = {}; for (const it of state.inventory) bySlot[it.slot_index] = it;
  for (let i = 0; i < INV_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot'; slot.dataset.slot = i;
    const item = bySlot[i];
    if (item) {
      slot.classList.add('occupied');
      const info = state.items[item.item_id];
      slot.innerHTML = `<img class="icon" src="${getIcon(item.item_id)}" alt="">
                        <span class="qty">${item.quantity}</span>`;
      slot.title = info?.name || item.item_id;
      slot.onmouseenter = (e) => showTooltip(e, item.item_id, item.quantity);
      slot.onmouseleave = hideTooltip;
      slot.draggable = true;
      slot.ondragstart = (e) => e.dataTransfer.setData('slot', String(i));
      slot.ondblclick = () => {
        if (info?.type === 'teleport') {
          send({ action: 'use_item', slot_index: i });
        } else {
          const t = defaultEquipSlot(item.item_id);
          if (t) send({ action: 'equip_item', slot: i, target_slot: t });
        }
      };
    }
    slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('drop-target'); };
    slot.ondragleave = () => slot.classList.remove('drop-target');
    slot.ondrop = (e) => {
      e.preventDefault(); slot.classList.remove('drop-target');
      const from = parseInt(e.dataTransfer.getData('slot'));
      if (!isNaN(from) && from !== i) send({ action: 'move_item', from, to: i });
    };
    grid.appendChild(slot);
  }
}
function defaultEquipSlot(id) {
  const it = state.items[id]; if (!it) return null;
  if (it.type === 'weapon') return 'weapon';
  if (it.type === 'armor') return 'chest';
  if (it.type === 'accessory') return 'amulet1';
  return null;
}
const EQUIP_ORDER = [
  { slot: 'amulet1', label: 'Амулет' }, { slot: 'head', label: 'Голова' }, { slot: 'amulet2', label: 'Амулет' },
  { slot: 'weapon', label: 'Оружие' }, { slot: 'chest', label: 'Торс' }, { slot: 'shield', label: 'Щит' },
  { slot: 'hands', label: 'Руки' }, { slot: 'legs', label: 'Ноги' }, { slot: 'cloak', label: 'Накидка' },
  { slot: 'ring1', label: 'Кольцо' }, { slot: 'feet', label: 'Ступни' }, { slot: 'ring2', label: 'Кольцо' },
];
function renderCharPanel() {
  const c = state.character;
  if (c) {
    document.getElementById('char-stats').innerHTML = `
      <div>Уровень: ${c.level} · Exp: ${c.exp || 0}</div>
      <div>HP: ${c.hp} · FP: ${c.fp} · SP: ${c.sp}</div>
      <div>Урон: ${c.damage || 10} · Защита: ${c.defense || 5}</div>
      <div>Точность: ${c.accuracy || 80} · Уворот: ${c.dodge || 5}</div>
    `;
  }
  const grid = document.getElementById('equip-grid');
  grid.innerHTML = '';
  for (const e of EQUIP_ORDER) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const itemId = state.equipment[e.slot];
    slot.innerHTML = `<span class="label">${e.label}</span>`;
    if (itemId) {
      slot.classList.add('occupied');
      slot.innerHTML += `<img class="icon" src="${getIcon(itemId)}" alt="">`;
      const it = state.items[itemId];
      if (it) slot.title = it.name;
      slot.onmouseenter = (ev) => showTooltip(ev, itemId, 1);
      slot.onmouseleave = hideTooltip;
      slot.ondblclick = () => send({ action: 'unequip', slot_name: e.slot });
    }
    slot.ondragover = (ev) => { ev.preventDefault(); slot.classList.add('drop-target'); };
    slot.ondragleave = () => slot.classList.remove('drop-target');
    slot.ondrop = (ev) => {
      ev.preventDefault(); slot.classList.remove('drop-target');
      const from = parseInt(ev.dataTransfer.getData('slot'));
      if (!isNaN(from)) send({ action: 'equip_item', slot: from, target_slot: e.slot });
    };
    grid.appendChild(slot);
  }
}
function showTooltip(e, itemId, qty) {
  const tt = document.getElementById('tooltip');
  const it = state.items[itemId];
  if (!it) return;
  let html = `<strong>${it.name}</strong>`;
  if (it.desc) html += `<br>${it.desc}`;
  if (it.damage) html += `<br>Урон: ${it.damage}`;
  if (it.defense) html += `<br>Защита: ${it.defense}`;
  if (it.price) html += `<br>Цена: ${it.price}`;
  if (qty > 1) html += `<br>Количество: ${qty}`;
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  tt.style.left = (e.pageX + 15) + 'px';
  tt.style.top = (e.pageY + 15) + 'px';
}
function hideTooltip() { document.getElementById('tooltip').classList.add('hidden'); }

// ============ ИЗОМЕТРИЯ / РЕНДЕР ============
let lastTime = performance.now();

function worldToScreen(wx, wy) {
  const cx = state.self.x, cy = state.self.y;
  const sx = (wx - wy - (cx - cy)) * (TILE_W / 2) + W() / 2;
  const sy = (wx + wy - (cx + cy)) * (TILE_H / 2) + H() / 2;
  return { sx, sy };
}
function drawTile(wx, wy, color, gridColor) {
  const { sx, sy } = worldToScreen(wx, wy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(sx, sy - TILE_H / 2);
  ctx.lineTo(sx + TILE_W / 2, sy);
  ctx.lineTo(sx, sy + TILE_H / 2);
  ctx.lineTo(sx - TILE_W / 2, sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = gridColor || '#2a2a3a';
  ctx.stroke();
}
function drawMap() {
  const range = 14;
  const cx = Math.round(state.self.x), cy = Math.round(state.self.y);
  const p = state.mapPalette || { tile1: '#22222e', tile2: '#26263a', grid: '#2a2a3a' };
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      const x = cx + dx, y = cy + dy;
      const color = ((x + y) & 1) === 0 ? p.tile1 : p.tile2;
      drawTile(x, y, color, p.grid);
    }
  }
  // Затемнение за пределами радиуса видимости (виньетка)
  const r = VIEW_RADIUS * TILE_W * 0.75;
  const grd = ctx.createRadialGradient(W()/2, H()/2, r * 0.7, W()/2, H()/2, r * 1.3);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W(), H());
}
function drawPlayer(x, y, name, isSelf) {
  const { sx, sy } = worldToScreen(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 4, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isSelf ? '#8fcaf1' : '#f1a88f';
  ctx.beginPath(); ctx.ellipse(sx, sy - 10, 12, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.textAlign = 'center';
  ctx.fillText(name, sx, sy - 38);
}
function drawMob(m) {
  if (Math.hypot(m.x - state.self.x, m.y - state.self.y) > VIEW_RADIUS) return;
  const x = m.rx ?? m.x, y = m.ry ?? m.y;
  const { sx, sy } = worldToScreen(x, y);
  const flash = state.hitFlash.get(m.id);
  const hit = flash && (performance.now() - flash < 150);
  const aggro = m.targetCharId && m.targetCharId === state.character?.id;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 4, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (aggro) {
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(sx, sy - 8, 17, 21, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = hit ? '#ff6666' : (aggro ? '#aa3a5a' : '#7a5aaa');
  ctx.beginPath(); ctx.ellipse(sx, sy - 8, 14, 18, 0, 0, Math.PI * 2); ctx.fill();

  const w = 40, h = 5, bx = sx - w / 2, by = sy - 34;
  ctx.fillStyle = '#400'; ctx.fillRect(bx, by, w, h);
  ctx.fillStyle = '#c33'; ctx.fillRect(bx, by, w * Math.max(0, m.hp) / m.maxHp, h);
  ctx.strokeStyle = '#000'; ctx.strokeRect(bx, by, w, h);
  ctx.fillStyle = '#ddd'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(`${m.name} Lv.${m.level}`, sx, sy - 40);
}
function drawNPC(npc) {
  if (Math.hypot(npc.x - state.self.x, npc.y - state.self.y) > VIEW_RADIUS) return;
  const { sx, sy } = worldToScreen(npc.x, npc.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy + 4, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = npc.color || '#888';
  ctx.fillRect(sx - 10, sy - 30, 20, 30);
  ctx.fillStyle = '#f0d0b0';
  ctx.beginPath(); ctx.arc(sx, sy - 35, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
  ctx.fillText(npc.name, sx, sy - 48);
}
function drawDrops() {
  for (const d of state.drops) {
    if (Math.hypot(d.x - state.self.x, d.y - state.self.y) > VIEW_RADIUS) continue;
    const { sx, sy } = worldToScreen(d.x, d.y);
    const bob = Math.sin(performance.now() / 300 + d.id) * 3;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath(); ctx.arc(sx, sy - 8 + bob, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.drawImage(getIconImg(d.item_id), sx - 8, sy - 28 + bob, 16, 16);
    ctx.fillStyle = '#fff'; ctx.font = '10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(state.items[d.item_id]?.name || d.item_id, sx, sy - 34 + bob);
  }
}

function updateMobsSmooth(dt) {
  const k = Math.min(1, dt * 10);
  for (const m of state.mobs.values()) {
    if (m.rx === undefined) { m.rx = m.x; m.ry = m.y; }
    m.rx += (m.x - m.rx) * k;
    m.ry += (m.y - m.ry) * k;
  }
}

function render() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state.screen === 'game') {
    const speed = 4 * dt;
    let dx = 0, dy = 0;
    if (state.keys['w'] || state.keys['arrowup'])    dy -= speed;
    if (state.keys['s'] || state.keys['arrowdown'])  dy += speed;
    if (state.keys['a'] || state.keys['arrowleft'])  dx -= speed;
    if (state.keys['d'] || state.keys['arrowright']) dx += speed;
    if (dx || dy) {
      state.self.x += dx; state.self.y += dy;
      send({ action: 'move', x: state.self.x, y: state.self.y });
      for (const d of state.drops) {
        if (Math.hypot(d.x - state.self.x, d.y - state.self.y) < 1.2) {
          send({ action: 'pickup', dropId: d.id });
          break;
        }
      }
    }

    updateMobsSmooth(dt);

    ctx.fillStyle = '#12121a';
    ctx.fillRect(0, 0, W(), H());
    drawMap();

    const all = [];
    for (const p of state.players.values()) {
      if (Math.hypot(p.x - state.self.x, p.y - state.self.y) <= VIEW_RADIUS)
        all.push({ kind: 'p', ...p });
    }
    if (state.character) all.push({
      kind: 'p', charId: state.character.id, name: state.character.name,
      x: state.self.x, y: state.self.y, isSelf: true,
    });
    for (const m of state.mobs.values()) if (m.hp > 0) all.push({ kind: 'm', ...m });
    for (const npc of state.npcs) all.push({ kind: 'npc', ...npc });

    all.sort((a, b) =>
      ((a.rx ?? a.x) + (a.ry ?? a.y)) - ((b.rx ?? b.x) + (b.ry ?? b.y))
    );

    for (const o of all) {
      if (o.kind === 'p') drawPlayer(o.x, o.y, o.name, o.isSelf);
      else if (o.kind === 'm') drawMob(o);
      else if (o.kind === 'npc') drawNPC(o);
    }
    drawDrops();
  }

  requestAnimationFrame(render);
}

// ============ ВОССТАНОВЛЕНИЕ ЛОГИНА ============
(function restoreLogin() {
  try {
    const saved = JSON.parse(localStorage.getItem('rf_login') || 'null');
    if (saved && saved.login) {
      document.getElementById('login').value = saved.login;
      document.getElementById('password').value = saved.password || '';
      const cb = document.getElementById('remember');
      if (cb) cb.checked = true;
    }
  } catch { /* ignore */ }
})();

connect();
requestAnimationFrame(render);