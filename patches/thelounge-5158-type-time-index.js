// Backport of https://github.com/thelounge/thelounge/pull/5158.
//
// With storagePolicy.deletionPolicy "statusOnly", the storage cleaner runs
//   ... where time <= ? and type in (...) order by time limit ?
// every 5 minutes. The only matching index is msg_type_idx (type), so SQLite
// reads every status row and sorts them in a temp B-tree; on a large database
// that blocks the event loop for minutes and IRC traffic stops. A (type, time)
// index turns it into a covering index range scan.
//
// Not backported as a migration: #5158 adds one with a new schema version, and
// a stock The Lounge refuses to start on a database whose schema version is
// newer than its own, so going back to the official image would break. Instead
// the index is created idempotently after the migrations, with the same name
// as #5158's, so its real migration skips it once released. msg_type_idx is
// kept (the upstream down-migration expects it).
//
// Drop when: a release of The Lounge includes #5158.

'use strict';

const { findFile, patchFile } = require('./lib');

patchFile(findFile('thelounge', 'dist/server/plugins/messageStorage/sqlite.js'), 'thelounge/thelounge#5158', (replaceOnce) => {
    replaceOnce(
        'index after migrations',
        '            this.run_migrations();\n        }\n',
        [
            '            this.run_migrations();',
            '            // thelounge-patched: index for the statusOnly storage cleaner (#5158)',
            '            this.database.exec("CREATE INDEX IF NOT EXISTS msg_type_time_idx ON messages (type, time)");',
            '        }',
            '',
        ].join('\n')
    );
});
