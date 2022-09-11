/**
 * Static function utilities for typedoc-plugin-versions
 *
 * @module
 */

import path from 'path';
import fs from 'fs-extra';
import semver from 'semver';
import { version, semanticAlias, versionsOptions, metadata } from '../types';
import { Application, Logger, TypeDocReader } from 'typedoc';
const packagePath = path.join(process.cwd(), 'package.json');
const pack = fs.readJSONSync(packagePath);

/**
 * Gets the docs metadata file path.
 * @param docRoot The path to the docs root.
 * @returns The metadata file path.
 */
export function getMetadataPath(docRoot: string): string {
	return path.join(docRoot, '.typedoc-plugin-versions');
}

/**
 * Loads the docs metadata file and retreives its data.
 * @param docRoot The path to the docs root.
 * @returns An object containing the docs metadata.
 */
export function loadMetadata(docRoot: string): metadata {
	try {
		return fs.readJsonSync(getMetadataPath(docRoot));
	} catch {
		return {};
	}
}

/**
 * Audits and updates a given {@link metadata} object.
 * @param metadata The metadata to refresh.
 * @param docRoot The path to the docs root.
 * @param [stable='auto'] The {@link version} set in the typedoc options for the 'stable' alias.
 * @param [dev='auto'] The {@link version} set in the options for the 'dev' alias.
 * @returns The refreshed {@link metadata}.
 */
export function refreshMetadata(
	metadata: metadata,
	docRoot: string,
	stable = 'auto',
	dev = 'auto'
): metadata {
	const validate = (v: string) => (v === 'auto' ? v : getSemanticVersion(v));
	const vStable = validate(stable);
	const vDev = validate(dev);

	const versions = refreshMetadataVersions(
		[...(metadata.versions ?? []), metadata.stable, metadata.dev],
		docRoot
	);

	return {
		versions,
		stable: refreshMetadataAlias('stable', versions, vStable, vDev),
		dev: refreshMetadataAlias('dev', versions, vStable, vDev),
	};
}

/**
 * Audits an array of {@link version versions}, ensuring they all still exist, and adds newly found {@link version versions} to the array.
 * @param versions The array of {@link version versions} to refresh.
 * @param docRoot The path to the docs root.
 * @returns A distinct array of {@link version versions}, sorted in descending order.
 */
export function refreshMetadataVersions(versions: version[], docRoot: string) {
	return (
		[
			// metadata versions
			...versions
				// filter down to directories that still exist
				.filter((version) => {
					try {
						const vPath = path.join(docRoot, version);
						return (
							fs.pathExistsSync(vPath) &&
							fs.statSync(vPath).isDirectory() &&
							semver.valid(version, true) !== null
						);
					} catch {
						return false; // discard undefined values
					}
				})
				// ensure consistent format
				.map((version) => getSemanticVersion(version)),

			// also include any other semver directories that exist in docs
			...getVersions(getPackageDirectories(docRoot)),

			// package.json version
			getSemanticVersion(),

			// stable and dev symlinks
			getSymlinkVersion('stable', docRoot),
			getSymlinkVersion('dev', docRoot),
		]
			// discard undefined && filter to unique values only
			.filter((v, i, s) => v !== undefined && s.indexOf(v) === i)
			// sort in descending order
			.sort(semver.rcompare)
	);
}

/**
 * Refreshes a version {@link semanticAlias alias} (e.g. 'stable' or 'dev').
 * @param alias The {@link semanticAlias alias} to refresh.
 * @param versions An array of known, valid {@link version versions}.
 * @param [stable='auto'] The {@link version} set in the typedoc options for the 'stable' {@link semanticAlias alias}.
 * @param [dev='auto'] The {@link version} set in the options for the 'dev' {@link semanticAlias alias}.
 * @returns The refreshed {@link version} the {@link semanticAlias alias} should point to, or undefined if no match was found.
 */
export function refreshMetadataAlias(
	alias: semanticAlias,
	versions: version[],
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): version {
	const option = alias === 'stable' ? stable : dev;
	if (
		option && // the option is set
		option !== 'auto' && // option is not 'auto'
		versions.includes(getSemanticVersion(option)) // the version set in the option exists in the known versions
	) {
		return getSemanticVersion(option); // user has explicitly specified a valid version, use it
	} else {
		const latest = getLatestVersion(alias, versions, stable, dev); // in auto mode, get latest version for the alias
		if (
			latest &&
			(alias !== 'dev' ||
				!getLatestVersion('stable', versions, stable, dev) ||
				semver.gte(
					latest,
					getLatestVersion('stable', versions, stable, dev),
					true
				))
		) {
			return getSemanticVersion(latest);
		}
	}
}

/**
 * Saves a given {@link metadata} object to disk.
 * @param metadata The {@link metadata} object.
 * @param docRoot The path to the docs root.
 */
export function saveMetadata(metadata: metadata, docRoot: string): void {
	fs.writeJsonSync(getMetadataPath(docRoot), metadata);
}

/**
 * Gets the latest valid {@link version} for a given {@link semanticAlias alias}.
 * @param alias The {@link semanticAlias alias}.
 * @param versions An array of known, valid {@link version versions}.
 * @param [stable='auto'] The {@link version} set in the typedoc options for the 'stable' {@link semanticAlias alias}.
 * @param [dev='auto'] The {@link version} set in the options for the 'dev' {@link semanticAlias alias}.
 * @returns The latest matching {@link version}, or undefined if no match was found.
 */
export function getLatestVersion(
	alias: semanticAlias,
	versions: version[],
	stable: 'auto' | version = 'auto',
	dev: 'auto' | version = 'auto'
): version {
	return [...versions]
		.sort(semver.rcompare)
		.find((v) => getVersionAlias(v, stable, dev) === alias);
}

/**
 * Gets the {@link semanticAlias alias} of the given version, e.g. 'stable' or 'dev'.
 * @remarks
 * Versions {@link https://semver.org/#spec-item-4 lower than 1.0.0} or
 * {@link https://semver.org/#spec-item-9 with a pre-release label} (e.g. 1.0.0-alpha.1)
 * will be considered 'dev'. All other versions will be considered 'stable'.
 * @param [version] Defaults to the version from `package.json`
 * @param [stable='auto'] The {@link version} set in the typedoc options for the 'stable' alias.
 * @param [dev='auto'] The {@link version} set in the options for the 'dev' alias.
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
 * Gets the package version defined in package.json
 * @param version
 * @returns The package version
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
		const filePath = path.join(docRoot, file);
		return (
			fs.pathExistsSync(filePath) &&
			fs.statSync(filePath).isDirectory() &&
			semver.valid(file, true) !== null
		);
	}) as string[];
}

/**
 * Gets a list of semantic versions from a list of directories.
 * @param directories An array of semantically named directories to be processed
 * @returns An array of {@link version versions}
 */
export function getVersions(directories: string[]): version[] {
	return directories
		.filter((dir) => semver.coerce(dir, { loose: true }))
		.map((dir) => getSemanticVersion(dir));
}

/**
 * Creates a string (of javascript) defining an array of all the versions to be included in the frontend select
 * @param metadata
 * @returns
 */
export function makeJsKeys(metadata: metadata): string {
	const alias = metadata.stable ? 'stable' : 'dev';
	const keys = [
		alias, // add initial key (stable or dev)
		...metadata.versions // add the major.minor versions
			.map((v) => getMinorVersion(v))
			.filter((v, i, s) => s.indexOf(v) === i),
	];
	if (alias !== 'dev' && metadata.dev) {
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

	if (!fs.pathExistsSync(stableSource))
		throw new Error(`Document directory does not exist: ${pegVersion}`);
	const stableTarget = path.join(docRoot, alias);
	if (fs.lstatSync(stableTarget, { throwIfNoEntry: false })?.isSymbolicLink())
		fs.unlinkSync(stableTarget);
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
		if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink())
			fs.unlinkSync(target);
		fs.ensureSymlinkSync(src, target, 'junction');
	}
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
		fs.pathExistsSync(symlinkPath) &&
		fs.lstatSync(symlinkPath).isSymbolicLink()
	) {
		const targetPath = fs.readlinkSync(symlinkPath);
		if (
			fs.pathExistsSync(targetPath) &&
			fs.statSync(targetPath).isDirectory()
		) {
			// retrieve the version the symlink is pointing to
			return getSemanticVersion(path.basename(targetPath));
		}
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
 * Regex for matching semantic patch version
 */
export const verRegex = /^(v\d+|\d+).\d+.\d+/;
/**
 * regex for matching semantic minor version
 */
export const minorVerRegex = /^(v\d+|\d+).\d+$/;
