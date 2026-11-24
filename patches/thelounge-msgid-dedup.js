// A message whose msgid the window already holds is not stored or notified
// again. Upstream: PR to come (branch mbologna/thelounge:msgid-dedup).
//
// Some servers and bouncers send messages the client already has. ergo sends
// a private conversation again, in an IRCv3 chathistory batch, when The
// Lounge opens the query window for a new sender, and bouncers play back
// their buffer on reconnect. irc-framework hands each replayed line to The
// Lounge as a new message, so the first private message from a new sender is
// stored twice (two rows in the message log), counted twice as unread and
// notified twice, in the browser and through Web Push.
//
// With the patch, a message carrying an IRCv3 msgid that matches one of the
// last 200 messages of its window is dropped before anything is stored,
// counted or notified. Messages loaded from the log keep their msgid, so a
// replay of history the window already shows is dropped too. A message
// without a msgid is handled as before.
//
// Drop when: a release of The Lounge drops messages it already holds by msgid.

'use strict';

const { findFile, patchFile } = require('./lib');

const UPSTREAM = 'PR to come (branch mbologna/thelounge:msgid-dedup)';

patchFile(findFile('thelounge', 'dist/server/plugins/irc-events/message.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'drop known msgids',
        '        // msg is constructed down here because `from` is being copied in the constructor\n',
        [
            '        // thelounge-patched: a message this window already holds (same msgid) is',
            '        // a replay, such as ergo\'s chathistory batch or a bouncer\'s playback',
            '        if (data.msgid && chan.messages) {',
            '            for (let i = chan.messages.length - 1, seen = 0; i >= 0 && seen < 200; i--, seen++) {',
            '                if (chan.messages[i].msgid === data.msgid) {',
            '                    return;',
            '                }',
            '            }',
            '        }',
            '        // msg is constructed down here because `from` is being copied in the constructor',
            '',
        ].join('\n')
    );
});
