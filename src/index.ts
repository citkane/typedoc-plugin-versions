/**
 * Entry point for typedoc-plugin-versions
 *
 * @module
 */

import { Application, Logger, ParameterType, RendererEvent } from 'typedoc';

import path from 'path';
import fs from 'fs-extra';
import * as vUtils from './etc/utils';
import * as vHooks from './etc/hooks';
import { validLocation, versionsOptions } from './types';
export * from './types';

/**
 * The default Typedoc [plugin hook](https://typedoc.org/guides/development/#plugins).
 * @param app
 */
export function load(app: Application) {
	app.options.addDeclaration({
		help: 'Options for typedoc-plugin-versions',
		name: 'versions',
		type: ParameterType.Mixed,
		defaultValue: {
			stable: vUtils.getMinorVersion(),
			dev: vUtils.getSemanticVersion(),
			domLocation: 'false',
		} as versionsOptions,
	});

	const vOptions = vUtils.getVersionsOptions(app) as versionsOptions;

	vHooks.injectSelectJs(app);
	vHooks.injectSelectHtml(app, vOptions.domLocation as validLocation);

	const { rootPath, targetPath } = vUtils.getPaths(app);

	/**
	 * This is the latest moment possible to inject the modified 'out' location
	 * before typedoc freezes the options.
	 */
	const originalReadOptions = app.options.read.bind(app.options);
	app.options.read = (logger: Logger) => {
		originalReadOptions(logger);
		targetPath && (app.options['_values']['out'] = targetPath);
	};

	/**
	 * The documents have rendered and we now process directories into the select options
	 * @event RendererEvent.END
	 */
	app.renderer.on(RendererEvent.END, () => {
		vUtils.handleAssets(targetPath);
		vUtils.handleJeckyll(rootPath, targetPath);

		const directories = vUtils.getPackageDirectories(rootPath);
		const semGroups = vUtils.getSemGroups(directories);

		vUtils.makeStableLink(rootPath, semGroups, vOptions.stable);
		vUtils.makeDevLink(rootPath, semGroups, vOptions.dev);
		vUtils.makeMinorVersionLinks(semGroups, rootPath);

		const jsVersionKeys = vUtils.makeJsKeys(semGroups);
		fs.writeFileSync(path.join(rootPath, 'versions.js'), jsVersionKeys);

		fs.writeFileSync(path.join(rootPath, 'index.html'), '<meta http-equiv="refresh" content="0; url=stable"/>');
	});

	return vOptions;
}

export { vUtils as utils, vHooks as hook };
