// Build-time check of thelounge-msgid-dedup.js: drives the patched message
// handler with stand-ins for irc-framework, the client and the network, and
// fails the build unless a message replayed with a msgid the window already
// holds is stored and notified once.

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findFile, fail } = require('./lib');

process.env.THELOUNGE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'thelounge-verify-'));

const messageEvents = require(findFile('thelounge', 'dist/server/plugins/irc-events/message.js')).default;

function stubChan(type, name) {
    const chan = {
        type,
        name,
        id: 1,
        muted: false,
        highlight: 0,
        messages: [],
        getUser: (nick) => ({ nick }),
        findUser: () => null,
        pushMessage: (client, msg) => chan.messages.push(msg),
        loadMessages() {},
        getFilteredClone: () => ({}),
    };
    return chan;
}

try {
    const windows = new Map();
    const pushed = [];
    const client = {
        emit() {},
        save() {},
        mentions: [],
        networks: [{}],
        manager: { webPush: { push: (c, payload) => pushed.push(payload.body) } },
        createChannel: (opts) => {
            const chan = stubChan(opts.type, opts.name);
            windows.set(opts.name.toLowerCase(), chan);
            return chan;
        },
    };
    const network = {
        uuid: 'verify',
        host: 'irc.invalid',
        getChannel: (name) => windows.get(name.toLowerCase()),
        highlightRegex: /(?:^|[^a-z0-9])me(?:[^a-z0-9]|$)/i,
        getLobby: () => stubChan('lobby', ''),
        isIgnoredUser: () => false,
        addChannel: () => 0,
    };
    const irc = new EventEmitter();
    irc.user = { nick: 'me' };
    messageEvents.call(client, irc, network);
    const say = (nick, message, msgid) =>
        irc.emit('privmsg', { nick, ident: 'u', hostname: 'h', target: 'me', message, tags: msgid ? { msgid } : {} });

    // A new sender's message, then the server's replay of it (ergo's
    // chathistory batch when the query opens): stored and pushed once.
    say('alice', 'hello', 'msgid-1');
    say('alice', 'hello', 'msgid-1');
    const query = windows.get('alice');
    assert.ok(query, 'a query window opened for alice');
    assert.deepStrictEqual(query.messages.map((m) => m.text), ['hello'], 'the replay is not stored again');
    assert.deepStrictEqual(pushed, ['hello'], 'the replay is not notified again');

    // A different msgid, and messages without one, are still delivered.
    say('alice', 'second', 'msgid-2');
    say('alice', 'no id');
    say('alice', 'no id');
    assert.deepStrictEqual(query.messages.map((m) => m.text), ['hello', 'second', 'no id', 'no id'], 'other messages are stored');
    assert.strictEqual(pushed.length, 4, 'other messages are notified');
} catch (err) {
    fail(`msgid-dedup: ${err.message}`);
} finally {
    fs.rmSync(process.env.THELOUNGE_HOME, { recursive: true, force: true });
}
console.log('verified: a message replayed with a known msgid is stored and notified once');
