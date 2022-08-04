[![RELEASE AND PUBLISH](https://github.com/citkane/typedoc-plugin-versions/actions/workflows/release.yml/badge.svg)](https://github.com/citkane/typedoc-plugin-versions/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/citkane/typedoc-plugin-versions/branch/main/graph/badge.svg?token=5DDL83JO0R)](https://codecov.io/gh/citkane/typedoc-plugin-versions)
[![GitHub](https://badgen.net/badge/icon/github?icon=github&label)](https://github.com/citkane/typedoc-plugin-versions)
[![Npm](https://badgen.net/badge/icon/npm?icon=npm&label)](https://npmjs.com/package/typedoc-plugin-versions)
[![docs stable](https://img.shields.io/badge/docs-stable-teal.svg)](https://citkane.github.io/typedoc-plugin-versions/stable)
[![docs stable](https://img.shields.io/badge/docs-dev-teal.svg)](https://citkane.github.io/typedoc-plugin-versions/dev)


# typedoc-plugin-versions
#### It keeps track of your document builds and provides select options for browsing.  
<br />
<img src="./media/Screenshot.jpg" width="500px" height="auto" border="1px solid light-grey" />
<br />

## Usage
```
npm i -D typedoc-plugin-versions
```
and in typedoc.json
```jsonc
"plugin": ["typedoc-plugin-versions"],
"versions": { //custom options for versions
	/**
	 * The minor version that you would like to be marked as `stable`  
	 * Defaults to the latest patch version of the version being built
	 */
	"stable": "1.1",
	/**
	 * The version that you would like to be marked as `dev`  
	 * Defaults to the latest patch version of the version being built
	 */
	"dev": "1.2.19",
	/**
	 * The url to the base folder where you will host your documentation set  
	 * Default: will try to determine the GitHUB package url from package.json and convert it to gh-page url.
	 */
	"homeUrl": "https://mydocs.com/docs",
	/**
	 * A custom DOM location to render the HTML `select` dropdown corresponding to typedoc rendererHooks.  
	 * Default: Injects to left of header using vanilla js - not a typedoc render hook.
	 */
	"domLocation": "navigation.begin"
}
```

## "What sorcery is this?", you may ask...
`Typedoc-plugin-versions` takes the architectural approach of JuliaLang [Documenter](https://juliadocs.github.io/Documenter.jl/stable/).

Documents are built (with no change to the typedoc flow) into subdirectories corresponding to the package.json version. Symlinks are created to minor versions, which are given as options in a `select` menu.

As long as you do not delete your historic document build folders, the document history will remain intact.

If you want to remove a historic version, just delete the old folder and rebuild your documentation.

## CID
Below is an opinionated Github CI setup. You can hack and change it to suite your needs.


**How to for Github Actions**:
- In your project's `package.json`, set up scripts for:
  - `build` - to build your project, eg. "tsc --outDir ./dist"
  - `docs` - to build your documents, eg "typedoc --out ./docs"
- Ensure that your documents are being built into a folder named `./docs` (or change your workflow file appropriately)
- Create an empty branch called gh-pages
- Under your repository 'Pages' settings, set:
  - Source: Deploy from a branch
  - Branch: gh-pages/docs (symlinks won't work in the gh-pages/root folder)
- Create a [custom workflow](https://docs.github.com/en/actions/quickstart) as per this template for [PUBLISH DOCS](https://github.com/citkane/typedoc-plugin-versions/blob/main/.github/workflows/docs.yml)

The "PUBLISH DOCS" action will create a rolling update to your document set.