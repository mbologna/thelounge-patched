// Build-time check of thelounge-notification-network.js: drives the patched
// message handler with stand-ins for irc-framework, the client and the network
// and checks the Web Push title, then syntax-checks the patched client bundle
// and runs its inserted code against a stand-in store. Fails the build unless
// titles name the network with two networks and stay as they were with one.

'use strict';

const assert = require('assert');
const { execFileSync } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findFile, fail } = require('./lib');

const MARKER = '/*thelounge-patched:notification-network*/';

process.env.THELOUNGE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'thelounge-verify-'));

const messageEvents = require(findFile('thelounge', 'dist/server/plugins/irc-events/message.js')).default;

try {
    // Server: the Web Push title.
    const titles = [];
    const channel = {
        type: 'channel',
        name: '#chan',
        id: 1,
        muted: false,
        highlight: 1,
        messages: [],
        getUser: (nick) => ({ nick }),
        findUser: () => null,
        pushMessage() {},
    };
    const client = {
        emit() {},
        save() {},
        mentions: [],
        networks: [{}, {}],
        manager: { webPush: { push: (c, payload) => titles.push(payload.title) } },
    };
    const network = {
        uuid: 'verify',
        name: 'test',
        host: 'irc.invalid',
        getChannel: (name) => (name === '#chan' ? channel : undefined),
        highlightRegex: /(?:^|[^a-z0-9])me(?:[^a-z0-9]|$)/i,
        isIgnoredUser: () => false,
    };
    const irc = new EventEmitter();
    irc.user = { nick: 'me' };
    messageEvents.call(client, irc, network);
    const mention = () => irc.emit('privmsg', { nick: 'alice', ident: 'u', hostname: 'h', target: '#chan', message: 'me: hi' });

    mention();
    client.networks.pop();
    mention();
    assert.deepStrictEqual(titles, ['[test] #chan (1 mention)', '#chan (1 mention)'], 'Web Push titles');

    // Client: the patched bundle still parses as a module, carries the
    // inserted code once, and that code prefixes the title with two networks.
    const assets = path.join(path.dirname(findFile('thelounge', 'package.json')), 'public', 'assets');
    const bundle = fs.readdirSync(assets).find((name) => /^index-[\w-]+\.js$/.test(name));
    const src = fs.readFileSync(path.join(assets, bundle), 'utf8');
    assert.strictEqual(src.split(MARKER).length - 1, 1, 'the inserted code appears once in the bundle');

    // node --check only parses a file as a module by its extension here (the
    // bundle sits in The Lounge's CommonJS package), so check a .mjs copy.
    const copy = path.join(process.env.THELOUNGE_HOME, 'bundle.mjs');
    fs.copyFileSync(path.join(assets, bundle), copy);
    execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' });

    const start = src.indexOf(MARKER) + MARKER.length;
    const block = src.slice(start, src.indexOf('}', src.indexOf('+e)', start)) + 1);
    const title = new Function('V', 't', 'e', `${block}return e;`);
    const store = (count) => ({
        state: { networks: new Array(count).fill({}) },
        getters: { findChannel: (id) => (id === 7 ? { network: { name: 'test' } } : undefined) },
    });
    assert.strictEqual(title(store(2), 7, 'bob (#chan) says:'), '[test] bob (#chan) says:', 'browser title, two networks');
    assert.strictEqual(title(store(1), 7, 'bob (#chan) says:'), 'bob (#chan) says:', 'browser title, one network');
    assert.strictEqual(title(store(2), 99, 'bob says:'), 'bob says:', 'browser title, unknown channel');
} catch (err) {
    fail(`notification-network: ${err.message}`);
} finally {
    fs.rmSync(process.env.THELOUNGE_HOME, { recursive: true, force: true });
}
console.log('verified: notification titles name the network when there are several');
