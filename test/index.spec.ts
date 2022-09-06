import { assert } from 'chai';
import path from 'path';
import fs from 'fs-extra';
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
			assert.equal(vUtils.getSemanticVersion('0.0.0'), 'v0.0.0');
			assert.equal(vUtils.getSemanticVersion('0.2.0'), 'v0.2.0');
			assert.equal(vUtils.getSemanticVersion('1.2.0'), 'v1.2.0');
			assert.equal(
				vUtils.getSemanticVersion('1.2.0-alpha.1'),
				'v1.2.0-alpha.1'
			);
		});
		it('retrieves minor value from package.json', function () {
			assert.match(
				vUtils.getMinorVersion(),
				minorVerRegex,
				'did not return a correctly formatted minor version'
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
		it('lists semantic versions correctly', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			assert.deepEqual(
				vUtils.getVersions(directories),
				['0.10.1', '0.2.3', '0.1.1', '0.1.0', '0.0.0'].map((x) =>
					vUtils.getSemanticVersion(x)
				),
				'did not return a correctly formatted SemVer[] array'
			);
		});
	});
	describe('creates browser assets', function () {
		it('creates a valid js string from the sematic groups', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const versions = vUtils.getVersions(directories);
			assert.equal(
				vUtils.makeJsKeys(versions, docsPath),
				jsKeys,
				'did not create a valid js string'
			);
		});
	});
	describe('infers stable and dev versions', function () {
		it('correctly interprets versions as stable or dev', function () {
			assert.equal(vUtils.getVersionAlias('v0.2.0'), 'dev');
			assert.equal(vUtils.getVersionAlias('v0.2.0-alpha.1'), 'dev');
			assert.equal(vUtils.getVersionAlias('v1.2.0-alpha.1'), 'dev');
			assert.equal(vUtils.getVersionAlias('v1.2.0'), 'stable');
		});
		it('infers stable version automatically', function () {
			assert.equal(
				vUtils.getAliasVersion('stable', 'auto', docsPath),
				vUtils.getSemanticVersion()
			);
			assert.equal(
				vUtils.getAliasVersion('stable', 'v1.0.0', docsPath),
				'v1.0.0'
			);
			assert.equal(
				vUtils.getAliasVersion('stable', 'v1.0.0-alpha.1', docsPath),
				'v1.0.0-alpha.1'
			);
		});
		it('infers dev version automatically', function () {
			assert.equal(
				vUtils.getAliasVersion('dev', 'auto', docsPath),
				vUtils.getSemanticVersion()
			);
			assert.equal(
				vUtils.getAliasVersion('dev', 'v0.2.0', docsPath),
				'v0.2.0'
			);
			assert.equal(
				vUtils.getAliasVersion('dev', 'v0.2.0-alpha.1', docsPath),
				'v0.2.0-alpha.1'
			);
		});
	});
	describe('creates symlinks', function () {
		it('creates a stable version symlink', function () {
			vUtils.makeAliasLink('stable', docsPath, 'v0.1');
			const link = path.join(docsPath, 'stable');
			assert.isTrue(
				fs.existsSync(link),
				'did not create a stable symlink'
			);
			assert.throws(() => {
				vUtils.makeAliasLink('stable', docsPath, 'v0.11');
			}, 'Document directory does not exist: v0.11');
		});
		it('creates a dev version symlink', function () {
			vUtils.makeAliasLink('dev', docsPath, 'v0.1.0');
			const link = path.join(docsPath, 'dev');
			assert.isTrue(fs.existsSync(link), 'did not create a dev symlink');
			assert.throws(() => {
				vUtils.makeAliasLink('dev', docsPath, 'v0.11.1');
			}, 'Document directory does not exist: v0.11.1');
		});
		it('creates all minor version links', function () {
			const directories = vUtils.getPackageDirectories(docsPath);
			const versions = vUtils.getVersions(directories);
			vUtils.makeMinorVersionLinks(versions, docsPath);
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
