// Opens the message log in WAL mode. Not upstream yet: a future PR.
//
// The Lounge opens its SQLite database with no PRAGMAs, so it uses the default
// rollback journal, where any reader blocks the writer. A program that reads
// the log while The Lounge runs (a backup with VACUUM INTO, a digest job
// copying the database) makes The Lounge's writes fail with "database is
// locked" for as long as the read lasts, and those messages are lost. In WAL
// mode readers never block the writer. The mode is stored in the database file,
// so this is a one-time conversion; on later starts the PRAGMA is a no-op.
//
// Runs right after the database is opened: journal_mode can't change inside a
// transaction, and run_migrations() opens one.
//
// Drop when: The Lounge sets WAL itself (an upstream PR to draft from this).

'use strict';

const { findFile, patchFile } = require('./lib');

patchFile(findFile('thelounge', 'dist/server/plugins/messageStorage/sqlite.js'), 'WAL journal mode (no upstream PR yet)', (replaceOnce) => {
    replaceOnce(
        'WAL at open',
        '        this.database = new node_sqlite_1.DatabaseSync(connection_string);\n',
        [
            '        this.database = new node_sqlite_1.DatabaseSync(connection_string);',
            '        // thelounge-patched: readers must not block the writer',
            '        this.database.exec("PRAGMA journal_mode=WAL");',
            '',
        ].join('\n')
    );
});
