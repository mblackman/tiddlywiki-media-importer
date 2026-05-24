import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { makeList, formatCustomDate, getPagedSlice } from './utils';

export const TmdbMovieConfig: MediaImporterConfig = {
  type: 'Movie',
  apiKeyTiddler: '$:/plugins/mblackman/media-importer/configs/tmdb-api-key',
  searchTag: 'MovieSearchResult',
  prefix: 'movie-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const paging = getPagedSlice(page || 1, 5, 20);
    const url = 'https://api.themoviedb.org/3/search/movie?api_key=' +
      apiKey +
      '&page=' +
      paging.apiPage +
      '&query=' +
      encodeURIComponent(query);
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        return data.results.slice(paging.start, paging.end).map((movie: any) => ({
          draft_title: movie.title,
          draft_year: movie.release_date
            ? movie.release_date.substring(0, 4)
            : '0000',
          draft_id: String(movie.id),
          draft_poster: movie.poster_path
            ? 'https://image.tmdb.org/t/p/w500' + movie.poster_path
            : '',
          draft_overview: movie.overview,
        }));
      });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const url = 'https://api.themoviedb.org/3/movie/' +
      draftFields.draft_id +
      '?api_key=' +
      apiKey +
      '&append_to_response=credits';
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('API Request failed');
        return res.json();
      })
      .then(data => {
        const year = data.release_date
          ? data.release_date.substring(0, 4)
          : '0000';
        const finalTitle = data.title + ' (' + year + ')';

        let directors: string[] = [];
        let cast: string[] = [];
        if (data.credits) {
          if (data.credits.crew) {
            directors = data.credits.crew
              .filter((p: any) => p.job === 'Director')
              .map((p: any) => p.name);
          }
          if (data.credits.cast) {
            cast = data.credits.cast.slice(0, 5).map((c: any) => c.name);
          }
        }

        return {
          title: finalTitle,
          englishTitle: data.original_title || data.title,
          year: year,
          dataSource: 'TMDB',
          url: 'https://www.themoviedb.org/movie/' + data.id,
          id: String(data.id),
          director: makeList(directors),
          cast: makeList(cast),
          genres: makeList(data.genres),
          runtime: String(data.runtime),
          onlineRating: data.vote_average
            ? (data.vote_average / 2).toFixed(1)
            : '0',
          image: data.poster_path
            ? 'https://image.tmdb.org/t/p/w500' + data.poster_path
            : '',
          status: 'Backlog',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'Movie',
          modified: formatCustomDate(),
          plot: data.overview || '',
        };
      });
  },
};

export const TmdbTvConfig: MediaImporterConfig = {
  type: 'TV Show',
  apiKeyTiddler: '$:/plugins/mblackman/media-importer/configs/tmdb-api-key',
  searchTag: 'TVShowSearchResult',
  prefix: 'tv-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const paging = getPagedSlice(page || 1, 5, 20);
    const url = 'https://api.themoviedb.org/3/search/tv?api_key=' +
      apiKey +
      '&page=' +
      paging.apiPage +
      '&query=' +
      encodeURIComponent(query);
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        return data.results.slice(paging.start, paging.end).map((show: any) => ({
          draft_title: show.name,
          draft_year: show.first_air_date
            ? show.first_air_date.substring(0, 4)
            : '0000',
          draft_id: String(show.id),
          draft_poster: show.poster_path
            ? 'https://image.tmdb.org/t/p/w500' + show.poster_path
            : '',
          draft_overview: show.overview,
        }));
      });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const url = 'https://api.themoviedb.org/3/tv/' +
      draftFields.draft_id +
      '?api_key=' +
      apiKey +
      '&append_to_response=credits';
    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('API Request failed');
        return res.json();
      })
      .then(data => {
        const year = data.first_air_date
          ? data.first_air_date.substring(0, 4)
          : '0000';
        const finalTitle = data.name + ' (' + year + ')';

        let creators: string[] = [];
        let cast: string[] = [];
        if (data.created_by) creators = data.created_by.map((p: any) => p.name);
        if (data.credits && data.credits.cast) {
          cast = data.credits.cast.slice(0, 5).map((c: any) => c.name);
        }

        return {
          title: finalTitle,
          englishTitle: data.original_name || data.name,
          year: year,
          dataSource: 'TMDB',
          url: 'https://www.themoviedb.org/tv/' + data.id,
          id: String(data.id),
          creator: makeList(creators),
          cast: makeList(cast),
          genres: makeList(data.genres),
          seasons: String(data.number_of_seasons),
          episodes: String(data.number_of_episodes),
          onlineRating: data.vote_average
            ? (data.vote_average / 2).toFixed(1)
            : '0',
          image: data.poster_path
            ? 'https://image.tmdb.org/t/p/w500' + data.poster_path
            : '',
          status: 'Backlog',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'TV Show',
          modified: formatCustomDate(),
          plot: data.overview || '',
        };
      });
  },
};
