// Patches thelounge's sqlite message storage to set a sqlite busy_timeout.
//
// The message log DB runs in rollback-journal mode, so any external reader
// holding a read lock (e.g. chat-digest snapshotting the DB before querying)
// blocks writes. node:sqlite's DatabaseSync has no busy timeout by default,
// so a blocked write fails instantly with "database is locked" (errcode 5)
// and the message is lost from the searchable log.
//
// Fix: PRAGMA busy_timeout right after the DB is opened, so writes wait for
// the lock to clear instead of failing. The wait blocks the event loop
// (DatabaseSync is synchronous), but only while an external reader actually
// holds the lock — a few seconds during chat-digest's snapshot copy.

'use strict';

const fs = require('fs');
const path = require('path');

// The thelounge install path varies by image version, mirroring
// patch-connection.js: fall back to a filesystem search so future image
// reshuffles don't break the build.
const SEARCH_ROOTS = [
    '/usr/local/share/.config/yarn/global/node_modules/thelounge',
    '/opt/thelounge/node_modules/thelounge',
    '/usr/local/lib/node_modules/thelounge',
];

let theloungeDir = SEARCH_ROOTS.find(fs.existsSync);

if (!theloungeDir) {
    const { execSync } = require('child_process');
    const found = execSync(
        "find /opt /usr/local -name 'sqlite.js' -path '*/thelounge/dist/server/plugins/messageStorage/*' 2>/dev/null | head -1",
        { encoding: 'utf8' }
    ).trim();
    if (!found) {
        console.error('ERROR: could not locate thelounge on the filesystem.');
        process.exit(1);
    }
    theloungeDir = path.resolve(found, '../../../../..');
}

const SQLITE = path.join(theloungeDir, 'dist/server/plugins/messageStorage/sqlite.js');
let src = fs.readFileSync(SQLITE, 'utf8');
const original = src;

src = src.replace(
    'this.database = new node_sqlite_1.DatabaseSync(connection_string);',
    'this.database = new node_sqlite_1.DatabaseSync(connection_string);\n' +
    '        this.database.exec("PRAGMA busy_timeout = 15000");'
);

if (src === original) {
    console.error('ERROR: patch applied no changes — thelounge sqlite.js did not match expected patterns.');
    console.error('The upstream source may have changed. Review and update this patch script.');
    process.exit(1);
}

fs.writeFileSync(SQLITE, src);
console.log('thelounge sqlite.js busy_timeout patched successfully.');
