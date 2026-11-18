// Build-time check of thelounge-service-queries.js: drives the patched message
// handler with stand-ins for irc-framework, the client and the network, and
// fails the build unless service messages stay out of query windows.

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findFile, fail } = require('./lib');

process.env.THELOUNGE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'thelounge-verify-'));
process.env.THELOUNGE_SERVICE_NICKS = 'Q, SomeBot';

const messageEvents = require(findFile('thelounge', 'dist/server/plugins/irc-events/message.js')).default;

function stubChan(type, name, sink) {
    return {
        type,
        name,
        id: 1,
        muted: false,
        highlight: 0,
        getUser: (nick) => ({ nick }),
        findUser: () => null,
        pushMessage: (client, msg) => sink.push(msg),
        loadMessages() {},
        getFilteredClone: () => ({}),
    };
}

try {
    const lobbyMessages = [];
    const queries = [];
    const lobby = stubChan('lobby', '', lobbyMessages);
    const client = {
        emit() {},
        save() {},
        mentions: [],
        manager: { webPush: { push() {} } },
        createChannel: (opts) => {
            const chan = stubChan(opts.type, opts.name, []);
            queries.push(opts.name);
            return chan;
        },
    };
    const network = {
        uuid: 'verify',
        host: 'irc.invalid',
        getChannel: () => undefined,
        getLobby: () => lobby,
        isIgnoredUser: () => false,
        addChannel: () => 0,
    };
    const irc = new EventEmitter();
    irc.user = { nick: 'me' };
    messageEvents.call(client, irc, network);
    const say = (nick, target, message) =>
        irc.emit('privmsg', { nick, ident: 'u', hostname: 'h', target, message });

    // A service answers privately: server window, no query.
    say('NickServ', 'me', 'You are now identified.');
    assert.strictEqual(queries.length, 0, 'no query window for NickServ');
    assert.strictEqual(lobbyMessages.length, 1, 'NickServ reply in the server window');

    // Our own IDENTIFY, echoed back (echo-message): shown nowhere.
    say('me', 'NickServ', 'IDENTIFY hunter2');
    say('me', 'NickServ@services.example', 'IDENTIFY hunter2');
    assert.strictEqual(queries.length, 0, 'no query window for our own message to a service');
    assert.strictEqual(lobbyMessages.length, 1, 'the echoed IDENTIFY is not shown');

    // Extra services from THELOUNGE_SERVICE_NICKS, matched case-insensitively.
    say('somebot', 'me', 'invite sent');
    say('Q', 'me', 'auth ok');
    assert.strictEqual(queries.length, 0, 'no query window for the listed nicks');
    assert.strictEqual(lobbyMessages.length, 3, 'their replies in the server window');

    // Anyone else still opens a query window.
    say('alice', 'me', 'hi');
    assert.deepStrictEqual(queries, ['alice'], 'a person still opens a query');
} catch (err) {
    fail(`service-queries: ${err.message}`);
} finally {
    fs.rmSync(process.env.THELOUNGE_HOME, { recursive: true, force: true });
}
console.log('verified: services stay out of query windows');
