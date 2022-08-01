export interface versionsOptions {
	stable: string;
	dev: string;
	homeUrl: string;
	location: string | boolean
}

export type semanticGroups = {[key: string]: {[key: string]: number}};
export type validLocations = ['body.begin', 'body.end', 'content.begin', 'content.end', 'navigation.begin', 'navigation.end'];