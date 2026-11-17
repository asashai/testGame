const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { db, hash } = require('./db');
const ITEMS = require('./items');
const MAPS = require('./maps');
const { MAPS_WITH_MOBS, LOOT_TABLE } = require('./mob');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static(path.join(__dirname, 'public')));

const clients = new Map();
const mapMobs = new Map();
const groundDrops = new Map();
let nextMobId = 1, nextDropId = 1;
const MAX_HP = 100;
const MAX_LEVEL = 60;

// === NPC в Генштабах ===
const NPC_DEFS = {
  bellato_solus_hq: [
    { id: 'npc_weapon', name: 'Оружейник',       type: 'merchant_weapon', x:  3, y:  3, color: '#a33' },
    { id: 'npc_armor',  name: 'Бронник',         type: 'merchant_armor',  x: -3, y:  3, color: '#36a' },
    { id: 'npc_potion', name: 'Торговец зельями', type: 'merchant_potion', x: -3, y: -3, color: '#3a3' },
    { id: 'npc_bank',   name: 'Банкир',           type: 'banker',         x:  3, y: -3, color: '#dd0' },
    { id: 'npc_portal', name: 'Телепорт-гид',     type: 'portal',         x:  0, y: -5, color: '#8fcaf1' },
  ],
  cora_haram_hq: [
    { id: 'npc_weapon', name: 'Оружейник',       type: 'merchant_weapon', x:  3, y:  3, color: '#a33' },
    { id: 'npc_armor',  name: 'Бронник',         type: 'merchant_armor',  x: -3, y:  3, color: '#36a' },
    { id: 'npc_potion', name: 'Торговец зельями', type: 'merchant_potion', x: -3, y: -3, color: '#3a3' },
    { id: 'npc_bank',   name: 'Банкир',           type: 'banker',         x:  3, y: -3, color: '#dd0' },
    { id: 'npc_portal', name: 'Телепорт-гид',     type: 'portal',         x:  0, y: -5, color: '#8fcaf1' },
  ],
  acretia_armory213_hq: [
    { id: 'npc_weapon', name: 'Оружейник',       type: 'merchant_weapon', x:  3, y:  3, color: '#a33' },
    { id: 'npc_armor',  name: 'Бронник',         type: 'merchant_armor',  x: -3, y:  3, color: '#36a' },
    { id: 'npc_potion', name: 'Торговец зельями', type: 'merchant_potion', x: -3, y: -3, color: '#3a3' },
    { id: 'npc_bank',   name: 'Банкир',           type: 'banker',         x:  3, y: -3, color: '#dd0' },
    { id: 'npc_portal', name: 'Телепорт-гид',     type: 'portal',         x:  0, y: -5, color: '#8fcaf1' },
  ],
};

// Ассортимент магазинов по расе
function getShopItems(race, shopType) {
  const all = Object.entries(ITEMS).map(([id, def]) => ({ id, ...def }));
  if (shopType === 'merchant_potion') {
    return all.filter(i => i.type === 'consumable' || i.type === 'teleport');
  }
  if (shopType === 'merchant_weapon') {
    return all.filter(i =>
      i.type === 'weapon' &&
      (!i.race || i.race === race) &&
      i.price <= 1000
    );
  }
  if (shopType === 'merchant_armor') {
    return all.filter(i =>
      i.type === 'armor' &&
      (!i.race || i.race === race) &&
      i.price <= 1000
    );
  }
  return [];
}

const STARTING_ITEMS = [
  { item_id: 'hp_potion', qty: 20 },
  { item_id: 'fp_potion', qty: 20 },
  { item_id: 'sp_potion', qty: 20 },
];
const EQUIP_SLOTS = ['amulet1','head','amulet2','weapon','chest','shield',
                     'hands','legs','cloak','ring1','feet','ring2'];

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcastMap(mapId, obj, except) {
  for (const [ws, st] of clients)
    if (st.mapId === mapId && ws !== except) send(ws, obj);
}
function getNPCsForMap(mapId) { return NPC_DEFS[mapId] || []; }

function getEquipment(charId) {
  const eq = {};
  for (const s of EQUIP_SLOTS) eq[s] = null;
  for (const r of db.prepare('SELECT slot_name,item_id FROM equipment WHERE char_id=?').all(charId))
    eq[r.slot_name] = r.item_id;
  return eq;
}
function getInventory(charId) {
  return db.prepare('SELECT id,item_id,quantity,slot_index FROM inventory WHERE char_id=? ORDER BY slot_index').all(charId);
}
function mobSnapshot(mobs) {
  return mobs.filter(m => m.hp > 0).map(m => ({
    id: m.id, name: m.name, level: m.level, hp: m.hp, maxHp: m.maxHp,
    x: m.x, y: m.y, targetCharId: m.targetCharId,
    accuracy: m.accuracy, dodge: m.dodge,
  }));
}
function pushSelf(st) {
  if (!st.char) return;
  send(st.ws, {
    type: 'self_state',
    character: {
      id: st.char.id, name: st.char.name, race: st.char.race, level: st.char.level,
      exp: st.char.exp, hp: st.char.hp, fp: st.char.fp, sp: st.char.sp,
      damage: st.char.damage, defense: st.char.defense,
      accuracy: st.char.accuracy, dodge: st.char.dodge,
    },
    inventory: getInventory(st.char.id),
    equipment: getEquipment(st.char.id),
  });
}
function savePosition(st) {
  if (st.charId && st.mapId) {
    try {
      db.prepare('UPDATE characters SET map_id=?, pos_x=?, pos_y=? WHERE id=?')
        .run(st.mapId, st.x, st.y, st.charId);
    } catch (e) { console.error('savePosition:', e.message); }
  }
}

function spawnMobsForMap(mapId) {
  if (mapMobs.has(mapId)) return;
  const def = MAPS_WITH_MOBS[mapId];
  if (!def) {
    mapMobs.set(mapId, []);
    groundDrops.set(mapId, groundDrops.get(mapId) || []);
    return;
  }
  const arr = [];
  for (let i = 0; i < def.count; i++) {
    const hx = Math.random() * 16 - 8;
    const hy = Math.random() * 16 - 8;
    arr.push({
      id: nextMobId++, type: def.mob.type, name: def.mob.name, level: def.mob.level,
      hp: def.mob.hp, maxHp: def.mob.hp, damage: def.mob.damage, exp: def.mob.exp,
      accuracy: def.mob.accuracy || 75, dodge: def.mob.dodge || 5,
      x: hx, y: hy, homeX: hx, homeY: hy,
      targetCharId: null, lastAttackAt: 0,
    });
  }
  mapMobs.set(mapId, arr);
  groundDrops.set(mapId, groundDrops.get(mapId) || []);
}
function rollLoot(mobType) {
  const table = LOOT_TABLE[mobType] || [];
  const out = [];
  for (const e of table) if (Math.random() < e.chance) out.push({ id: e.id, qty: e.qty });
  return out;
}

// Универсальный вход на карту
function enterMapForChar(st, mapId, x, y) {
  const m = MAPS[mapId];
  if (!m) return send(st.ws, { ok: false, error: 'Нет карты' });
  if (m.race !== 'all' && m.race !== st.char.race)
    return send(st.ws, { ok: false, error: 'Нельзя' });

  if (st.mapId && st.mapId !== mapId) {
    savePosition(st);
    broadcastMap(st.mapId, { type: 'player_left', charId: st.charId }, st.ws);
  }

  st.mapId = mapId;
  st.x = Number(x) || 0;
  st.y = Number(y) || 0;
  db.prepare('UPDATE characters SET map_id=?, pos_x=?, pos_y=? WHERE id=?')
    .run(mapId, st.x, st.y, st.charId);
  spawnMobsForMap(mapId);

  const others = [];
  for (const [ws2, s2] of clients) {
    if (ws2 !== st.ws && s2.mapId === mapId && s2.char)
      others.push({ charId: s2.charId, name: s2.char.name, race: s2.char.race, x: s2.x, y: s2.y });
  }

  send(st.ws, {
    ok: true,
    map: { id: mapId, name: m.name, palette: m.palette },
    players: others,
    mobs: mobSnapshot(mapMobs.get(mapId) || []),
    drops: groundDrops.get(mapId) || [],
    npcs: getNPCsForMap(mapId),
    self_pos: { x: st.x, y: st.y },
  });

  broadcastMap(mapId, {
    type: 'player_joined', charId: st.charId, name: st.char.name,
    race: st.char.race, x: st.x, y: st.y,
  }, st.ws);

  pushSelf(st);
}

// === Тик мобов: 100 мс, плавное движение 0.06 ===
setInterval(() => {
  const now = Date.now();
  for (const [mapId, mobs] of mapMobs) {
    let moved = false;
    for (const m of mobs) {
      if (m.hp <= 0) continue;

      let targetSt = null;
      if (m.targetCharId) {
        for (const [, s2] of clients)
          if (s2.mapId === mapId && s2.charId === m.targetCharId) { targetSt = s2; break; }
        if (!targetSt) m.targetCharId = null;
      }

      if (targetSt) {
        const dist = Math.hypot(targetSt.x - m.x, targetSt.y - m.y);
        if (dist > 8) {
          m.targetCharId = null;
        } else if (dist > 1.3) {
          const dx = (targetSt.x - m.x) / dist;
          const dy = (targetSt.y - m.y) / dist;
          m.x += dx * 0.06;
          m.y += dy * 0.06;
          moved = true;
        } else if (now - (m.lastAttackAt || 0) > 1200) {
          m.lastAttackAt = now;
          const mobAcc = m.accuracy || 75;
          const charDodge = targetSt.char.dodge || 5;
          const hitChance = Math.min(0.95, Math.max(0.3, mobAcc / (mobAcc + charDodge * 2)));

          if (Math.random() > hitChance) {
            send(targetSt.ws, { type: 'combat_msg', text: `${m.name} промахнулся!` });
          } else {
            const def = targetSt.char.defense || 0;
            const dmg = Math.max(1, m.damage - Math.floor(def / 3) + Math.floor(Math.random() * 3) - 1);
            targetSt.char.hp = Math.max(0, targetSt.char.hp - dmg);
            send(targetSt.ws, { type: 'combat_msg', text: `${m.name} бьёт вас: -${dmg} HP` });

            if (targetSt.char.hp <= 0) {
              const lossExp = Math.floor((targetSt.char.exp || 0) * Math.random() * 0.3);
              const newExp = Math.max(0, (targetSt.char.exp || 0) - lossExp);
              const raceToHq = {
                bellato: 'bellato_solus_hq',
                cora: 'cora_haram_hq',
                acretia: 'acretia_armory213_hq',
              };
              const hqMap = raceToHq[targetSt.char.race] || 'bellato_solus_hq';

              db.prepare('UPDATE characters SET exp=?, hp=?, map_id=?, pos_x=0, pos_y=0 WHERE id=?')
                .run(newExp, MAX_HP, hqMap, targetSt.charId);
              targetSt.char.exp = newExp;
              targetSt.char.hp = MAX_HP;

              for (const mm of mobs) if (mm.targetCharId === targetSt.charId) mm.targetCharId = null;
              broadcastMap(mapId, { type: 'player_left', charId: targetSt.charId }, targetSt.ws);
              send(targetSt.ws, { type: 'you_died', expLost: lossExp, newExp, hp: MAX_HP });

              targetSt.mapId = hqMap;
              targetSt.x = 0;
              targetSt.y = 0;
              spawnMobsForMap(hqMap);

              const newPlayers = [];
              for (const [ws2, s2] of clients) {
                if (s2 !== targetSt && s2.mapId === hqMap && s2.char)
                  newPlayers.push({ charId: s2.charId, name: s2.char.name,
                                    race: s2.char.race, x: s2.x, y: s2.y });
              }
              send(targetSt.ws, {
                type: 'map_changed',
                map: {
                  id: hqMap,
                  name: MAPS[hqMap]?.name || hqMap,
                  palette: MAPS[hqMap]?.palette,
                },
                players: newPlayers,
                mobs: mobSnapshot(mapMobs.get(hqMap) || []),
                drops: groundDrops.get(hqMap) || [],
                npcs: getNPCsForMap(hqMap),
                self_pos: { x: 0, y: 0 },
              });
              broadcastMap(hqMap, {
                type: 'player_joined', charId: targetSt.charId,
                name: targetSt.char.name, race: targetSt.char.race, x: 0, y: 0,
              }, targetSt.ws);
              pushSelf(targetSt);
              continue;
            }
            pushSelf(targetSt);
          }
        }
        moved = true;
      } else {
        m.x += (Math.random() - 0.5) * 0.06;
        m.y += (Math.random() - 0.5) * 0.06;
        if (Math.abs(m.x - m.homeX) > 4) m.x = m.homeX + Math.sign(m.x - m.homeX) * 4;
        if (Math.abs(m.y - m.homeY) > 4) m.y = m.homeY + Math.sign(m.y - m.homeY) * 4;
        moved = true;
      }
    }
    if (moved) broadcastMap(mapId, { type: 'mobs_state', mobs: mobSnapshot(mobs) });
  }
}, 100);

// Автосейв позиций раз в 5 секунд
setInterval(() => { for (const [, s] of clients) savePosition(s); }, 5000);

wss.on('connection', (ws) => {
  const st = { ws, accountId: null, charId: null, char: null, mapId: null, x: 0, y: 0 };
  clients.set(ws, st);
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    try { handle(st, msg); } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    savePosition(st);
    if (st.mapId) broadcastMap(st.mapId, { type: 'player_left', charId: st.charId }, ws);
    clients.delete(ws);
  });
});

function handle(st, msg) {
  const { ws } = st;

  if (msg.action !== 'login' && msg.action !== 'get_items_catalog' && msg.action !== 'get_map_catalog' && !st.accountId)
    return send(ws, { ok: false, error: 'Не авторизован' });

  if (['enter_map','move','move_item','equip_item','unequip','attack','pickup','teleport','npc_interact','buy_item','sell_item','use_item']
      .includes(msg.action) && !st.charId)
    return send(ws, { ok: false, error: 'Персонаж не выбран' });

  switch (msg.action) {
    // ========== АВТОРИЗАЦИЯ ==========
    case 'login': {
      const row = db.prepare('SELECT * FROM accounts WHERE login=?').get(msg.login);
      if (row) {
        if (row.password_hash !== hash(msg.password))
          return send(ws, { ok: false, error: 'Неверный пароль' });
        st.accountId = row.id;
      } else {
        st.accountId = db.prepare('INSERT INTO accounts (login,password_hash) VALUES (?,?)')
          .run(msg.login, hash(msg.password)).lastInsertRowid;
      }
      return send(ws, { ok: true });
    }

    case 'logout': {
      savePosition(st);
      if (st.mapId && st.charId)
        broadcastMap(st.mapId, { type: 'player_left', charId: st.charId }, ws);
      st.accountId = null; st.charId = null; st.char = null;
      st.mapId = null; st.x = 0; st.y = 0;
      return send(ws, { ok: true, logged_out: true });
    }

    // ========== ПЕРСОНАЖИ ==========
    case 'list_chars': {
      const chars = db.prepare('SELECT * FROM characters WHERE account_id=?').all(st.accountId);
      return send(ws, { ok: true, characters: chars });
    }

    case 'create_char': {
      if (db.prepare('SELECT COUNT(*) c FROM characters WHERE account_id=?').get(st.accountId).c >= 3)
        return send(ws, { ok: false, error: 'Максимум 3 персонажа' });
      let gender = msg.gender;
      if (msg.race === 'acretia') gender = null;
      else if (!['male', 'female'].includes(gender))
        return send(ws, { ok: false, error: 'Выберите пол' });
      if (!['bellato', 'cora', 'acretia'].includes(msg.race))
        return send(ws, { ok: false, error: 'Раса' });
      try {
        const cid = db.prepare('INSERT INTO characters (account_id,name,race,gender) VALUES (?,?,?,?)')
          .run(st.accountId, msg.name, msg.race, gender).lastInsertRowid;
        let i = 0;
        for (const it of STARTING_ITEMS)
          db.prepare('INSERT INTO inventory (char_id,item_id,quantity,slot_index) VALUES (?,?,?,?)')
            .run(cid, it.item_id, it.qty, i++);
        return send(ws, { ok: true, char_id: cid });
      } catch { return send(ws, { ok: false, error: 'Имя занято' }); }
    }

    case 'select_char': {
      const ch = db.prepare('SELECT * FROM characters WHERE id=? AND account_id=?')
        .get(msg.char_id, st.accountId);
      if (!ch) return send(ws, { ok: false, error: 'Не найден' });
      st.char = ch;
      st.charId = ch.id;

      if (ch.map_id && MAPS[ch.map_id] &&
          (MAPS[ch.map_id].race === 'all' || MAPS[ch.map_id].race === ch.race)) {
        return enterMapForChar(st, ch.map_id, ch.pos_x, ch.pos_y);
      }

      const maps = Object.entries(MAPS)
        .filter(([, m]) => m.race === ch.race || m.race === 'all')
        .map(([id, m]) => ({ id, name: m.name, type: m.type }));
      return send(ws, { ok: true, character: ch, maps, needs_map_select: true });
    }

    // ========== КАРТЫ / ТЕЛЕПОРТ ==========
    case 'get_map_catalog': {
      const catalog = {};
      for (const [id, map] of Object.entries(MAPS))
        catalog[id] = { name: map.name, race: map.race, type: map.type };
      return send(ws, { map_catalog: catalog });
    }

    case 'enter_map': {
      return enterMapForChar(st, msg.map_id, 0, 0);
    }

    case 'teleport': {
      const targetMap = msg.target_map;
      const target = MAPS[targetMap];
      if (!target) return send(ws, { ok: false, error: 'Локация не найдена' });

      const currentMapDef = MAPS[st.mapId];
      if (!currentMapDef || !currentMapDef.isHQ)
        return send(ws, { ok: false, error: 'Телепортация доступна только из Генштаба' });

      if (target.race !== 'all' && target.race !== st.char.race)
        return send(ws, { ok: false, error: 'Эта локация недоступна для вашей расы' });

      if (targetMap === 'ether' && st.char.level < 35)
        return send(ws, { ok: false, error: 'Ether доступен с 35 уровня' });

      return enterMapForChar(st, targetMap, 0, 0);
    }

    // ========== NPC ==========
    case 'npc_interact': {
      const npcs = getNPCsForMap(st.mapId);
      const npc = npcs.find(n => n.id === msg.npc_id);
      if (!npc) return;
      const dist = Math.hypot(npc.x - st.x, npc.y - st.y);
      if (dist > 3) return send(ws, { type: 'combat_msg', text: 'Слишком далеко' });

      if (npc.type === 'banker') {
        return send(ws, {
          type: 'npc_dialog', title: npc.name,
          text: 'Хранилище временно недоступно. Приходите позже!',
        });
      }

      if (npc.type.startsWith('merchant')) {
        const shopItems = getShopItems(st.char.race, npc.type);
        return send(ws, {
          type: 'shop_open',
          npc_name: npc.name,
          items: shopItems.map(i => ({
            id: i.id, name: i.name, price: i.price,
            type: i.type, damage: i.damage, defense: i.defense,
            desc: i.desc,
          })),
        });
      }
      return;
    }

    // ========== МАГАЗИН ==========
    case 'buy_item': {
      const itemDef = ITEMS[msg.item_id];
      if (!itemDef) return send(ws, { type: 'combat_msg', text: 'Товар не найден' });
      const qty = Math.max(1, Math.min(99, parseInt(msg.qty) || 1));
      const price = (itemDef.price || 0) * qty;
      // Проверка, что игрок действительно у торговца (упрощённо — по карте)
      const npcs = getNPCsForMap(st.mapId);
      const nearMerchant = npcs.some(n =>
        n.type.startsWith('merchant') &&
        Math.hypot(n.x - st.x, n.y - st.y) <= 3
      );
      if (!nearMerchant) return send(ws, { type: 'combat_msg', text: 'Подойдите к торговцу' });

      // Проверка золота (упрощённо: пока нет валюты — пропускаем, или можно добавить поле gold в characters)
      // Для демо выдаём бесплатно, но помечаем
      // (в реальной игре здесь списание денег)
      const existing = db.prepare('SELECT * FROM inventory WHERE char_id=? AND item_id=?')
        .get(st.charId, msg.item_id);
      if (existing && itemDef.stack) {
        db.prepare('UPDATE inventory SET quantity=quantity+? WHERE id=?').run(qty, existing.id);
      } else {
        const used = new Set(getInventory(st.charId).map(i => i.slot_index));
        let free = 0; while (used.has(free)) free++;
        db.prepare('INSERT INTO inventory (char_id,item_id,quantity,slot_index) VALUES (?,?,?,?)')
          .run(st.charId, msg.item_id, qty, free);
      }
      pushSelf(st);
      return send(ws, { type: 'combat_msg', text: `Куплено: ${itemDef.name} ×${qty}` });
    }

    case 'sell_item': {
      const inv = db.prepare('SELECT * FROM inventory WHERE char_id=?').all(st.charId);
      const item = inv.find(i => i.slot_index === msg.slot_index);
      if (!item) return;
      const def = ITEMS[item.item_id];
      if (!def) return;
      const sellPrice = Math.floor((def.price || 0) * 0.5);
      const qty = Math.min(item.quantity, msg.qty || 1);
      if (qty >= item.quantity) {
        db.prepare('DELETE FROM inventory WHERE id=?').run(item.id);
      } else {
        db.prepare('UPDATE inventory SET quantity=quantity-? WHERE id=?').run(qty, item.id);
      }
      pushSelf(st);
      return send(ws, { type: 'combat_msg', text: `Продано: ${def.name} ×${qty} за ${sellPrice * qty} (демо)` });
    }

    // ========== ИСПОЛЬЗОВАНИЕ ПРЕДМЕТА (телепорт) ==========
    case 'use_item': {
      const inv = db.prepare('SELECT * FROM inventory WHERE char_id=?').all(st.charId);
      const item = inv.find(i => i.slot_index === msg.slot_index);
      if (!item) return;
      const def = ITEMS[item.item_id];
      if (!def || def.type !== 'teleport') return send(ws, { type: 'combat_msg', text: 'Это нельзя использовать так' });

      // Определяем целевую карту
      let targetMap = null;
      if (def.target === 'hq') {
        const raceToHq = {
          bellato: 'bellato_solus_hq',
          cora: 'cora_haram_hq',
          acretia: 'acretia_armory213_hq',
        };
        targetMap = raceToHq[st.char.race];
      } else {
        targetMap = def.target; // elan, ether, sette_desert
      }

      if (!targetMap || !MAPS[targetMap])
        return send(ws, { type: 'combat_msg', text: 'Локация недоступна' });

      // Расход предмета
      if (item.quantity > 1) {
        db.prepare('UPDATE inventory SET quantity=quantity-1 WHERE id=?').run(item.id);
      } else {
        db.prepare('DELETE FROM inventory WHERE id=?').run(item.id);
      }

      pushSelf(st);
      return enterMapForChar(st, targetMap, 0, 0);
    }

    // ========== ДВИЖЕНИЕ ==========
    case 'move': {
      if (!st.mapId) return;
      st.x = msg.x;
      st.y = msg.y;
      return broadcastMap(st.mapId,
        { type: 'player_moved', charId: st.charId, x: st.x, y: st.y }, ws);
    }

    // ========== БОЙ ==========
    case 'attack': {
      const mobs = mapMobs.get(st.mapId);
      if (!mobs) return;
      const target = mobs.find(m => m.id === msg.mobId && m.hp > 0);
      if (!target) return;
      const dist = Math.hypot(target.x - st.x, target.y - st.y);
      if (dist > 3.5) return send(ws, { type: 'combat_msg', text: 'Слишком далеко' });

      const charAcc = st.char.accuracy || 80;
      const mobDodge = target.dodge || 0;
      const hitChance = Math.min(0.95, Math.max(0.3, charAcc / (charAcc + mobDodge * 2)));

      target.targetCharId = st.charId;
      target.lastAttackAt = 0;

      if (Math.random() > hitChance) {
        return send(ws, { type: 'combat_msg', text: `Промах по ${target.name}!` });
      }

      const dmg = Math.max(1, st.char.damage + Math.floor(Math.random() * 5) - Math.floor(target.level / 5));
      target.hp -= dmg;
      broadcastMap(st.mapId, {
        type: 'mob_hit', mobId: target.id,
        hp: Math.max(0, target.hp), maxHp: target.maxHp, damage: dmg,
      });

      if (target.hp <= 0) {
        target.hp = 0;
        target.targetCharId = null;

        const newExp = st.char.exp + target.exp;
        let newLevel = st.char.level;
        while (newExp >= newLevel * 100 && newLevel < MAX_LEVEL) newLevel++;
        db.prepare('UPDATE characters SET exp=?, level=?, hp=?, fp=?, sp=? WHERE id=?')
          .run(newExp, newLevel, st.char.hp, st.char.fp, st.char.sp, st.charId);
        st.char.exp = newExp;
        const leveledUp = newLevel > st.char.level;
        st.char.level = newLevel;
        if (leveledUp)
          broadcastMap(st.mapId,
            { type: 'combat_msg', text: `${st.char.name} достиг ${newLevel} уровня!` });

        const drops = groundDrops.get(st.mapId) || [];
        for (const l of rollLoot(target.type))
          drops.push({
            id: nextDropId++, item_id: l.id, quantity: l.qty,
            x: target.x + (Math.random() - 0.5),
            y: target.y + (Math.random() - 0.5),
          });
        groundDrops.set(st.mapId, drops);

        for (const [ws2, s2] of clients)
          if (s2.mapId === st.mapId) send(ws2, { type: 'drops_state', drops });

        broadcastMap(st.mapId, { type: 'mob_died', mobId: target.id });
        pushSelf(st);

        setTimeout(() => {
          target.hp = target.maxHp;
          target.x = target.homeX;
          target.y = target.homeY;
          broadcastMap(st.mapId, {
            type: 'mob_respawned', mobId: target.id, hp: target.maxHp,
            x: target.x, y: target.y, maxHp: target.maxHp,
          });
        }, 10000);
      }
      return;
    }

    // ========== ЛУТ ==========
    case 'pickup': {
      const drops = groundDrops.get(st.mapId) || [];
      const drop = drops.find(d => d.id === msg.dropId);
      if (!drop) return;
      if (Math.hypot(drop.x - st.x, drop.y - st.y) > 3.5)
        return send(ws, { type: 'combat_msg', text: 'Слишком далеко' });

      const existing = db.prepare('SELECT * FROM inventory WHERE char_id=? AND item_id=?')
        .get(st.charId, drop.item_id);
      if (existing && ITEMS[drop.item_id] && ITEMS[drop.item_id].stack) {
        db.prepare('UPDATE inventory SET quantity=quantity+? WHERE id=?')
          .run(drop.quantity, existing.id);
      } else {
        const used = new Set(getInventory(st.charId).map(i => i.slot_index));
        let free = 0;
        while (used.has(free)) free++;
        db.prepare('INSERT INTO inventory (char_id,item_id,quantity,slot_index) VALUES (?,?,?,?)')
          .run(st.charId, drop.item_id, drop.quantity, free);
      }
      drops.splice(drops.indexOf(drop), 1);
      broadcastMap(st.mapId, { type: 'drops_state', drops });
      pushSelf(st);
      return;
    }

    // ========== ИНВЕНТАРЬ ==========
    case 'move_item': {
      const { from, to } = msg;
      if (typeof from !== 'number' || typeof to !== 'number') return;
      const inv = db.prepare('SELECT * FROM inventory WHERE char_id=?').all(st.charId);
      const src = inv.find(i => i.slot_index === from);
      const dst = inv.find(i => i.slot_index === to);
      if (!src) return;
      if (dst) {
        db.prepare('UPDATE inventory SET slot_index=? WHERE id=?').run(to, src.id);
        db.prepare('UPDATE inventory SET slot_index=? WHERE id=?').run(from, dst.id);
      } else {
        db.prepare('UPDATE inventory SET slot_index=? WHERE id=?').run(to, src.id);
      }
      return pushSelf(st);
    }

    case 'equip_item': {
      const inv = db.prepare('SELECT * FROM inventory WHERE char_id=?').all(st.charId);
      const src = inv.find(i => i.slot_index === msg.slot);
      if (!src) return;
      const item = ITEMS[src.item_id];
      if (!item) return;
      const targetSlot = msg.target_slot;
      if (!EQUIP_SLOTS.includes(targetSlot)) return;
      const compat = {
        weapon: ['weapon'],
        armor: ['chest', 'head', 'hands', 'legs', 'feet'],
        accessory: ['amulet1', 'amulet2', 'ring1', 'ring2', 'cloak'],
      };
      const allowed = compat[item.type];
      if (!allowed || !allowed.includes(targetSlot))
        return send(ws, { ok: false, error: 'Не подходит слот' });
      db.prepare('DELETE FROM inventory WHERE id=?').run(src.id);
      const cur = db.prepare('SELECT item_id FROM equipment WHERE char_id=? AND slot_name=?')
        .get(st.charId, targetSlot);
      if (cur && cur.item_id) {
        const used = new Set(getInventory(st.charId).map(i => i.slot_index));
        let free = 0;
        while (used.has(free)) free++;
        db.prepare('INSERT INTO inventory (char_id,item_id,quantity,slot_index) VALUES (?,?,?,?)')
          .run(st.charId, cur.item_id, 1, free);
      }
      db.prepare('INSERT OR REPLACE INTO equipment (char_id,slot_name,item_id) VALUES (?,?,?)')
        .run(st.charId, targetSlot, src.item_id);
      return pushSelf(st);
    }

    case 'unequip': {
      if (!EQUIP_SLOTS.includes(msg.slot_name)) return;
      const cur = db.prepare('SELECT item_id FROM equipment WHERE char_id=? AND slot_name=?')
        .get(st.charId, msg.slot_name);
      if (!cur || !cur.item_id) return;
      db.prepare('DELETE FROM equipment WHERE char_id=? AND slot_name=?')
        .run(st.charId, msg.slot_name);
      const used = new Set(getInventory(st.charId).map(i => i.slot_index));
      let free = 0;
      while (used.has(free)) free++;
      db.prepare('INSERT INTO inventory (char_id,item_id,quantity,slot_index) VALUES (?,?,?,?)')
        .run(st.charId, cur.item_id, 1, free);
      return pushSelf(st);
    }

    case 'get_items_catalog':
      return send(ws, { ok: true, items: ITEMS });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RF MVP: http://localhost:${PORT}`));