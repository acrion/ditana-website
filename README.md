# Ditana website

The website of Ditana GNU/Linux at [ditana.org](https://ditana.org), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Requirements

- Node.js with npm.
- `rsvg-convert` (librsvg) and `fc-match` (fontconfig), which render the preview image.
- The fonts Noto Sans and JetBrains Mono. The build fails if one of them is not installed. The preview image names them.

## Commands

| Command                       | Action                                                                      |
| :---------------------------- | :-------------------------------------------------------------------------- |
| `npm install`                 | Installs the dependencies.                                                  |
| `npm run dev`                 | Starts the dev server at `localhost:4321`.                                  |
| `npm run build`               | Builds the site to `./dist/`.                                               |
| `npm test`                    | Runs the tests, including complete builds of copies of the site.            |
| `./publish-ditana-website.sh` | Checks the server, builds the site and uploads it to the production server. |

`publish-ditana-website.sh` reaches the server as `ditana-origin`, an ssh alias it expects in `~/.ssh/config` together with the server’s address and the user that logs in.

## Releases

The current release is the newest release-notes page that carries a release date. Each page in `src/content/docs/release-notes/` describes its release in its frontmatter:

```yaml
release:
  version: '0.9.5'   # quoted, so that YAML does not read it as a number
  label: Beta        # optional; it becomes part of the image's file name
  date: 2026-12-01   # left out until the release is out
  isoSize: 2.0 GB    # decimal gigabytes, as the pages state them
```

Everything that names the current release follows from there: the "Release notes" group in the sidebar and its "(current)" mark, the landing page, the download page, the lines at the top of each release-notes page that give its date and the releases preceding and following it, and the preview image. `download.md` writes `{{release}}`, `{{iso}}`, `{{iso-size}}` and `{{notes}}` where it names the current release.

To publish a release:

1. Write its release notes at any time beforehand, without a date. Such a page is excluded from the production build; `npm run dev` shows it.
2. Upload the image, its `.sha256` and its `.sig` to the downloads directory on the server.
3. Add `date` and `isoSize` in the release notes.
4. Run `./publish-ditana-website.sh`. It publishes nothing when one of the three files is missing on the server, or when the size of the image differs from `isoSize`.

Release notes are history: they name versions literally, and a placeholder in them fails the build. So does a misspelt placeholder on any other page.

The dev server reads the release notes upon start. Once their frontmatter is modified, stop it and start it again; it reminds you to.

## Preview image

`src/og-image/template.svg` is manually created and can be edited in Inkscape. The sole variable part is `{{RELEASE}}`, representing the current release in capitals. The build renders it to `/og-image.png`, and the pages provide its location, which includes a digest of the drawing, enabling link-preview services and Cloudflare to retrieve it once more whenever it changes.

The template names its fonts. A generic family such as `sans-serif` would be resolved by the font configuration of whoever builds the site, so the build refuses it, as it refuses a font that is not installed.

## Licences

The code – the configuration, the components, the scripts and the tests – is licensed under the GNU Affero General Public License, version 3 or later ([LICENSE](LICENSE)). The text of the site, including its translations, and the template of the preview image are licensed under Creative Commons Attribution-ShareAlike 4.0 International ([LICENSE-CONTENT](LICENSE-CONTENT)). Both are copyright acrion innovations GmbH and the contributors.

Neither licence covers the Ditana logo (`src/assets/logo.svg`, `public/favicon.svg`), the photographs of people (`src/assets/people/`) or the screenshots (`src/assets/screenshots/`). All rights to them are reserved by their respective owners.
