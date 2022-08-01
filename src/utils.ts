/**
 * Static function utilities for typedoc-plugin-versions
 * 
 * @module
 */

import path from 'path';
import fs from 'fs-extra';
import * as pack from '../package.json';
import { semanticGroups, versionsOptions } from './types';
import { Logger, TypeDocReader } from 'typedoc';

/**
 * Attempts to find the github repository location url and parse it into a github pages url. 
 * @param repository
 * @returns The github pages url or a dummy url
 */
export function getGhPageUrl(repository: {url} = pack.repository) {
	if (!repository || !repository.url) {
		return 'http://localhost:5500/docs';
	}
	const splitUrl = pack.repository.url.split('/'); 
	const gitName = splitUrl[3];
	const repoName = splitUrl[4];
	return `https://${gitName}.github.io/${repoName}`;
}

/**
 * Gets the package version defined in package.json
 * @param version
 * @returns The package version
 */
export function getPackageVersion(version: string = pack.version): string{
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
			console.log(major, minor, patch);
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
export function makeIndex(docRoot){
	const baseUrl = new URL(docRoot);
	const newUrl = new URL(path.join(baseUrl.pathname, 'stable'), baseUrl.origin)
	return `<meta http-equiv="refresh" content="0; url=${newUrl.href}"/>`
}

/**
 * Parses the root document directory for all semantically named sub-directories.
 * @param oldOut 
 * @returns an array of directories
 */
export function getPackageDirectories(oldOut): [string]{
	return fs.readdirSync(oldOut).filter(file => {
		const stats = fs.statSync(path.join(oldOut, file));
		return stats.isDirectory() && /^v[\d]+.[\d]+.[\d]+/.test(file)
	}) as [string];
}

/**
 * Creates a symlink for a non-semantically named alias release 
 * @param rootPath 
 * @param semGroups 
 * @param version 
 * @param name 
 */
export function makePeggedLink(rootPath: string, semGroups:semanticGroups, version: string, name: string): void {
	const stableArray = version.split('.');
	let stableSource = `v${stableArray[0]}.${stableArray[1]}.${semGroups['v'+stableArray[0]][stableArray[1]]}`;
	stableSource = path.join(rootPath, stableSource);
	const stableTarget = path.join(rootPath, name);
	fs.existsSync(stableTarget) && fs.unlinkSync(stableTarget);
	fs.createSymlinkSync(stableSource, stableTarget, 'dir')
}

/**
 * Creates symlinks for minor versions pointing to the latest patch release
 * @param semGroups 
 * @param rootPath 
 */
export function makeMinorVersionLinks(semGroups, rootPath): void {
	Object.keys(semGroups).forEach(major => {
		Object.keys(semGroups[major]).forEach(minor => {
			const patch = semGroups[major][minor];
			const target = path.join(rootPath, `${major}.${minor}`);
			const src = path.join(rootPath, `${major}.${minor}.${patch}`);
			console.log(src, target);

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
export function bugWorkaround(app): versionsOptions{
	const defaultOpts = app.options.getValue('versions') as versionsOptions;
	app.options.addReader(new TypeDocReader());
	app.options.read(new Logger());
	const options = app.options.getValue('versions') as versionsOptions;
	return {...defaultOpts, ...options };
}