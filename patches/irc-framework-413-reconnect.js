// Backport of https://github.com/kiwiirc/irc-framework/pull/413 (fixes #211).
//
// irc-framework gives up on a network whose very first connection fails (DNS
// not ready at container start, a network hiccup) or whose socket opens but
// whose IRC registration fails: The Lounge shows "will not reconnect" until a
// manual /connect. The retry gate in socketClose tested reconnect_attempts for
// truthiness, and the counter started at 0 and was reset on every TCP connect.
//
// This counts retries from 0, resets the counter only on successful
// registration, and keeps irc-framework's aKill guard (a kill within 5s of
// registering is not retried).
//
// Drop when: a release of The Lounge pins an irc-framework commit that
// includes #413 (The Lounge pins irc-framework by git commit, not by version).

'use strict';

const { findFile, patchFile } = require('./lib');

patchFile(findFile('irc-framework', 'src/connection.js'), 'kiwiirc/irc-framework#413', (replaceOnce) => {
    // 1. Reset the retry counter on successful IRC registration only.
    replaceOnce(
        'reset on registration',
        'registeredSuccessfully() {\n        this.registered = Date.now();\n    }',
        'registeredSuccessfully() {\n        this.registered = Date.now();\n        this.reconnect_attempts = 0;\n    }'
    );

    // 2. Not on raw TCP connect: a socket that opens but fails to register (auth
    //    timeout, netsplit during connect) must use up the retry budget.
    replaceOnce(
        'no reset on socket open',
        "            that.debugOut('Socket fully connected');\n            that.reconnect_attempts = 0;\n            that.connected = true;",
        "            that.debugOut('Socket fully connected');\n            that.connected = true;"
    );

    // 3. Decide on reconnect: veto aKills (killed within 5s of registering) first,
    //    reconnect after a stable session, and otherwise retry until the budget
    //    runs out. The old truthiness test on reconnect_attempts is what made the
    //    very first failure give up.
    replaceOnce(
        'reconnect decision',
        [
            '            // If trying to reconnect, continue with it',
            '            } else if (that.reconnect_attempts && that.reconnect_attempts < that.auto_reconnect_max_retries) {',
            '                should_reconnect = true;',
            '',
            '            // If we were originally connected OK, reconnect',
            '            } else if (was_connected && safely_registered) {',
            '                should_reconnect = true;',
            '            } else {',
        ].join('\n'),
        [
            '            // Registered, then dropped almost immediately: an aKill rather',
            "            // than a network problem, so don't retry",
            '            } else if (was_connected && that.registered !== false && !safely_registered) {',
            '                should_reconnect = false;',
            '',
            '            // If we were originally connected OK, reconnect',
            '            } else if (was_connected && safely_registered) {',
            '                should_reconnect = true;',
            '',
            '            // Any other failure (first connect, failed registration, or a',
            '            // retry that failed again) retries until the budget runs out',
            '            } else if (that.reconnect_attempts < that.auto_reconnect_max_retries) {',
            '                should_reconnect = true;',
            '            } else {',
        ].join('\n')
    );});
