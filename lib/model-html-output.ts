/**
 * Modellen zetten antwoord-HTML soms per ongeluk in markdown fenced blocks (```html ... ```).
 * Die moeten eraf voordat we HTML sanitizen/renderen.
 */
export function normalizeModelHtmlAnswer(raw: string): string {
  let s = raw.replace(/^\uFEFF/, '')
  s = s.replace(/^\s*```(?:html|htm|xml)?\s*\r?\n?/i, '')
  s = s.replace(/\r?\n```[ \t]*$/, '')
  s = s.replace(/```[ \t]*$/, '')
  return s
}
