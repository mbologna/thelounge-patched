// Keeps the configured nick after a "nick in use" at connect. Covered in part
// by the open https://github.com/thelounge/thelounge/pull/4973, which keeps the
// saved nick but doesn't retry it (related: #4350, #4816).
//
// When the nick is taken while registering (often by the client's own previous
// connection, not yet timed out), The Lounge appends a random digit and
// remembers the wanted nick in network.keepNick. Four things then lose it:
//
// - export() saves the current nick, so the digit lands in the user file and
//   every later connect starts from it.
// - keepNick is retried only when its holder QUITs in a channel the client
//   shares, which never happens on a network without channels.
// - A second collision (the digit nick taken too) overwrites keepNick with it.
// - /nick clears keepNick even when it asks for that very nick, so a connect
//   command that reclaims the nick gives up as soon as it fails once; so does
//   the QUIT path, which clears it before the server confirms the change.
//
// With the patch the user file keeps the wanted nick, keepNick survives until
// setNick() confirms it (or the user picks another nick), and a timer retries
// it every 60 s, backing off to 10 min. The expected "in use" error of those
// retries no longer reaches the lobby.
//
// Drop when: The Lounge keeps the configured nick itself.

'use strict';

const { findFile, patchFile } = require('./lib');

const UPSTREAM = 'thelounge/thelounge#4973, in part: it does not retry the nick';

patchFile(findFile('thelounge', 'dist/server/models/network.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'save the kept nick',
        '        network.channels = this.channels\n',
        [
            '        // thelounge-patched: save the wanted nick, not the fallback',
            '        if (this.keepNick) {',
            '            network.nick = this.keepNick;',
            '        }',
            '        network.channels = this.channels',
            '',
        ].join('\n')
    );
    replaceOnce(
        'stop the retry timer',
        '    destroy() {\n',
        '    destroy() {\n        clearTimeout(this.keepNickTimer);\n'
    );
});

patchFile(findFile('thelounge', 'dist/server/plugins/irc-events/error.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'retry timer',
        'exports.default = (function (irc, network) {\n',
        [
            '// thelounge-patched: retry network.keepNick until setNick() confirms it or',
            '// the user picks another nick (both clear it), backing off to 10 minutes.',
            'function retryKeepNick(irc, network, delay) {',
            '    clearTimeout(network.keepNickTimer);',
            '    network.keepNickTimer = setTimeout(() => {',
            '        if (!network.keepNick || network.irc !== irc) {',
            '            return;',
            '        }',
            '        if (irc.connection && irc.connection.registered) {',
            '            irc.changeNick(network.keepNick);',
            '        }',
            '        retryKeepNick(irc, network, Math.min(delay * 2, 600000));',
            '    }, delay);',
            '    network.keepNickTimer.unref();',
            '}',
            'exports.default = (function (irc, network) {',
            '',
        ].join('\n')
    );
    replaceOnce(
        'quiet retries',
        '    irc.on("nick in use", function (data) {\n',
        [
            '    irc.on("nick in use", function (data) {',
            '        // thelounge-patched: a retry of the kept nick failing is expected',
            '        if (irc.connection.registered && data.nick === network.keepNick) {',
            '            return;',
            '        }',
            '',
        ].join('\n')
    );
    replaceOnce(
        'keep the first wanted nick, start retrying',
        '            network.keepNick = irc.user.nick;\n',
        [
            '            // thelounge-patched: a second collision must not replace the wanted nick',
            '            network.keepNick = network.keepNick || irc.user.nick;',
            '            retryKeepNick(irc, network, 60000);',
            '',
        ].join('\n')
    );
});

patchFile(findFile('thelounge', 'dist/server/plugins/inputs/nick.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        '/nick of the kept nick keeps it',
        '    network.keepNick = null;\n',
        [
            '    // thelounge-patched: asking for the kept nick again must not give it up',
            '    if (network.keepNick !== newNick) {',
            '        network.keepNick = null;',
            '    }',
            '',
        ].join('\n')
    );
});

patchFile(findFile('thelounge', 'dist/server/plugins/irc-events/quit.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'clear only on success',
        '            irc.changeNick(network.keepNick);\n            network.keepNick = null;\n',
        '            // thelounge-patched: setNick() clears keepNick once the change succeeds\n' +
            '            irc.changeNick(network.keepNick);\n'
    );
});
