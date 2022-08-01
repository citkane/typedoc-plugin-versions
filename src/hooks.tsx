import {JSX} from "typedoc";
import { validLocations } from "./types";

export function injectSelectJs(app){
	app.renderer.hooks.on('body.end', ctx => {
		return <script src={ctx.relativeURL("assets/versionsMenu.js")} type="module"></script>
	});
}

const validHookLocations: validLocations = ['body.begin', 'body.end', 'content.begin', 'content.end', 'navigation.begin', 'navigation.end']
export function injectSelectHtml(app, location){
	if (validHookLocations.indexOf(location) > -1) {
		app.renderer.hooks.on(location, () => (
			<select id="plugin-versions-select"></select>
		))	
	} else {
		app.renderer.hooks.on('body.begin', () => (
			<select id="plugin-versions-select" class="title"></select>
		))	
	}
}