# Ditana website

The website of Ditana GNU/Linux at [ditana.org](https://ditana.org), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Requirements

- Node.js with npm.
- `rsvg-convert` (librsvg) and `fc-match` (fontconfig), which render the preview image.
- The fonts Noto Sans and JetBrains Mono. The build fails if one of them is not installed. The preview image names them.
- po4a, gettext and translate-toolkit, which turn the English pages and the PO files into the translated pages. On Arch, po4a 0.74 also needs `perl-syntax-keyword-try`, which is not part of its package dependencies.
- hunspell with the dictionaries `en_GB`, `de_CH`, `fr_CH`, `it_CH` and `es`, and LanguageTool, for the checks of the translations. The Romansh dictionary is in the repository.

## Commands

| Command                       | Action                                                                      |
| :---------------------------- | :-------------------------------------------------------------------------- |
| `npm install`                 | Installs the dependencies.                                                  |
| `npm run dev`                 | Starts the dev server at `localhost:4321`.                                  |
| `npm run build`               | Builds the site to `./dist/`.                                               |
| `npm test`                    | Runs the tests, including complete builds of copies of the site.            |
| `npm run i18n:update`         | Brings the translation files up to date with the English text.              |
| `npm run i18n:check`          | Runs the checks every translation passes before publishing.                 |
| `npm run i18n:units`          | Exports the open units of a language as JSON, and imports them translated.  |
| `npm run i18n:lint`           | Reports what LanguageTool finds in the grammar of one language.             |
| `./publish-ditana-website.sh` | Checks the server, builds the site and uploads it to the production server. |

`publish-ditana-website.sh` reaches the server as `ditana-origin`, an ssh alias it expects in `~/.ssh/config` together with the server’s address and the user that logs in.

## Translations

The site is written in British English with Oxford spelling, and translated into Swiss Standard German, Swiss French, Swiss Italian, Romansh (Rumantsch Grischun), Latin American Spanish and Ukrainian. English occupies the root, each translation under its prefix: `/de-ch/`, `/fr-ch/`, `/it-ch/`, `/rm/`, `/es-419/` and `/uk/`. A visitor who arrives at `/` from another location is sent to the language requested by their browser; every other path is served as it is.

The translations are stored only as PO files in `po/`: one directory per page, holding the POT of its English units and a PO file for each language, and `po/ui/` for the interface strings, whose English source is `src/content/i18n/en-GB.json`. Every build writes the translated pages from them into `src/content/docs/<prefix>/`, which git ignores. Readers correct translations on [Weblate](https://hosted.weblate.org/projects/ditana/), which sends its changes as pull requests.

After a change to an English page or to `en-GB.json`, run `npm run i18n:update`. A changed unit becomes fuzzy and a new one empty, in every language, and the site is not published until they are translated again. A translated heading keeps the id of its English heading, and a link points to the page in the language it is written in, so an anchor works in every language.

Publishing demands from every translation, as `npm run i18n:check` reports:

- each unit is translated and current;
- code, link targets, addresses, placeholders, figures and the Markdown structure remain unchanged;
- the typographic rules of the language variant, taken from the Swiss Federal Chancellery for the Swiss languages, from the Real Academia Española for Spanish and from the Ukrainian orthography; `src/i18n/typography.mjs` names the source of each rule;
- the spelling, checked against the dictionary of the language and against the words of the project in `i18n/vocabulary/`.

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

The Romansh dictionary in `i18n/dictionaries/rm/` is copyright Lia Rumantscha and Pro Svizra Rumantscha, under the MIT licence in `rm-rumgr_LICENSE.txt` beside it.
