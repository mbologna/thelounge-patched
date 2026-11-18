// Build-time check of thelounge-keep-nick.js: drives the patched Network model,
// "nick in use" handler and /nick input with stand-ins for irc-framework and
// the client, and fails the build unless the wanted nick survives.

'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { findFile, fail } = require('./lib');

process.env.THELOUNGE_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'thelounge-verify-'));

const Network = require(findFile('thelounge', 'dist/server/models/network.js')).default;
const errorEvents = require(findFile('thelounge', 'dist/server/plugins/irc-events/error.js')).default;
const nickInput = require(findFile('thelounge', 'dist/server/plugins/inputs/nick.js')).default;

try {
    const lobbyMessages = [];
    const client = { emit() {}, save() {} };
    const network = new Network({ name: 'verify', host: 'irc.invalid', nick: 'wanted' });
    network.getLobby = () => ({ pushMessage: (c, msg) => lobbyMessages.push(msg) });

    const changes = [];
    const irc = new EventEmitter();
    irc.connection = { registered: false };
    irc.user = { nick: 'wanted' };
    irc.network = { options: { NICKLEN: '30' } };
    irc.connected = true;
    irc.changeNick = (nick) => {
        changes.push(nick);
        irc.user.nick = nick;
    };
    network.irc = irc;
    errorEvents.call(client, irc, network);

    // First collision at registration: a digit is appended, the wanted nick kept.
    irc.emit('nick in use', { nick: 'wanted' });
    assert.match(changes[0], /^wanted\d$/, 'falls back to a digit nick');
    network.setNick(changes[0]);
    assert.strictEqual(network.keepNick, 'wanted');
    assert.ok(network.keepNickTimer, 'retry timer started');

    // Second collision: the wanted nick must not become the digit nick.
    irc.emit('nick in use', { nick: changes[0] });
    assert.strictEqual(network.keepNick, 'wanted', 'second collision keeps the wanted nick');

    // The user file gets the wanted nick, not the fallback.
    assert.strictEqual(network.export().nick, 'wanted', 'export() saves the wanted nick');

    // After registration, a failed retry of the kept nick stays out of the lobby.
    irc.connection.registered = Date.now();
    const before = lobbyMessages.length;
    irc.emit('nick in use', { nick: 'wanted' });
    assert.strictEqual(lobbyMessages.length, before, 'retry failure is quiet');

    // /nick of the kept nick keeps it; /nick of another nick drops it.
    const chan = { pushMessage() {} };
    nickInput.input.call(client, network, chan, 'nick', ['wanted']);
    assert.strictEqual(network.keepNick, 'wanted', '/nick <kept nick> keeps it');
    nickInput.input.call(client, network, chan, 'nick', ['other']);
    assert.strictEqual(network.keepNick, null, '/nick <other> drops it');

    // Getting the nick back clears keepNick, and export() follows the real nick.
    network.keepNick = 'wanted';
    network.setNick('wanted');
    assert.strictEqual(network.keepNick, null, 'setNick() clears keepNick');
    assert.strictEqual(network.export().nick, 'wanted');

    network.destroy();
} catch (err) {
    fail(`keep-nick: ${err.message}`);
} finally {
    fs.rmSync(process.env.THELOUNGE_HOME, { recursive: true, force: true });
}
console.log('verified: the configured nick survives a nick-in-use fallback');
