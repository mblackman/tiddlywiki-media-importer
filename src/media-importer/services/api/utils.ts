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

const hostQueues = new Map<string, Promise<any>>();
const hostLastCompleted = new Map<string, number>();

// --- HELPER: Fetch JSON with automatic retry, exponential backoff, and per-host rate-limit queueing ---
export function fetchJsonWithRetry(url: string, retries = 4, delayMs = 800, minIntervalMs = 0): Promise<any> {
  const doRequest = (): Promise<any> => {
    return fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    }).then(res => {
      if (!res.ok) {
        if ((res.status === 503 || res.status === 429) && retries > 0) {
          return new Promise(resolve => setTimeout(resolve, delayMs)).then(() =>
            fetchJsonWithRetry(url, retries - 1, Math.round(delayMs * 1.6), 0),
          );
        }
        throw new Error(`HTTP ${res.status}`);
      }
      return res.json();
    });
  };

  if (minIntervalMs <= 0) {
    return doRequest();
  }

  let hostKey = 'default';
  try {
    hostKey = new URL(url).hostname;
  } catch {
    hostKey = url.split('/')[2] || 'default';
  }

  const prev = hostQueues.get(hostKey) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => {
      const last = hostLastCompleted.get(hostKey) || 0;
      const elapsed = Date.now() - last;
      const waitMs = Math.max(0, minIntervalMs - elapsed);
      return waitMs > 0 ? new Promise(resolve => setTimeout(resolve, waitMs)) : Promise.resolve();
    })
    .then(() => doRequest())
    .finally(() => {
      hostLastCompleted.set(hostKey, Date.now());
    });

  hostQueues.set(hostKey, next);
  return next;
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
