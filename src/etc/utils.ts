/**
 * Static function utilities for typedoc-plugin-versions
 * 
 * @module
 */

import path from 'path';
import fs from 'fs-extra';
import * as pack from '../../package.json';
import { minorVersion, patchVersion, semanticAlias, semanticGroups, version, versionsOptions } from '../types';
import { Application, Logger, TypeDocReader } from 'typedoc';

/**
 * Attempts to find the github repository location url and parse it into a github pages url. 
 * @param repository
 * @returns The github pages url or a dummy url
 */
export function getGhPageUrl(repository: {url} = pack.repository) {
	if (!repository || !repository.url) {
		return 'http://localhost:5500/docs';
	}
	const splitUrl = repository.url.split('/'); 
	const gitName = splitUrl[3];
	const repoName = splitUrl[4].split('.')[0];
	return `https://${gitName}.github.io/${repoName}`;
}

/**
 * Gets the package version defined in package.json
 * @param version
 * @returns The package version
 */
export function getPackageVersion(version: string | null = pack.version): string{
	!version && (()=>{throw new Error('Package version was not found')})();
	return version;
}

/**
 * Drops the patch from a semantic version string
 * @returns a minor version string in the for 0.0
 */
export function getMinorPackageVersion(){
	const version = getPackageVersion().split('.');
	version.pop();
	return version.join('.');
}

/**
 * Parses the root document directory for all semantically named sub-directories.
 * @param docRoot 
 * @returns an array of directories
 */
 export function getPackageDirectories(docRoot): [string]{
	return fs.readdirSync(docRoot).filter(file => {		
		const stats = fs.statSync(path.join(docRoot, file));
		return stats.isDirectory() && /^v[\d]+.[\d]+.[\d]+/.test(file)
	}) as [string];
}

/**
 * Creates groups of semantic versions with the latest patch version identified
 * @param directories an array of semantically named directories to be processed
 * @returns 
 */
export function getSemGroups(directories: [string]): semanticGroups {
	const semGroups: semanticGroups = {}
	directories.forEach(dir => {
		let [major, minor, patch] = dir.split('.') as [string, string, number];
		if (typeof patch !== 'undefined') {
			patch = patch*1;
			!semGroups[major] && (semGroups[major] = {});
			(!semGroups[major][minor] || semGroups[major][minor] < patch) &&
				(semGroups[major][minor] = patch)
		};		
	})
	return semGroups;
}

/**
 * Creates a string (of javascript) defining an array of all the versions to be included in the frontend select
 * @param semGroups 
 * @returns 
 */
export function makeJsKeys(semGroups: semanticGroups): string{
	let semVersions = [];
	Object.keys(semGroups).sort().reverse().forEach(major => {
		Object.keys(semGroups[major]).sort().reverse().forEach(minor => semVersions.push(`${major}.${minor}`));
	});
	let js = `
"use strict"

export const DOC_VERSIONS = [
	'stable',
`
	semVersions.forEach(version => {
		js += `	'${version}',\n`
	})
	js+=`	'dev'
];
`
	return js;
}

/**
 * Creates a string (of HTML) that re-directs to the 'stable' documentation url.
 * @param docRoot The root url of the documentation site
 * @returns a string of valid HTML 
 */
export function makeIndex(docRoot: string){
	const baseUrl = new URL(docRoot);
	const newUrl = new URL(path.join(baseUrl.pathname, 'stable'), baseUrl.origin)
	return `<meta http-equiv="refresh" content="0; url=${newUrl.href}"/>`
}


/**
 * Creates a symlink for the stable release 
 * @param docRoot 
 * @param semGroups 
 * @param pegVersion 
 * @param name 
 */
export function makeStableLink(docRoot: string, semGroups:semanticGroups, pegVersion: minorVersion, name: semanticAlias = 'stable'): void {
	const stableArray = pegVersion.split('.');
	if (
		typeof semGroups['v'+stableArray[0]] === 'undefined' || 
		typeof semGroups['v'+stableArray[0]][stableArray[1]] === 'undefined') {
		throw new Error(`Document directory does not exist: v${pegVersion}`);
	}
	let stableSource = `v${stableArray[0]}.${stableArray[1]}.${semGroups['v'+stableArray[0]][stableArray[1]]}`;
	stableSource = path.join(docRoot, stableSource);
	const stableTarget = path.join(docRoot, name);
	fs.existsSync(stableTarget) && fs.unlinkSync(stableTarget);
	fs.createSymlinkSync(stableSource, stableTarget, 'dir')
}

/**
 * Creates a symlink for the dev release 
 * @param docRoot 
 * @param semGroups 
 * @param pegVersion 
 * @param name 
 */
 export function makeDevLink(docRoot: string, semGroups:semanticGroups, pegVersion: patchVersion, name: semanticAlias = 'dev'): void {
	let devSource = `v${pegVersion}`;
	devSource = path.join(docRoot, devSource);
	if (!fs.existsSync(devSource)) throw new Error(`Document directory does not exist: v${pegVersion}`);
	const devTarget = path.join(docRoot, name);
	fs.existsSync(devTarget) && fs.unlinkSync(devTarget);
	fs.createSymlinkSync(devSource, devTarget, 'dir')
}


/**
 * Creates symlinks for minor versions pointing to the latest patch release
 * @param semGroups 
 * @param docRoot 
 */
export function makeMinorVersionLinks(semGroups, docRoot): void {
	Object.keys(semGroups).forEach(major => {
		Object.keys(semGroups[major]).forEach(minor => {
			const patch = semGroups[major][minor];
			const target = path.join(docRoot, `${major}.${minor}`);
			const src = path.join(docRoot, `${major}.${minor}.${patch}`);
			fs.existsSync(target) && fs.unlinkSync(target);
			fs.createSymlinkSync(src, target, 'dir');
		})
	})

}

/**
 * Workaround for [#2024](https://github.com/TypeStrong/typedoc/issues/2024)
 * @param app 
 * @returns correctly overridden options
 */
export function getVersionsOptions(app: Application): versionsOptions{
	const defaultOpts = app.options.getValue('versions') as versionsOptions;
	app.options.addReader(new TypeDocReader());
	app.options.read(new Logger());
	const options = app.options.getValue('versions') as versionsOptions;
	return {...defaultOpts, ...options };
}

export function getPaths(app, version?: patchVersion){
	const rootPath = app.options.getValue('out'); 
	return {
		rootPath,
		targetPath: path.join(rootPath, `v${getPackageVersion(version)}`)
	}
}
export function handleJeckyll(rootPath: string, targetPath: string): void{
	const srcJeckPath = path.join(targetPath, '.nojekyll');
	const targetJeckPath = path.join(rootPath, '.nojekyll');
	fs.existsSync(targetJeckPath) && fs.removeSync(targetJeckPath);
	fs.existsSync(srcJeckPath) && fs.moveSync(srcJeckPath, targetJeckPath);
}
export function handleAssets(targetPath: string){
	const sourceAsset = path.join(process.cwd(), 'src/assets/versionsMenu.js');
	fs.ensureDirSync(path.join(targetPath, 'assets'));
	fs.copyFileSync(sourceAsset, path.join(targetPath, 'assets/versionsMenu.js'));
}