import path from 'path';
import { getSemanticVersion } from '../../src/etc/utils';

export const rootDir = path.join(__dirname, '../../');
export const stubsPath = __dirname;
export const docsPath = path.join(stubsPath, 'docs');
export const stubVersions = ['v0.0.0', 'v0.1.0', 'v0.1.1', 'v0.2.3', 'v0.10.1'];
export const stubSemanticLinks = ['v0.0', 'v0.1', 'v0.2', 'v0.10'];
export const stubOptionKeys = ['stable', 'dev', 'domLocation'];
export const stubPathKeys = ['rootPath', 'targetPath'];
export const stubRootPath =
	process.platform === 'win32' ? '\\test\\stubs\\docs' : '/test/stubs/docs';
export const stubTargetPath = (version) =>
	path.join(stubRootPath, getSemanticVersion(version));

export const jsKeys = `"use strict"
export const DOC_VERSIONS = [
	'dev',
	'v0.10',
	'v0.2',
	'v0.1',
	'v0.0',
];
`;
