import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { formatCustomDate, makeList } from './utils';

export const RawgConfig: MediaImporterConfig = {
  type: 'Game',
  apiKeyTiddler: '$:/plugins/mblackman/media-importer/configs/rawg-api-key',
  searchTag: 'GameSearchResult',
  prefix: 'game-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const p = page || 1;
    const url = 'https://api.rawg.io/api/games?key=' +
      apiKey +
      '&page_size=5&page=' +
      p +
      '&search=' +
      encodeURIComponent(query);
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        return data.results.slice(0, 5).map((game: any) => ({
          draft_title: game.name,
          draft_year: game.released
            ? game.released.substring(0, 4)
            : '0000',
          draft_id: String(game.id),
          draft_image: game.background_image,
          draft_genres: Array.isArray(game.genres)
            ? game.genres.map((g: any) => g.name).filter(Boolean).join(', ')
            : '',
        }));
      });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const url = 'https://api.rawg.io/api/games/' +
      draftFields.draft_id +
      '?key=' +
      apiKey;
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('API Request failed');
        return res.json();
      })
      .then(data => {
        const year = data.released
          ? data.released.substring(0, 4)
          : (draftFields.draft_year || '0000');
        const finalTitle = data.name + ' (' + year + ')';
        return {
          title: finalTitle,
          englishTitle: data.name,
          year: year,
          dataSource: 'RAWG',
          url: 'https://rawg.io/games/' + data.slug,
          id: String(data.id),
          developers: makeList(data.developers),
          publishers: makeList(data.publishers),
          genres: makeList(data.genres),
          onlineRating: String(data.rating),
          image: data.background_image,
          released: 'true',
          releaseDate: data.released,
          status: 'Backlog',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'Game',
          modified: formatCustomDate(),
          plot: data.description_raw || '',
        };
      });
  },
};
