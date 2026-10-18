// Patches kiwiirc/irc-framework connection.js to retry on DNS/connection failures
// at container startup. Without this fix, the first connection attempt that fails
// (e.g. DNS not yet ready at container start) gives up immediately with no retry.
//
// Root cause: the socketClose retry gate is:
//   reconnect_attempts > 0 && reconnect_attempts < max_retries  →  retry
//   was_connected && safely_registered                           →  retry
//   else                                                         →  give up
//
// With reconnect_attempts initialised to 0, the first failure always falls through
// to "give up". The counter is also incorrectly reset on raw socket open, so even
// a half-open connection (TCP up, IRC registration failed) burns the retry chance.
//
// Fix: backport of https://github.com/kiwiirc/irc-framework/pull/413 (for
// issue #211), keeping irc-framework's guard against aKills (a kill within 5s
// of registering is not retried). Drop this patch once a thelounge release
// pins an irc-framework commit that includes the PR.

'use strict';

const fs = require('fs');
const path = require('path');

// The irc-framework install path varies by thelounge image version:
//   ≤4.3.x  →  /opt/thelounge/node_modules/  (npm install)
//   ≥4.4.x  →  yarn global add → /usr/local/share/.config/yarn/global/node_modules/
// Fall back to a filesystem search so future image reshuffles don't break the build.
const SEARCH_ROOTS = [
    '/opt/thelounge/node_modules/irc-framework',
    '/usr/local/share/.config/yarn/global/node_modules/irc-framework',
    '/usr/local/lib/node_modules/irc-framework',
];

let ircFrameworkDir = SEARCH_ROOTS.find(fs.existsSync);

if (!ircFrameworkDir) {
    const { execSync } = require('child_process');
    const found = execSync(
        "find /opt /usr/local -name 'connection.js' -path '*/irc-framework/src/*' 2>/dev/null | head -1",
        { encoding: 'utf8' }
    ).trim();
    if (!found) {
        console.error('ERROR: could not locate irc-framework on the filesystem.');
        process.exit(1);
    }
    ircFrameworkDir = path.resolve(found, '../../..');
}

const CONN = path.join(ircFrameworkDir, 'src/connection.js');
let src = fs.readFileSync(CONN, 'utf8');

// Every replacement must match exactly once: a silent partial patch would ship
// an image that looks fixed but still drops networks on the first failure.
function replaceOnce(description, from, to) {
    const count = src.split(from).length - 1;
    if (count !== 1) {
        console.error(`ERROR: ${description}: expected 1 match, found ${count}.`);
        console.error('irc-framework changed upstream. Compare with kiwiirc/irc-framework#413 and update this script.');
        process.exit(1);
    }
    src = src.replace(from, to);
}

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
);

fs.writeFileSync(CONN, src);
console.log('irc-framework connection.js patched successfully.');
