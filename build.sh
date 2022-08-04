#!/usr/bin/env sh

./node_modules/.bin/tsc;
cp ./README.md ./dist/README.md;
cp ./LICENSE.txt ./dist/LICENSE.txt;
cp ./.npmignore ./dist/.npmignore;
cp ./package.json ./dist/package.json;
mkdir -p ./dist/src/assets/;
cp ./src/assets/versionsMenu.js ./dist/src/assets/versionsMenu.js;