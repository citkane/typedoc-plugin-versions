/**
 * Static function utilities for typedoc-plugin-versions
 *
 * @module
 */

import path from 'path';
import fs from 'fs-extra';
import semver, { SemVer } from 'semver';
import { version, semanticAlias, versionsOptions } from '../types';
import { Application, Logger, TypeDocReader } from 'typedoc';
const packagePath = path.join(process.cwd(), 'package.json');
const pack = fs.readJSONSync(packagePath);

/**
 * Gets the package version defined in package.json
 * @param version
 * @returns The package version
 * @todo grab potential labels from the version and provide them as further pegs in the menu.
 */
export function getSemanticVersion(version: string = pack.version): version {
	!version &&
		(() => {
			throw new Error('Package version was not found');
		})();

	const semVer = semver.coerce(version, { loose: true });

	if (!semVer) {
		throw new Error(`version is not semantically formatted: ${version}`);
	}

	return `v${semVer.version}`;
}

/**
 * Drops the patch from a semantic version string
 * @returns a minor version string in the for 0.0
 */
export function getMinorVersion(version?: string): version {
	version = getSemanticVersion(version);

	const { major, minor } = semver.coerce(version, { loose: true });
	return `v${major}.${minor}`;
}

/**
 * Parses the root document directory for all semantically named sub-directories.
 * @param docRoot
 * @returns an array of directories
 */
export function getPackageDirectories(docRoot: string): string[] {
	return fs.readdirSync(docRoot).filter((file) => {
		const stats = fs.statSync(path.join(docRoot, file));
		return stats.isDirectory() && semver.valid(file, true) !== null;
	}) as string[];
}

/**
 * Creates groups of semantic versions with the latest patch version identified
 * @param directories an array of semantically named directories to be processed
 * @returns
 */
export function getSemVers(directories: string[]): SemVer[] {
	return directories
		.map((dir) => semver.coerce(dir, { loose: true })) // parse directory names to SemVer instances (convert to (SemVer | null)[])
		.filter((v) => v instanceof SemVer) // discard nulls (convert to SemVer[])
		.sort(semver.rcompare) // sort in descending order
		.filter(
			// only include highest patch number per major.minor version & ensure each entry is unique
			(value, index, self) =>
				self.indexOf(
					self.find((x) =>
						semver.satisfies(x, `${value.major}.${value.minor}.x`)
					)
				) === index && self.indexOf(value) === index
		);
}

/**
 * Creates a string (of javascript) defining an array of all the versions to be included in the frontend select
 * @param semVers
 * @returns
 */
export function makeJsKeys(semVers: SemVer[]): string {
	let js = `
"use strict"

export const DOC_VERSIONS = [
	'stable',
`;
	for (const version of semVers.map((v) => getMinorVersion(v.version))) {
		js += `	'${version}',\n`;
	}
	js += `	'dev'
];
`;
	return js;
}

/**
 * Creates a symlink for the stable release
 * @param docRoot
 * @param semVers
 * @param pegVersion
 * @param name
 */
export function makeStableLink(
	docRoot: string,
	semVers: SemVer[],
	pegVersion: version,
	name: semanticAlias = 'stable'
): void {
	pegVersion = getMinorVersion(pegVersion);

	const version = semver.coerce(pegVersion, { loose: true });
	const srcVer = semVers.find((v) =>
		semver.satisfies(v, `${version.major}.${version.minor}.x`)
	);

	if (!srcVer) {
		throw new Error(`Document directory does not exist: ${pegVersion}`);
	}

	const stableSource = path.join(docRoot, getSemanticVersion(srcVer.version));
	const stableTarget = path.join(docRoot, name);
	fs.existsSync(stableTarget) && fs.unlinkSync(stableTarget);
	fs.ensureSymlinkSync(stableSource, stableTarget, 'junction');
}

/**
 * Creates a symlink for the dev release
 * @param docRoot
 * @param pegVersion
 * @param name
 */
export function makeDevLink(
	docRoot: string,
	pegVersion: version,
	name: semanticAlias = 'dev'
): void {
	pegVersion = getSemanticVersion(pegVersion);
	const devSource = path.join(docRoot, pegVersion);

	if (!fs.existsSync(devSource))
		throw new Error(`Document directory does not exist: ${pegVersion}`);
	const devTarget = path.join(docRoot, name);
	fs.existsSync(devTarget) && fs.unlinkSync(devTarget);
	fs.ensureSymlinkSync(devSource, devTarget, 'junction');
}

/**
 * Creates symlinks for minor versions pointing to the latest patch release
 * @param semGroups
 * @param docRoot
 */
export function makeMinorVersionLinks(
	semVers: SemVer[],
	docRoot: string
): void {
	for (const v of semVers) {
		const target = path.join(docRoot, getMinorVersion(v.version));
		const src = path.join(docRoot, getSemanticVersion(v.version));
		fs.existsSync(target) && fs.unlinkSync(target);
		fs.ensureSymlinkSync(src, target, 'junction');
	}
}

/**
 * Workaround for [#2024](https://github.com/TypeStrong/typedoc/issues/2024)
 * @param app
 * @returns correctly overridden options
 */
export function getVersionsOptions(app: Application): versionsOptions {
	const defaultOpts = app.options.getValue('versions') as versionsOptions;
	app.options.addReader(new TypeDocReader());
	app.options.read(new Logger());
	const options = app.options.getValue('versions') as versionsOptions;
	return { ...defaultOpts, ...options };
}

/**
 * Resolve the root document path and document build path
 * @param app
 * @param version
 * @returns the paths
 */
export function getPaths(app, version?: version) {
	const defaultRootPath = path.join(process.cwd(), 'docs');
	const rootPath = app.options.getValue('out') || defaultRootPath;
	return {
		rootPath,
		targetPath: path.join(rootPath, getSemanticVersion(version)),
	};
}

/**
 * Moves .nojeckyll flag file to the documentation root folder
 * @param rootPath
 * @param targetPath
 */
export function handleJeckyll(rootPath: string, targetPath: string): void {
	const srcJeckPath = path.join(targetPath, '.nojekyll');
	const targetJeckPath = path.join(rootPath, '.nojekyll');
	fs.existsSync(targetJeckPath) && fs.removeSync(targetJeckPath);
	fs.existsSync(srcJeckPath) && fs.moveSync(srcJeckPath, targetJeckPath);
}

/**
 * Copies static assets to the document build folder
 * @param targetPath
 */
export function handleAssets(targetPath: string, srcDir: string = __dirname) {
	const sourceAsset = path.join(srcDir, '../assets/versionsMenu.js');
	fs.ensureDirSync(path.join(targetPath, 'assets'));
	fs.copyFileSync(
		sourceAsset,
		path.join(targetPath, 'assets/versionsMenu.js')
	);
}

/**
 * Regex for matching semantic patch version
 */
export const verRegex = /^(v\d+|\d+).\d+.\d+/;
/**
 * regex for matching semantic minor version
 */
export const minorVerRegex = /^(v\d+|\d+).\d+$/;
