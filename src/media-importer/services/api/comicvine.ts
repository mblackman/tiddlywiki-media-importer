import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { formatCustomDate, fetchJSONP } from './utils';

export const ComicVineConfig: MediaImporterConfig = {
  type: 'Comic',
  apiKeyTiddler: '$:/plugins/mblackman/media-importer/configs/comicvine-api-key',
  searchTag: 'ComicSearchResult',
  prefix: 'comic-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const p = page || 1;
    const url = 'https://comicvine.gamespot.com/api/search/?api_key=' +
      apiKey +
      '&format=jsonp&resources=volume&limit=5&page=' +
      p +
      '&query=' +
      encodeURIComponent(query);
    return fetchJSONP(url).then(data => {
      if (data.error && data.error !== 'OK') throw new Error(data.error);
      if (!data.results) return [];
      return data.results.map((comic: any) => ({
        draft_title: comic.name,
        draft_year: comic.start_year || '0000',
        draft_id: comic.api_detail_url,
        draft_publisher: comic.publisher ? comic.publisher.name : 'Unknown',
        draft_image: comic.image ? comic.image.icon_url : '',
      }));
    });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const url = draftFields.draft_id + '?api_key=' + apiKey + '&format=jsonp';
    return fetchJSONP(url).then(data => {
      if (data.error && data.error !== 'OK') throw new Error(data.error);
      const comic = data.results;
      const finalTitle = comic.name + ' (' + draftFields.draft_year + ')';

      return {
        title: finalTitle,
        englishTitle: comic.name,
        year: draftFields.draft_year || '0000',
        dataSource: 'ComicVine',
        url: comic.site_detail_url,
        id: String(comic.id),
        publisher: draftFields.draft_publisher,
        count_of_issues: comic.count_of_issues
          ? String(comic.count_of_issues)
          : 'unknown',
        image: comic.image ? comic.image.super_url : '',
        plot: comic.deck || comic.description || '',
        status: 'Backlog',
        tags: '$:/tags/media-importer/Media',
        'media-type': 'Comic',
        modified: formatCustomDate(),
      };
    });
  },
};
