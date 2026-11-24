// Notification titles name the network when the account has more than one.
// Upstream: PR to come (branch mbologna/thelounge:notification-network).
//
// The Lounge titles a Web Push notification after the window alone
// ("#test (1 mention)", "bob (2 new messages)") and a browser notification
// after the sender and channel ("bob (#test) says:"), so with several
// networks the same channel name on two of them can't be told apart.
//
// With the patch, when the account has more than one network, both start with
// the network's name: "[Libera] #test (1 mention)" from the server's Web Push,
// "[Libera] bob (#test) says:" and "[Libera] New channel invite:" from the
// browser. With one network they are unchanged.
//
// The browser side edits the minified client bundle (public/assets/index-*.js),
// so the anchor uses this build's minified names and the build fails if they
// change. The bundle's .js.map is left as it is and no longer matches; it only
// matters for debugging the client.
//
// Drop when: a release of The Lounge names the network in its notifications.

'use strict';

const fs = require('fs');
const path = require('path');
const { findFile, patchFile, fail } = require('./lib');

const UPSTREAM = 'PR to come (branch mbologna/thelounge:notification-network)';

patchFile(findFile('thelounge', 'dist/server/plugins/irc-events/message.js'), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'Web Push title',
        '            let title = chan.name;\n',
        [
            '            // thelounge-patched: with more than one network, name it in the title',
            '            let title = (client.networks.length > 1 ? `[${network.name}] ` : "") + chan.name;',
            '',
        ].join('\n')
    );
});

// The client bundle's name carries a content hash (index-DkKtmj7M.js in 4.5.2).
const assets = path.join(path.dirname(findFile('thelounge', 'package.json')), 'public', 'assets');
const bundles = fs.readdirSync(assets).filter((name) => /^index-[\w-]+\.js$/.test(name));
if (bundles.length !== 1) {
    fail(`expected one public/assets/index-*.js, found ${bundles.length}: ${bundles.join(', ')}`);
}

// In notifyMessage(): t is the channel id, e the title, V the store.
const ANCHOR =
    'let o=Date.parse(String(i.time));try{V.state.hasServiceWorker?navigator.serviceWorker.ready' +
    '.then(n=>{n.active?.postMessage({type:`notification`,chanId:t,timestamp:o,title:e,body:r})})' +
    '.catch(()=>{}):new Notification(e,{tag:`chan-${t}`,badge:`img/icon-alerted-black-transparent-bg-72x72px.png`,' +
    'icon:`img/icon-alerted-grey-bg-192x192px.png`,body:r,timestamp:o}).addEventListener(`click`,' +
    'function(){this.close(),window.focus();let e=V.getters.findChannel(t);e&&Q(e.channel)})}catch{}';

patchFile(path.join(assets, bundles[0]), UPSTREAM, (replaceOnce) => {
    replaceOnce(
        'browser notification title',
        ANCHOR,
        '/*thelounge-patched:notification-network*/{let p=V.getters.findChannel(t);' +
            'p&&V.state.networks.length>1&&(e=`[${p.network.name}] `+e)}' +
            ANCHOR
    );
});
