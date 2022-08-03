/**
 * Type definitions for typedoc-plugin-versions
 * 
 * @module
 */


/**
 * User defined options under the key of `versions` in typedoc.json
 */
export interface versionsOptions {
	/**
	 * The minor version that you would like to be marked as `stable`  
	 * Defaults to the latest patch version of the version being built
	 */
	stable?: minorVersion;
	/**
	 * The version that you would like to be marked as `dev`  
	 * Defaults to the latest patch version of the version being built
	 */
	dev?: patchVersion;
	/**
	 * The url to the base folder where you will host your documentation set  
	 * Default: will try to determine the GitHUB package url from package.json and convert it to gh-page url.
	 */
	homeUrl?: string;
	/**
	 * A custom DOM location to render the HTML `select` dropdown corresponding to [typedoc render hooks](https://typedoc.org/api/interfaces/RendererHooks.html)  
	 * Default: Injects to left of header using vanilla js - not a typedoc render hook.
	 */
	domLocation?: validLocation | 'false'
}
export type minorVersion = `${string | number}.${number}`;
export type patchVersion = `${minorVersion}.${number}`;
export type version = minorVersion | patchVersion;
export type semanticGroups = {[key: string]: {[key: string]: number}};

/**
 * valid placement overrides for the select, corresponds to [typedoc render hooks](https://typedoc.org/api/interfaces/RendererHooks.html)
 */
export type validLocation = 'body.begin' | 'body.end' | 'content.begin' | 'content.end' | 'navigation.begin' | 'navigation.end' ;
export type semanticAlias = 'stable' | 'dev'

