// --- UTILS ---
// Helper: Convert array to TiddlyWiki list string "[[Item]] [[Item2]]"
export function makeList(array: any[] | undefined): string {
  if (!array || !Array.isArray(array) || array.length === 0) return '';
  return array
    .map(function(item) {
      // Support objects with `name` or plain strings
      const name = typeof item === 'string' ? item : item && item.name ? item.name : '';
      if (!name) return '';
      // Wrap items in double brackets for TiddlyWiki
      return '[[' + name.trim() + ']]';
    })
    .filter(Boolean)
    .join(' ');
}

// Helper: Format Date for TiddlyWiki modified field (returns Date object for standard TW serialization)
export function formatCustomDate(): Date {
  return new Date();
}

// Helper: Clean HTML tags and markdown footnotes from API descriptions
export function stripHtml(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// --- HELPER: JSONP (For ComicVine) ---
export function fetchJSONP(url: string): Promise<any> {
  return new Promise(function(resolve, reject) {
    const callbackName = 'cv_jsonp_' + Math.round(100000 * Math.random());
    (window as any)[callbackName] = function(data: any) {
      delete (window as any)[callbackName];
      document.body.removeChild(script);
      resolve(data);
    };
    const script = document.createElement('script');
    script.src = url + '&json_callback=' + callbackName;
    script.onerror = function() {
      delete (window as any)[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP request failed'));
    };
    document.body.appendChild(script);
  });
}

// --- HELPER: GraphQL (For AniList) ---
export function fetchGraphQL(query: string, variables: any): Promise<any> {
  return fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: query, variables: variables }),
  }).then(r => r.json());
}

// --- HELPER: Pagination Strategy ---
// Maps a smaller UI page size to a larger API page size (e.g. 5 items from a 20-item API page)
export function getPagedSlice(uiPage: number, uiSize: number, apiSize: number) {
  const ratio = Math.floor(apiSize / uiSize);
  const apiPage = Math.floor((uiPage - 1) / ratio) + 1;
  const offset = ((uiPage - 1) % ratio) * uiSize;
  return {
    apiPage: apiPage,
    start: offset,
    end: offset + uiSize,
  };
}
