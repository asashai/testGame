module.exports = {
  // ===== Расходники =====
  hp_potion:      { name: 'HP Potion',      type: 'consumable', price: 50,  desc: 'Восстанавливает 50 HP',    stack: true },
  fp_potion:      { name: 'FP Potion',      type: 'consumable', price: 50,  desc: 'Восстанавливает 50 FP',    stack: true },
  sp_potion:      { name: 'SP Potion',      type: 'consumable', price: 50,  desc: 'Восстанавливает 50 SP',    stack: true },

  // ===== Телепорт-предметы (используются из инвентаря) =====
  return_scroll:  { name: 'Return Scroll',  type: 'teleport', price: 200, target: 'hq',    desc: 'Телепорт в Генштаб своей расы', stack: true },
  elan_scroll:    { name: 'Elan Scroll',    type: 'teleport', price: 500, target: 'elan',  desc: 'Телепорт на плато Elan',        stack: true },
  ether_scroll:   { name: 'Ether Scroll',   type: 'teleport', price: 500, target: 'ether', desc: 'Телепорт в Ether',              stack: true },
  sette_scroll:   { name: 'Sette Scroll',   type: 'teleport', price: 500, target: 'sette_desert', desc: 'Телепорт в Sette Desert', stack: true },

  // ===== Оружие (общее) =====
  knife:          { name: 'Knife',          type: 'weapon', price: 100,  damage: 5,  desc: 'Базовый нож' },
  dual_swords:    { name: 'Dual Swords',    type: 'weapon', price: 400,  damage: 12, desc: 'Парные мечи' },
  bow:            { name: 'Bow',            type: 'weapon', price: 350,  damage: 10, desc: 'Лук' },
  staff:          { name: 'Staff',          type: 'weapon', price: 300,  damage: 8,  desc: 'Посох' },

  // ===== Оружие Bellato =====
  bellato_sword:  { name: 'Bellato Sword',  type: 'weapon', race: 'bellato', price: 600, damage: 18, desc: 'Меч Беллато' },
  bellato_axe:    { name: 'Bellato Axe',    type: 'weapon', race: 'bellato', price: 700, damage: 22, desc: 'Топор Беллато' },
  bellato_spear:  { name: 'Bellato Spear',  type: 'weapon', race: 'bellato', price: 650, damage: 20, desc: 'Копьё Беллато' },
  bellato_bow:    { name: 'Bellato Bow',    type: 'weapon', race: 'bellato', price: 680, damage: 19, desc: 'Лук Беллато' },
  bellato_staff:  { name: 'Bellato Staff',  type: 'weapon', race: 'bellato', price: 600, damage: 16, desc: 'Посох Беллато' },

  // ===== Оружие Cora =====
  cora_wand:      { name: 'Cora Wand',      type: 'weapon', race: 'cora',    price: 550, damage: 15, desc: 'Жезл Кора' },
  cora_staff:     { name: 'Cora Staff',     type: 'weapon', race: 'cora',    price: 620, damage: 17, desc: 'Посох Кора' },
  cora_bead:      { name: 'Cora Bead',      type: 'weapon', race: 'cora',    price: 640, damage: 18, desc: 'Бусина Кора' },
  cora_bow:       { name: 'Cora Bow',       type: 'weapon', race: 'cora',    price: 660, damage: 19, desc: 'Лук Кора' },
  cora_dagger:    { name: 'Cora Dagger',    type: 'weapon', race: 'cora',    price: 500, damage: 14, desc: 'Кинжал Кора' },

  // ===== Оружие Accretia =====
  acc_launcher:   { name: 'Mini Rocket Launcher', type: 'weapon', race: 'acretia', price: 800, damage: 25, desc: 'Пусковая установка' },
  acc_flamer:     { name: 'Mini Flame Thrower',   type: 'weapon', race: 'acretia', price: 850, damage: 27, desc: 'Огнемёт' },
  acc_shooter:    { name: 'Roburite Shooter',     type: 'weapon', race: 'acretia', price: 900, damage: 30, desc: 'Тяжёлый стрелок' },

  // ===== Броня (общая) =====
  warrior_armor:  { name: 'Warrior Armour', type: 'armor', price: 400, defense: 8,  desc: 'Броня воина' },
  ranger_armor:   { name: 'Ranger Armour',  type: 'armor', price: 380, defense: 6,  desc: 'Броня рейнджера' },

  // ===== Броня Bellato =====
  bellato_warrior_armor: { name: 'Bellato Warrior Armor', type: 'armor', race: 'bellato', price: 700, defense: 15, desc: 'Броня воина Беллато' },
  bellato_ranger_armor:  { name: 'Bellato Ranger Armor',  type: 'armor', race: 'bellato', price: 650, defense: 12, desc: 'Броня рейнджера Беллато' },
  bellato_force_armor:   { name: 'Bellato Force Armor',   type: 'armor', race: 'bellato', price: 600, defense: 10, desc: 'Броня мага Беллато' },

  // ===== Броня Cora =====
  cora_warrior_armor:    { name: 'Cora Warrior Armor',    type: 'armor', race: 'cora',    price: 680, defense: 14, desc: 'Броня воина Кора' },
  cora_ranger_armor:     { name: 'Cora Ranger Armor',     type: 'armor', race: 'cora',    price: 630, defense: 11, desc: 'Броня рейнджера Кора' },
  cora_force_armor:      { name: 'Cora Force Armor',      type: 'armor', race: 'cora',    price: 580, defense: 9,  desc: 'Броня мага Кора' },

  // ===== Броня Accretia =====
  acc_metal_arm:         { name: 'Metal Arm',             type: 'armor', race: 'acretia', price: 750, defense: 16, desc: 'Металлическая рука' },
  acc_metal_core:        { name: 'Metal Core',            type: 'armor', race: 'acretia', price: 800, defense: 18, desc: 'Металлический корпус' },
  acc_metal_head:        { name: 'Metal Head',            type: 'armor', race: 'acretia', price: 700, defense: 14, desc: 'Металлический шлем' },
  acc_metal_leg:         { name: 'Metal Leg',             type: 'armor', race: 'acretia', price: 720, defense: 15, desc: 'Металлические ноги' },
  acc_metal_landing:     { name: 'Metal Landing',         type: 'armor', race: 'acretia', price: 680, defense: 13, desc: 'Металлические ступни' },

  // ===== Аксессуары =====
  amulet:         { name: 'Amulet',         type: 'accessory', price: 300, desc: 'Амулет удачи' },
  ring:           { name: 'Ring',           type: 'accessory', price: 250, desc: 'Кольцо' },
  cloak:          { name: 'Cloak',          type: 'accessory', price: 280, desc: 'Накидка' },
};