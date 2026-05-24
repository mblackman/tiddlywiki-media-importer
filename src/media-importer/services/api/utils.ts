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

// Helper: Format Date like "2025-08-02 - 11:28 pm"
export function formatCustomDate(): string {
  const d = new Date();
  const datePart = d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0');

  let hours = d.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timePart = hours + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ampm;
  return datePart + ' - ' + timePart;
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
