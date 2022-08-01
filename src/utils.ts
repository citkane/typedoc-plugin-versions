import path from 'path';
import fs from 'fs-extra';
import * as pack from '../package.json';
import { semanticGroups, versionsOptions } from './types';
import { Logger, TypeDocReader } from 'typedoc';

export function getHomeUrl() {
	if (!pack.repository || !pack.repository.url) {
		return 'https://mydocs.com/location';
	}
	const splitUrl = pack.repository.url.split('/'); 
	const gitName = splitUrl[3];
	const repoName = splitUrl[4];
	return `https://${gitName}.github.io/${repoName}`;
}
export function getPackageVersion(): string{
	!pack.version && (()=>{throw new Error('Package version was not found')})();
	return pack.version;
}
export function getMinorPackageVersion(){
	const version = getPackageVersion().split('.');
	version.pop();
	return version.join('.');
}
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

export function makeJsKeys(semGroups){
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

export function makeIndex(docRoot){
	const baseUrl = new URL(docRoot);
	const newUrl = new URL(path.join(baseUrl.pathname, 'stable'), baseUrl.origin)
	return `<meta http-equiv="refresh" content="0; url=${newUrl.href}"/>`
}

export function getPackageDirectories(oldOut): [string]{
	return fs.readdirSync(oldOut).filter(file => {
		const stats = fs.statSync(path.join(oldOut, file));
		return stats.isDirectory() && /^v[\d]+.[\d]+.[\d]+/.test(file)
	}) as [string];
}

export function makePeggedLink(rootPath: string, semGroups:semanticGroups, version: string, name: string): void {
	const stableArray = version.split('.');
	let stableSource = `v${stableArray[0]}.${stableArray[1]}.${semGroups['v'+stableArray[0]][stableArray[1]]}`;
	stableSource = path.join(rootPath, stableSource);
	const stableTarget = path.join(rootPath, name);
	fs.existsSync(stableTarget) && fs.unlinkSync(stableTarget);
	fs.createSymlinkSync(stableSource, stableTarget, 'dir')
}

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
	Object.keys(defaultOpts).forEach(key => {
		(typeof options[key] === 'undefined') && (options[key] = defaultOpts[key]);
	})
	return options
}