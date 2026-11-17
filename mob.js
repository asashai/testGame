const MAPS_WITH_MOBS = {
  bellato_solus_settlement:    { count: 6,  mob: { type: 'crag_mine',    name: 'Crag Mine',           level: 2,  hp: 60,  damage: 3,  exp: 25,  accuracy: 70, dodge: 5 } },
  bellato_anacaade_settlement: { count: 8,  mob: { type: 'claw_guard',   name: 'Claw Guard',          level: 7,  hp: 180, damage: 8,  exp: 80,  accuracy: 78, dodge: 10 } },
  cora_haram_stockade:         { count: 6,  mob: { type: 'bezel',        name: 'Bezel',               level: 2,  hp: 55,  damage: 3,  exp: 22,  accuracy: 68, dodge: 7 } },
  cora_numerus_stockade:       { count: 8,  mob: { type: 'devi',         name: 'Devi',                level: 7,  hp: 170, damage: 8,  exp: 75,  accuracy: 76, dodge: 12 } },
  acretia_armory213:           { count: 6,  mob: { type: 'turak',        name: 'Turak',               level: 2,  hp: 70,  damage: 4,  exp: 28,  accuracy: 72, dodge: 4 } },
  acretia_armory117:           { count: 8,  mob: { type: 'hound',        name: 'Bloodthirsty Hound',  level: 7,  hp: 190, damage: 9,  exp: 85,  accuracy: 80, dodge: 8 } },
  ether:                       { count: 10, mob: { type: 'ice_wraith',   name: 'Ice Wraith',          level: 15, hp: 600, damage: 25, exp: 300, accuracy: 88, dodge: 18 } },
  sette_desert:                { count: 10, mob: { type: 'sand_snatcher', name: 'Sand Snatcher',      level: 12, hp: 450, damage: 20, exp: 220, accuracy: 85, dodge: 15 } },
};

const LOOT_TABLE = {
  crag_mine:     [{ id: 'hp_potion', qty: 1, chance: 0.5 }, { id: 'knife', qty: 1, chance: 0.1 }],
  claw_guard:    [{ id: 'hp_potion', qty: 2, chance: 0.5 }, { id: 'dual_swords', qty: 1, chance: 0.15 }, { id: 'warrior_armor', qty: 1, chance: 0.1 }],
  bezel:         [{ id: 'fp_potion', qty: 1, chance: 0.5 }, { id: 'staff', qty: 1, chance: 0.1 }],
  devi:          [{ id: 'fp_potion', qty: 2, chance: 0.5 }, { id: 'bow', qty: 1, chance: 0.15 }, { id: 'ranger_armor', qty: 1, chance: 0.1 }],
  turak:         [{ id: 'sp_potion', qty: 1, chance: 0.5 }, { id: 'knife', qty: 1, chance: 0.1 }],
  hound:         [{ id: 'sp_potion', qty: 2, chance: 0.5 }, { id: 'launcher', qty: 1, chance: 0.15 }, { id: 'launcher_armor', qty: 1, chance: 0.1 }],
  ice_wraith:    [{ id: 'hp_potion', qty: 5, chance: 0.7 }, { id: 'amulet', qty: 1, chance: 0.2 }, { id: 'ring', qty: 1, chance: 0.2 }],
  sand_snatcher: [{ id: 'hp_potion', qty: 5, chance: 0.7 }, { id: 'cloak', qty: 1, chance: 0.2 }, { id: 'ring', qty: 1, chance: 0.2 }],
};

module.exports = { MAPS_WITH_MOBS, LOOT_TABLE };