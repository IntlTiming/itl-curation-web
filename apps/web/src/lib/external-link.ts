// Turns free text typed into a form's link field into a safe absolute external URL, or null.
//
// - A bare domain like "burnersmells.com" or "www.stepmaniaonline.net" has no scheme, so as an
//   <a href> the browser would resolve it relative to the current page - i.e. as a route inside
//   this app. It gets "https://" prepended so it's always an absolute external link.
// - Any scheme other than http(s) (javascript:, data:, ...) returns null: the text came from an
//   unauthenticated form, and a javascript: href would run script when clicked. Callers render
//   null as plain text instead of a link.
export function toExternalHref(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
