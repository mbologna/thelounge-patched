// Private messages to or from network services don't open query windows. Not
// upstream yet: a future PR.
//
// The Lounge opens a query window for every private message without one, so
// connecting to a network that is identified through NickServ leaves a
// "NickServ" window behind: the server answers the IDENTIFY with a private
// message, or, with the echo-message capability, echoes the client's own
// /msg NickServ IDENTIFY back (password included, which then also lands in
// the message log). Bots that answer a connect command privately do the same.
// Notices from such senders already go to the server window.
//
// With the patch, a private message from a service goes to the server window,
// like a notice, and the client's own message to a service, echoed back, is
// neither shown nor stored. Services are NickServ, ChanServ, MemoServ,
// OperServ, HostServ, BotServ, SaslServ and the nicks listed, comma-separated,
// in THELOUNGE_SERVICE_NICKS (e.g. Q,X or a bot's nick). A "nick@server"
// target (Q@CServe.quakenet.org) matches by its nick. A query window that is
// already open keeps working: close it once.
//
// Drop when: The Lounge stops opening query windows for services itself.

'use strict';

const { findFile, patchFile } = require('./lib');

const UPSTREAM = 'no query windows for services (no upstream PR yet)';

patchFile(findFile('thelounge', 'dist/server/plugins/irc-events/message.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'service list',
        'function convertForHandle(type, data) {\n',
        [
            '// thelounge-patched: private messages to or from these nicks never open a',
            '// query window (THELOUNGE_SERVICE_NICKS adds more, comma-separated).',
            'const serviceNicks = new Set(["nickserv", "chanserv", "memoserv", "operserv", "hostserv", "botserv", "saslserv"]',
            '    .concat((process.env.THELOUNGE_SERVICE_NICKS || "").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean)));',
            'function isServiceNick(name) {',
            '    return serviceNicks.has(String(name).split("@")[0].toLowerCase());',
            '}',
            'exports.isServiceNick = isServiceNick;',
            'function convertForHandle(type, data) {',
            '',
        ].join('\n')
    );
    replaceOnce(
        'route service messages',
        [
            '            if (typeof chan === "undefined") {',
            '                // Send notices that are not targeted at us into the server window',
            '                if (data.type === msg_2.MessageType.NOTICE) {',
        ].join('\n'),
        [
            '            if (typeof chan === "undefined") {',
            '                // thelounge-patched: our own message to a service, echoed back',
            '                // (echo-message), is not shown: an IDENTIFY carries a password',
            '                if (self && data.type !== msg_2.MessageType.NOTICE && isServiceNick(target)) {',
            '                    return;',
            '                }',
            '                // Send notices that are not targeted at us, and private messages',
            '                // from services (thelounge-patched), into the server window',
            '                if (data.type === msg_2.MessageType.NOTICE || isServiceNick(target)) {',
        ].join('\n')
    );
});
