// Build-time check of thelounge-service-queries.js: drives the patched message
// handler with stand-ins for irc-framework, the client and the network, and
// fails the build unless service messages stay out of query windows and
// never highlight.

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
    const channelMessages = [];
    const queries = [];
    const pushedFrom = [];
    const lobby = stubChan('lobby', '', lobbyMessages);
    const channel = stubChan('channel', '#chan', channelMessages);
    const client = {
        emit() {},
        save() {},
        mentions: [],
        networks: [{}],
        manager: { webPush: { push: (c, payload) => pushedFrom.push(payload.body) } },
        createChannel: (opts) => {
            const chan = stubChan(opts.type, opts.name, []);
            queries.push(opts.name);
            return chan;
        },
    };
    const network = {
        uuid: 'verify',
        host: 'irc.invalid',
        getChannel: (name) => (name === '#chan' ? channel : undefined),
        highlightRegex: /(?:^|[^a-z0-9])me(?:[^a-z0-9]|$)/i,
        getLobby: () => lobby,
        isIgnoredUser: () => false,
        addChannel: () => 0,
    };
    const irc = new EventEmitter();
    irc.user = { nick: 'me' };
    messageEvents.call(client, irc, network);
    const say = (nick, target, message) =>
        irc.emit('privmsg', { nick, ident: 'u', hostname: 'h', target, message });
    const notice = (nick, target, message) =>
        irc.emit('notice', { nick, ident: 'u', hostname: 'h', target, message });

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

    // Nothing a service sends highlights, in the server window or a channel,
    // even when it names us; the same line from a person does.
    say('NickServ', 'me', 'You are now logged in as me.');
    notice('NickServ', 'me', 'Password accepted - you are now recognized, me.');
    say('SomeBot', '#chan', 'me: invite sent');
    say('alice', '#chan', 'me: hello');
    const lastLobby = lobbyMessages.slice(-2);
    assert.deepStrictEqual(lastLobby.map((m) => m.highlight), [false, false], 'service lines in the server window do not highlight');
    assert.deepStrictEqual(channelMessages.map((m) => m.highlight), [false, true], 'a service never highlights in a channel, a person does');
    assert.ok(pushedFrom.every((body) => !/NickServ|SomeBot/.test(body)), 'no push notification for a service');

    // Anyone else still opens a query window.
    say('alice', 'me', 'hi');
    assert.deepStrictEqual(queries, ['alice'], 'a person still opens a query');
} catch (err) {
    fail(`service-queries: ${err.message}`);
} finally {
    fs.rmSync(process.env.THELOUNGE_HOME, { recursive: true, force: true });
}
console.log('verified: services stay out of query windows and never highlight');
