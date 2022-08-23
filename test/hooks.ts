process.env.Node = 'test';

import sinon from 'sinon';
import fs from 'fs-extra';
import path from 'path';
import { docsPath, stubVersions } from './stubs/stubs';

sinon.stub(console, 'error');
sinon.stub(console, 'warn');
sinon.stub(console, 'log');

export const mochaHooks = {
	beforeAll(done) {
		deleteFolders([docsPath]);
		fs.mkdirSync(docsPath);
		stubVersions.forEach((version) => {
			fs.mkdirSync(path.join(docsPath, version));
		});
		done();
	},
	beforeEach(done) {
		done();
	},
	afterEach(done) {
		sinon.restore();
		sinon.stub(console, 'error');
		sinon.stub(console, 'warn');
		sinon.stub(console, 'log');
		done();
	},
	afterAll(done) {
		deleteFolders([docsPath]);
		done();
	},
};

const deleteFolders = (folders: string[]) => {
	folders.forEach((folder) => {
		fs.existsSync(folder) && fs.rmdirSync(folder, { recursive: true });
	});
};
