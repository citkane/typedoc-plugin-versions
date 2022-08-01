/**
 * Typdoc hooks and injections for typedoc-plugin-versions
 * 
 * @module
 */

import {Application, JSX} from "typedoc";
import { validLocation } from "./types";

/**
 * Injects browser js to control the behaviour of the new `select` DOM element
 * @param app 
 */
export function injectSelectJs(app: Application){
	app.renderer.hooks.on('body.end', ctx => {
		return <script src={ctx.relativeURL("assets/versionsMenu.js")} type="module"></script>
	});
}

const validHookLocations = ['body.begin', 'body.end', 'content.begin', 'content.end', 'navigation.begin', 'navigation.end']
/**
 * Injects the new `select` dropdown into the HTML
 * @param app 
 * @param domLocation 
 */
export function injectSelectHtml(app: Application, domLocation: validLocation | string = 'false'){
	if (validHookLocations.indexOf(domLocation) > -1) {
		app.renderer.hooks.on(domLocation as validLocation , () => (
			<select id="plugin-versions-select" name="versions"></select>
		))	
	} else {
		app.renderer.hooks.on('body.begin', () => (
			<select id="plugin-versions-select" class="title" name="versions"></select>
		))	
	}
}