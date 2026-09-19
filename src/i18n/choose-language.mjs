import { LOCALES } from './locales.mjs';

// The script that picks the language of a visitor. It runs in the head of
// every page, before anything is drawn, and does two things:
//
// - Upon using the language picker, the selection is remembered.
// - When a user arrives at / from another location, they are directed to the
//   language their browser requests: the previously stored choice if one
//   exists, otherwise the first language in navigator.languages that the site
//   supports, determined by its primary subtag (de-DE and de-AT are routed to
//   Swiss German pages, es-ES to Latin American Spanish ones). English, or no
//   match, stays at /.
//
// Nothing else is ever redirected. A link to a page in one language opens that
// page in that language, and a visitor who is already on the site and follows
// a link to / stays in English: that is where the logo of an English page
// points.

export const STORAGE_KEY = 'ditana-language';

export function languageChoiceScript() {
    const byLanguage = Object.fromEntries(LOCALES.map(({ prefix, lang }) => [lang.split('-')[0].toLowerCase(), prefix]));
    const prefixes = LOCALES.map(({ prefix }) => prefix).filter(Boolean);
    return `(() => {
  const KEY = ${JSON.stringify(STORAGE_KEY)};
  const BY_LANGUAGE = ${JSON.stringify(byLanguage)};
  const PREFIXES = ${JSON.stringify(prefixes)};
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (value) => { try { localStorage.setItem(KEY, value); } catch {} };
  document.addEventListener('change', (event) => {
    const select = event.target instanceof Element && event.target.closest('starlight-lang-select select');
    if (!select) return;
    const first = select.value.split('/')[1] ?? '';
    write(PREFIXES.includes(first) ? first : '');
  });
  if (location.pathname !== '/') return;
  let target = read();
  if (target === null) {
    try {
      if (document.referrer && new URL(document.referrer).origin === location.origin) return;
    } catch {}
    target = '';
    for (const tag of navigator.languages ?? [navigator.language]) {
      const language = String(tag).split('-')[0].toLowerCase();
      if (Object.hasOwn(BY_LANGUAGE, language)) { target = BY_LANGUAGE[language]; break; }
    }
  }
  if (target && PREFIXES.includes(target)) location.replace('/' + target + '/' + location.search + location.hash);
})();`;
}
