// eslint-disable-next-line no-undef
const fs = require('fs-extra');

fs.copyFileSync('./README.md', './dist/README.md');
fs.copyFileSync('./LICENSE.txt', './dist/LICENSE.txt');
fs.copyFileSync('./.npmignore', './dist/.npmignore');
fs.copyFileSync('./package.json', './dist/package.json');
fs.ensureDirSync('./dist/src/assets/');
fs.copyFileSync(
	'./src/assets/versionsMenu.js',
	'./dist/src/assets/versionsMenu.js'
);
