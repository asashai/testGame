const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'game.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    name TEXT UNIQUE NOT NULL,
    race TEXT NOT NULL,
    gender TEXT,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100, fp INTEGER DEFAULT 100, sp INTEGER DEFAULT 100,
    damage INTEGER DEFAULT 10, defense INTEGER DEFAULT 5,
    accuracy INTEGER DEFAULT 80, dodge INTEGER DEFAULT 5,
    move_speed INTEGER DEFAULT 100, attack_speed INTEGER DEFAULT 100,
    map_id TEXT DEFAULT '', pos_x REAL DEFAULT 0, pos_y REAL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    char_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    slot_index INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS equipment (
    char_id INTEGER NOT NULL,
    slot_name TEXT NOT NULL,
    item_id TEXT,
    PRIMARY KEY (char_id, slot_name)
  );
`);

function hash(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

module.exports = { db, hash };