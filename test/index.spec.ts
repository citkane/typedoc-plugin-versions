import { assert } from 'chai';
import path from 'path';
import fs from 'fs-extra';
import * as vUtils from '../src/etc/utils';
import { minorVerRegex, verRegex } from '../src/etc/utils';
import {
	docsPath,
	htmlRedirect,
	jsKeys,
	stubOptionKeys,
	stubPathKeys,
	stubRootPath,
	stubSemanticLinks,
	stubTargetPath,
} from './stubs/stubs';
import { Application } from 'typedoc';
import { load } from '../src/index';
describe('Unit testing for typedoc-plugin-versions', function () {
	it('loads and parses options', function () {
		const app = new Application();
		const options = load(app);
		assert.hasAllKeys(
			options,
			stubOptionKeys,
			'did not parse all "versions" custom options'
		);
	});

	describe('parsing for documentation root url', function () {
		it('parses git url to gh-page url', function () {
			assert.equal(
				vUtils.getGhPageUrl({
					url: 'git+https://github.com/username/repository.git',
				}),
				'https://username.github.io/repository',
				'did not parse gh-pages url correctly'
			);
		});
		it('provides a default document url if none given', function () {
			assert.equal(
				vUtils.getGhPageUrl({ url: null }),
				'http://localhost:5500/docs',
				'did not provide a default document url'
			);
		});
	});
	describe('retrieving package version', function () {
		it('retrieves patch value from package.json', function () {
			assert.match(
				vUtils.getSemanticVersion(),
				verRegex,
				'did not provided a correctly formatted patch version'
			);
		});
		it('throws error if version not defined', function () {
			assert.throws(() => {
				vUtils.getSemanticVersion(null);
			}, 'Package version was not found');
		});
		it('retrieves minor value from package.json', function () {
			assert.match(
				vUtils.getMinorVersion(),
				minorVerRegex,
				'did not return a correctly formatted minor version'
			);
		});
		it('discards patch from semantic version string', function () {
			assert.match(
				vUtils.getSemanticVersion('v11.10.09-label'),
				verRegex,
				'did not strip the label from version string'
			);
		});
	});
	describe('parses and processes directories', function () {
		it('retrieves semantically named directories into a list', function () {
			assert.deepEqual(
				vUtils.getPackageDirectories(docsPath),
				['v0.0.0', 'v0.1.0', 'v0.1.1'],
				'did not retrieve all semanticly named directories'
			);
		});
		it('groups semantic versions correctly with highest patch', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			assert.deepEqual(
				vUtils.getSemGroups(directories),
				{
					v0: {
						'0': 0,
						'1': 1,
					},
				},
				'did not return a correctly formatted semantic group object'
			);
		});
	});
	describe('creates browser assets', function () {
		it('creates a valid js string from the sematic groups', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semGroups = vUtils.getSemGroups(directories);
			assert.equal(
				vUtils.makeJsKeys(semGroups),
				jsKeys,
				'did not create a valid js string'
			);
		});
		it('creates a redirect string for index.html', function () {
			const url = vUtils.getGhPageUrl({ url: null });
			assert.equal(
				vUtils.makeIndex(url),
				htmlRedirect,
				'did not create a valid htm redirect string'
			);
		});
	});
	describe('creates symlinks', function () {
		it('creates a stable version symlink', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semGroups = vUtils.getSemGroups(directories);
			vUtils.makeStableLink(docsPath, semGroups, '0.1');
			const link = path.join(docsPath, 'stable');
			assert.isTrue(
				fs.existsSync(link),
				'did not create a stable symlink'
			);
			assert.isTrue(
				fs.readlinkSync(link).endsWith('test/stubs/docs/v0.1.1'),
				'did not link the stable symlink correctly'
			);
			assert.throws(() => {
				vUtils.makeStableLink(docsPath, semGroups, '0.11');
			}, 'Document directory does not exist: v0.11');
		});
		it('creates a dev version symlink', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semGroups = vUtils.getSemGroups(directories);
			vUtils.makeDevLink(docsPath, semGroups, '0.1.0');
			const link = path.join(docsPath, 'dev');
			assert.isTrue(fs.existsSync(link), 'did not create a dev symlink');
			assert.isTrue(
				fs.readlinkSync(link).endsWith('test/stubs/docs/v0.1.0'),
				'did not link the dev symlink correctly'
			);
			assert.throws(() => {
				vUtils.makeDevLink(docsPath, semGroups, '0.11.1');
			}, 'Document directory does not exist: v0.11.1');
		});
		it('creates all minor version links', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semGroups = vUtils.getSemGroups(directories);
			vUtils.makeMinorVersionLinks(semGroups, docsPath);
			stubSemanticLinks.forEach((link) => {
				const linkPath = path.join(docsPath, link);
				assert.isTrue(
					fs.existsSync(linkPath),
					`did not create a symlink for ${link}`
				);
			});
		});
	});
	describe('handle file operations correctly', function () {
		const app = new Application();
		const version = '0.0.0';
		app.options.setValue('out', docsPath);
		const dirs = vUtils.getPaths(app, version);
		it('maps correct output paths', function () {
			assert.hasAllKeys(
				dirs,
				stubPathKeys,
				'not all directories returned'
			);
			assert.isTrue(
				dirs.rootPath.endsWith(stubRootPath),
				'root path not resolved correctly'
			);
			assert.isTrue(
				dirs.targetPath.endsWith(stubTargetPath(version)),
				'target path not resolved correctly'
			);
		});
		it('does not error if .nojekyll is not present', function () {
			assert.doesNotThrow(() => {
				vUtils.handleJeckyll(dirs.rootPath, dirs.targetPath);
			});
		});
		it('copies .nojekyll to the document root if exists', function () {
			fs.createFileSync(path.join(dirs.targetPath, '.nojekyll'));
			vUtils.handleJeckyll(dirs.rootPath, dirs.targetPath);
			assert.isTrue(
				fs.existsSync(path.join(dirs.rootPath, '.nojekyll')),
				'did not move .nojekyll'
			);
		});
		it('copies static assets into the target version folder', function () {
			vUtils.handleAssets(dirs.targetPath);
			assert.isTrue(
				fs.existsSync(
					path.join(dirs.targetPath, 'assets/versionsMenu.js')
				)
			);
		});
	});
});
