import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { makeList, formatCustomDate, fetchGraphQL } from './utils';

export const AniListConfig: MediaImporterConfig = {
  type: 'Manga',
  searchTag: 'MangaSearchResult',
  prefix: 'manga-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const p = page || 1;
    const gqlQuery = `
          query ($search: String, $page: Int) {
            Page(page: $page, perPage: 5) {
              media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
                id
                title { romaji english }
                startDate { year }
                coverImage { medium }
                staff(perPage: 1) { nodes { name { full } } }
              }
            }
          }`;
    return fetchGraphQL(gqlQuery, { search: query, page: p }).then(data => {
      const results = data.data.Page.media;
      if (!results) throw new Error('No results');
      return results.map((manga: any) => {
        const title = manga.title.english || manga.title.romaji;
        const author = manga.staff.nodes[0]
          ? manga.staff.nodes[0].name.full
          : 'Unknown';
        return {
          draft_title: title,
          draft_year: manga.startDate.year
            ? String(manga.startDate.year)
            : '0000',
          draft_id: String(manga.id),
          draft_image: manga.coverImage.medium,
          draft_author: author,
        };
      });
    });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const gqlQuery = `
          query ($id: Int) {
            Media(id: $id, type: MANGA) {
              id
              title { romaji english }
              startDate { year }
              description(asHtml: false)
              coverImage { extraLarge }
              genres
              volumes
              chapters
              status
              averageScore
              staff(perPage: 3) { edges { role node { name { full } } } }
            }
          }`;
    return fetchGraphQL(gqlQuery, { id: parseInt(draftFields.draft_id || '0', 10) }).then(
      data => {
        const manga = data.data.Media;
        const title = manga.title.english || manga.title.romaji;
        const year = manga.startDate.year
          ? String(manga.startDate.year)
          : '0000';
        const finalTitle = title + ' (' + year + ')';

        let authors: string[] = [];
        if (manga.staff && manga.staff.edges) {
          manga.staff.edges.forEach((edge: any) => {
            if (edge.role.includes('Story') || edge.role.includes('Art')) {
              authors.push(edge.node.name.full);
            }
          });
        }
        authors = [...new Set(authors)];

        return {
          title: finalTitle,
          englishTitle: title,
          year: year,
          dataSource: 'AniList',
          url: 'https://anilist.co/manga/' + manga.id,
          id: String(manga.id),
          author: makeList(authors),
          genres: makeList(manga.genres),
          volumes: manga.volumes ? String(manga.volumes) : 'unknown',
          chapters: manga.chapters ? String(manga.chapters) : 'unknown',
          onlineRating: manga.averageScore
            ? (manga.averageScore / 20).toFixed(1)
            : '0',
          image: manga.coverImage.extraLarge,
          status: 'Backlog',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'Manga',
          modified: formatCustomDate(),
          plot: manga.description || '',
        };
      },
    );
  },
};
