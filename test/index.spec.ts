import { assert } from 'chai';
import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import * as vUtils from '../src/etc/utils';
import { minorVerRegex, verRegex } from '../src/etc/utils';
import {
	docsPath,
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

	describe('retrieving package version', function () {
		it('retrieves patch value from package.json', function () {
			assert.match(
				vUtils.getSemanticVersion(),
				verRegex,
				'did not provided a correctly formatted patch version'
			);
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
				['v0.0.0', 'v0.1.0', 'v0.1.1', 'v0.10.1', 'v0.2.3'],
				'did not retrieve all semanticly named directories'
			);
		});
		it('lists semantic versions correctly with highest patch', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			assert.deepEqual(
				vUtils.getSemVers(directories),
				['0.10.1', '0.2.3', '0.1.1', '0.0.0'].map((x) =>
					semver.parse(x, true)
				),
				'did not return a correctly formatted SemVer[] array'
			);
		});
	});
	describe('creates browser assets', function () {
		it('creates a valid js string from the sematic groups', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semVers = vUtils.getSemVers(directories);
			assert.equal(
				vUtils.makeJsKeys(semVers),
				jsKeys,
				'did not create a valid js string'
			);
		});
	});
	describe('creates symlinks', function () {
		it('creates a stable version symlink', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semVers = vUtils.getSemVers(directories);
			vUtils.makeStableLink(docsPath, semVers, 'v0.1');
			const link = path.join(docsPath, 'stable');
			assert.isTrue(
				fs.existsSync(link),
				'did not create a stable symlink'
			);
			assert.isTrue(
				/test[/|\\]stubs[/|\\]docs[/|\\]v0.1.[1$|1/$|1\\$]/.test(
					fs.readlinkSync(link)
				),
				'did not link the stable symlink correctly'
			);
			assert.throws(() => {
				vUtils.makeStableLink(docsPath, semVers, 'v0.11');
			}, 'Document directory does not exist: v0.11');
		});
		it('creates a dev version symlink', function () {
			vUtils.makeDevLink(docsPath, 'v0.1.0');
			const link = path.join(docsPath, 'dev');
			assert.isTrue(fs.existsSync(link), 'did not create a dev symlink');
			assert.isTrue(
				/test[/|\\]stubs[/|\\]docs[/|\\]v0.1.[0$|0/$|0\\$]/.test(
					fs.readlinkSync(link)
				),
				'did not link the dev symlink correctly'
			);
			assert.throws(() => {
				vUtils.makeDevLink(docsPath, 'v0.11.1');
			}, 'Document directory does not exist: v0.11.1');
		});
		it('creates all minor version links', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const semVers = vUtils.getSemVers(directories);
			vUtils.makeMinorVersionLinks(semVers, docsPath);
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
		const version = 'v0.0.0';
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
