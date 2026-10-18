// Shared helpers for the patch scripts. Each script backports one upstream PR
// (or drafts a future one) by editing the installed JavaScript in place, and
// must fail the build rather than ship an image that only looks patched.

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Where the official image installs global packages. The path has moved
// between releases (npm install up to 4.3.x, yarn global add since 4.4.x), so
// fall back to a filesystem search.
const ROOTS = [
    '/usr/local/share/.config/yarn/global/node_modules',
    '/opt/thelounge/node_modules',
    '/usr/local/lib/node_modules',
];

// Returns the absolute path of <pkg>/<relPath>, wherever the image put it.
function findFile(pkg, relPath) {
    for (const root of ROOTS) {
        const candidate = path.join(root, pkg, relPath);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    const found = execSync(
        `find /opt /usr/local -path '*/node_modules/${pkg}/${relPath}' 2>/dev/null | head -1`,
        { encoding: 'utf8' }
    ).trim();
    if (!found) {
        fail(`could not locate ${pkg}/${relPath}`);
    }
    return found;
}

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

// Applies edit(replaceOnce) to file. Every replacement must match exactly
// once: zero means upstream changed the code, more than one means the anchor
// is ambiguous. Either way the patch needs a human, so the build stops.
function patchFile(file, upstream, edit) {
    let src = fs.readFileSync(file, 'utf8');
    edit((description, from, to) => {
        const count = src.split(from).length - 1;
        if (count !== 1) {
            fail(`${path.basename(file)}: ${description}: expected 1 match, found ${count}. ` +
                `The upstream source changed; compare with ${upstream} and update this patch.`);
        }
        src = src.replace(from, to);
    });
    fs.writeFileSync(file, src);
    console.log(`patched ${file} (${upstream})`);
}

module.exports = { findFile, patchFile, fail };
