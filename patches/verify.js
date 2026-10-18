// Build-time check of the SQLite patches: opens a fresh database through The
// Lounge's own SqliteMessageStorage, exactly as it does at startup, and fails
// the build unless the database ends up in WAL mode with the cleaner index.
// It runs in the Dockerfile, so a patch that applied but does the wrong thing
// stops the image before anything is published.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { findFile, fail } = require('./lib');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thelounge-verify-'));
process.env.THELOUNGE_HOME = dir;

const sqliteJs = findFile('thelounge', 'dist/server/plugins/messageStorage/sqlite.js');
const SqliteMessageStorage = require(sqliteJs).default;

const storage = new SqliteMessageStorage('verify');
storage._enable(path.join(dir, 'verify.sqlite3'));
const db = storage.database;

const mode = db.prepare('PRAGMA journal_mode').get().journal_mode;
if (mode !== 'wal') {
    fail(`journal_mode is "${mode}", expected "wal"`);
}
const index = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'msg_type_time_idx'")
    .get();
if (!index) {
    fail('index msg_type_time_idx is missing');
}

// A second open must be a no-op (the index statement is idempotent).
db.close();
storage._enable(path.join(dir, 'verify.sqlite3'));
storage.database.close();

fs.rmSync(dir, { recursive: true, force: true });
console.log(`verified: journal_mode=${mode}, ${index.sql}`);
