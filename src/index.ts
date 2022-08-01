import { Application, ParameterType, RendererEvent } from 'typedoc';
import path from 'path';
import fs from 'fs-extra';
import * as utils from './utils';
import * as hook from './hooks';
import { versionsOptions } from './types';

export function load(app: Application) {
	app.options.addDeclaration({
		help: 'Options for typedoc-plugin-versions',
		name: 'versions',
		type: ParameterType.Mixed,
		defaultValue: {
			stable: utils.getMinorPackageVersion(), 
			dev: utils.getPackageVersion(),
			homeUrl: utils.getHomeUrl(),
			location: false,
		} as versionsOptions
	});

	const vOptions = utils.bugWorkaround(app);


	hook.injectSelectJs(app);
	hook.injectSelectHtml(app, vOptions.location);

	const rootPath = app.options.getValue('out');
	const targetPath = path.join(rootPath, `v${utils.getPackageVersion()}`);

	const originalGenerateDocs = app.generateDocs.bind(app);
	app.generateDocs = (project, out) => {
		return originalGenerateDocs(project, targetPath);
	}
	
	app.renderer.on(RendererEvent.END, () => {

		const newNojekyllPath = path.join(targetPath, '.nojekyll');
		const oldNojekyllPath = path.join(rootPath, '.nojekyll');
		const sourceAsset = path.join(process.cwd(), 'src/versionsMenu.js');
		fs.copyFileSync(sourceAsset, path.join(targetPath, 'assets/versionsMenu.js'));
		fs.removeSync(oldNojekyllPath);
		fs.existsSync(newNojekyllPath) && fs.moveSync(newNojekyllPath, oldNojekyllPath);

		const directories = utils.getPackageDirectories(rootPath);
		const semGroups = utils.getSemGroups(directories);

		utils.makePeggedLink(rootPath, semGroups, vOptions.stable, 'stable');
		utils.makePeggedLink(rootPath, semGroups, vOptions.dev, 'dev');
		utils.makeMinorVersionLinks(semGroups, rootPath);

		const jsVersionKeys = utils.makeJsKeys(semGroups);
		fs.writeFileSync(path.join(rootPath, 'versions.js'), jsVersionKeys);

		const htmlIndex = utils.makeIndex(vOptions.homeUrl);
		fs.writeFileSync(path.join(rootPath, 'index.html'), htmlIndex);
	})

}