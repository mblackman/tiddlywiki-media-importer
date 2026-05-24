import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { makeList, formatCustomDate } from './utils';

export const OpenLibraryConfig: MediaImporterConfig = {
  type: 'Book',
  searchTag: 'SearchResult',
  prefix: 'result', // Matches original: $:/temp/search/result/
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const p = page || 1;
    const url = 'https://openlibrary.org/search.json?limit=5&q=' +
      encodeURIComponent(query) +
      '&page=' +
      p;
    return fetch(url)
      .then(res => res.json())
      .then(data => {
        return data.docs.slice(0, 5).map((book: any) => {
          const coverUrl = book.cover_i
            ? 'https://covers.openlibrary.org/b/id/' +
              book.cover_i +
              '-L.jpg'
            : '';
          const fetchId = book.isbn && book.isbn.length > 0
            ? book.isbn[0]
            : book.key || '';
          const authorList = book.author_name
            ? makeList(book.author_name)
            : '[[Unknown]]';

          return {
            draft_title: book.title,
            draft_author: authorList,
            draft_year: book.first_publish_year
              ? String(book.first_publish_year)
              : '0000',
            draft_id: fetchId,
            draft_cover: coverUrl,
          };
        });
      });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const id = draftFields.draft_id || '';
    const url = id.indexOf('/works/') === 0 || id.indexOf('/books/') === 0
      ? 'https://openlibrary.org' + id + '.json'
      : 'https://openlibrary.org/isbn/' + id + '.json';

    return fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('API Request failed');
        return res.json();
      })
      .then(data => {
        const cleanTitle = typeof data.title === 'object' && data.title.value
          ? data.title.value
          : data.title;
        const finalTitle = cleanTitle + ' (' + draftFields.draft_year + ')';

        let plot = 'unknown';
        if (data.description) {
          plot = typeof data.description === 'string'
            ? data.description
            : data.description.value || 'unknown';
        }

        return {
          title: finalTitle,
          book_title: cleanTitle,
          englishTitle: cleanTitle,
          year: draftFields.draft_year || '0000',
          dataSource: 'OpenLibraryAPI',
          url: 'https://openlibrary.org' +
            (data.key ? data.key : '/isbn/' + id),
          id: data.key || id,
          plot: plot,
          pages: data.number_of_pages
            ? String(data.number_of_pages)
            : 'unknown',
          image: draftFields.draft_cover,
          onlineRating: '0',
          isbn: data.isbn_10 && data.isbn_10[0] ? data.isbn_10[0] : 'unknown',
          isbn13: data.isbn_13 && data.isbn_13[0] ? data.isbn_13[0] : 'unknown',
          released: 'true',
          status: 'Backlog',
          genres: data.subjects && Array.isArray(data.subjects) ? makeList(data.subjects.slice(0, 5)) : '',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'Book',
          modified: formatCustomDate(),
          author: draftFields.draft_author,
        };
      });
  },
};
