/**
 * Static function utilities for typedoc-plugin-versions
 *
 * @module
 */

import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
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
	if (!version) {
		throw new Error('Package version was not found');
	}

	const semVer = semver.coerce(version, { loose: true });
	if (!semVer) {
		throw new Error(`version is not semantically formatted: ${version}`);
	}

	// ensure prerelease info remains appended
	const prerelease = semver.prerelease(version, true);
	return prerelease
		? `v${semVer.version}-${semver.prerelease(version, true).join('.')}`
		: `v${semVer.version}`;
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
 * Gets a list of semantic versions from a list of directories, sorted in descending order.
 * @param directories An array of semantically named directories to be processed
 * @returns An array of {@link version versions}, sorted in descending order.
 */
export function getVersions(directories: string[]): version[] {
	return directories
		.filter((dir) => semver.coerce(dir, { loose: true }))
		.map((dir) => getSemanticVersion(dir))
		.sort(semver.rcompare);
}

/**
 * Creates a string (of javascript) defining an array of all the versions to be included in the frontend select
 * @param versions
 * @param docRoot
 * @param [stable='auto'] The version set in the options for the 'dev' alias.
 * @param [dev='auto'] The version set in the options for the 'dev' alias.
 * @returns
 */
export function makeJsKeys(
	versions: version[],
	docRoot: string,
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): string {
	const stableVer = getSymlinkVersion('stable', docRoot);
	const devVer = getSymlinkVersion('dev', docRoot);
	const alias = getVersionAlias(stableVer, stable, dev);
	const keys = [
		alias, // add initial key (stable or dev)
		...versions // add the major.minor versions
			.map((v) => getMinorVersion(v))
			.filter((v, i, s) => s.indexOf(v) === i),
	];
	if (
		alias !== 'dev' && // initial key is not dev
		((dev !== 'auto' && devVer === getSemanticVersion(dev)) || // explicit dev version
			semver.lt(stableVer, devVer, true)) // dev version newer than stable
	) {
		keys.push('dev');
	}
	// finally, create the js string
	const lines = [
		'"use strict"',
		'export const DOC_VERSIONS = [',
		...keys.map((v) => `	'${v}',`),
		'];',
	];
	return lines.join('\n').concat('\n');
}

/**
 * Creates a symlink for an alias
 * @param alias
 * @param docRoot
 * @param pegVersion
 */
export function makeAliasLink(
	alias: semanticAlias,
	docRoot: string,
	pegVersion: version
): void {
	pegVersion = getSemanticVersion(pegVersion);
	const stableSource = path.join(docRoot, pegVersion);

	if (!fs.existsSync(stableSource))
		throw new Error(`Document directory does not exist: ${pegVersion}`);
	const stableTarget = path.join(docRoot, alias);
	fs.existsSync(stableTarget) && fs.unlinkSync(stableTarget);
	fs.ensureSymlinkSync(stableSource, stableTarget, 'junction');
}

/**
 * Creates symlinks for minor versions pointing to the latest patch release
 * @param semGroups
 * @param docRoot
 */
export function makeMinorVersionLinks(
	versions: version[],
	docRoot: string,
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): void {
	for (const version of versions
		// get highest patch per version
		.map((version) => {
			// prefer stable where available
			const highestStablePatch = versions.find(
				(v) =>
					getVersionAlias(v, stable, dev) === 'stable' &&
					semver.satisfies(
						v,
						`${semver.major(version)}.${semver.minor(version)}.x`,
						{ includePrerelease: true }
					)
			);
			// fallback to highest patch
			return (
				highestStablePatch ??
				versions.find((v) =>
					semver.satisfies(
						v,
						`${semver.major(version)}.${semver.minor(version)}.x`,
						{ includePrerelease: true }
					)
				)
			);
		})
		// filter to unique values
		.filter((v, i, s) => s.indexOf(v) === i)) {
		const target = path.join(docRoot, getMinorVersion(version));
		const src = path.join(docRoot, version);
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
export function getPaths(app: Application, version?: version) {
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
 * Gets the {@link semanticAlias alias} of the given version, e.g. 'stable' or 'dev'.
 * @remarks
 * Versions {@link https://semver.org/#spec-item-4 lower than 1.0.0} or
 * {@link https://semver.org/#spec-item-9 with a pre-release label} (e.g. 1.0.0-alpha.1)
 * will be considered 'dev'. All other versions will be considered 'stable'.
 * @param [version] Defaults to the version from `package.json`
 * @param [stable='auto'] The version set in the typedoc options for the 'stable' alias.
 * @param [dev='auto'] The version set in the options for the 'dev' alias.
 * @returns The {@link semanticAlias alias} of the given version.
 */
export function getVersionAlias(
	version?: string,
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): semanticAlias {
	version = getSemanticVersion(version);
	if (stable !== 'auto' && version === getSemanticVersion(stable))
		// version is marked as stable by user
		return 'stable';
	else if (dev !== 'auto' && version === getSemanticVersion(dev))
		// version is marked as dev by user
		return 'dev';
	// semver.satisfies() automatically filters out prerelease versions by default
	else return semver.satisfies(version, '>=1.0.0', true) ? 'stable' : 'dev';
}

/**
 * Automatically parses the version number for a given {@link semanticAlias alias} based on
 * typedoc options.
 * @param alias The alias to parse, e.g. 'stable' or 'dev'.
 * @param version The version set in the typedoc options for the alias.
 * @param docRoot The path to the docs root.
 * @param [stable='auto'] The version set in the typedoc options for the 'stable' alias.
 * @param [dev='auto'] The version set in the options for the 'dev' alias.
 * @returns The automatically parsed version number which should be used for the given alias.
 */
export function getAliasVersion(
	alias: semanticAlias,
	version: 'auto' | version,
	docRoot: string,
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): version {
	if (version !== 'auto') {
		return getSemanticVersion(version); // user has explicitly specified a version, use it
	}

	// no explicit version set for alias, check if package version is a match
	const packageVersion = getSemanticVersion();
	if (getVersionAlias(packageVersion, stable, dev) === alias) {
		// package version matches the alias
		return packageVersion;
	}

	// package version is not a match, check symlink for alias
	const symlinkVersion = getSymlinkVersion(alias, docRoot);
	if (
		symlinkVersion &&
		getVersionAlias(symlinkVersion, stable, dev) === alias &&
		(alias === 'stable' || semver.lt(packageVersion, symlinkVersion))
	) {
		// version symlinked alias is pointing to is a match
		return symlinkVersion;
	}

	// no matches found, fall back to the package version
	return packageVersion;
}

/**
 * Gets the {@link version} a given symlink is pointing to.
 * @param symlink The symlink path, relative to {@link docRoot}.
 * @param docRoot The path to the docs root.
 * @returns The version number parsed from the given symlink.
 */
export function getSymlinkVersion(symlink: string, docRoot: string): version {
	const symlinkPath = path.join(docRoot, symlink);
	if (
		fs.existsSync(symlinkPath) &&
		fs.lstatSync(symlinkPath).isSymbolicLink()
	) {
		// retrieve the version the symlink is pointing to
		const targetPath = fs.readlinkSync(symlinkPath);
		return getSemanticVersion(path.basename(targetPath));
	}
}

/**
 * Regex for matching semantic patch version
 */
export const verRegex = /^(v\d+|\d+).\d+.\d+/;
/**
 * regex for matching semantic minor version
 */
export const minorVerRegex = /^(v\d+|\d+).\d+$/;
