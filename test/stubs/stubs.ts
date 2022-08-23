import path from 'path';
import { getSemanticVersion as getSemanticVersion } from '../../src/etc/utils';

export const stubsPath = __dirname;
export const docsPath = path.join(stubsPath, 'docs');
export const stubVersions = ['v0.0.0', 'v0.1.0', 'v0.1.1'];
export const stubSemanticLinks = ['v0.0', 'v0.1'];
export const stubOptionKeys = ['stable', 'dev', 'homeUrl', 'domLocation'];
export const stubPathKeys = ['rootPath', 'targetPath'];
export const stubRootPath = '/test/stubs/docs';
export const stubTargetPath = (version) =>
	path.join(stubRootPath, getSemanticVersion(version));

export const jsKeys = `
"use strict"

export const DOC_VERSIONS = [
	'stable',
	'v0.1',
	'v0.0',
	'dev'
];
`;

export const htmlRedirect =
	'<meta http-equiv="refresh" content="0; url=http://localhost:5500/docs/stable"/>';
