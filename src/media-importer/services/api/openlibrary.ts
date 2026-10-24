import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { makeList, formatCustomDate, stripHtml } from './utils';

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
        return (data.docs || []).slice(0, 5).map((book: any) => {
          const coverUrl = book.cover_i
            ? 'https://covers.openlibrary.org/b/id/' +
              book.cover_i +
              '-L.jpg'
            : '';
          // Prefer work key so description/subjects are available, while preserving ISBN & median pages from search doc
          const fetchId = book.key || (book.isbn && book.isbn.length > 0 ? book.isbn[0] : '');
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
            draft_pages: book.number_of_pages_median ? String(book.number_of_pages_median) : '',
            draft_isbn: book.isbn && book.isbn.length > 0 ? String(book.isbn[0]) : '',
          };
        });
      });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const id = draftFields.draft_id || '';
    const isWorkKey = id.indexOf('/works/') === 0;
    const url = isWorkKey || id.indexOf('/books/') === 0
      ? 'https://openlibrary.org' + id + '.json'
      : 'https://openlibrary.org/isbn/' + id + '.json';

    const detailPromise = fetch(url).then(res => {
      if (!res.ok) throw new Error('API Request failed');
      return res.json();
    });

    // If fetching by work key, also query search API for median pages, ISBN, ratings_average, and cover fallback
    const searchEnrichPromise = isWorkKey
      ? fetch(
        'https://openlibrary.org/search.json?q=key:' +
          encodeURIComponent(id) +
          '&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn,ratings_average&limit=1',
      )
        .then(res => (res.ok ? res.json() : null))
        .then(sData => (sData && sData.docs && sData.docs[0] ? sData.docs[0] : null))
        .catch(() => null)
      : Promise.resolve(null);

    return Promise.all([detailPromise, searchEnrichPromise]).then(([data, searchDoc]) => {
      const cleanTitle = typeof data.title === 'object' && data.title.value
        ? data.title.value
        : data.title || (searchDoc && searchDoc.title) || draftFields.draft_title;
      const year = draftFields.draft_year && draftFields.draft_year !== '0000'
        ? draftFields.draft_year
        : searchDoc && searchDoc.first_publish_year
        ? String(searchDoc.first_publish_year)
        : '0000';
      const finalTitle = cleanTitle + ' (' + year + ')';

      let plot = '';
      if (data.description) {
        plot = typeof data.description === 'string'
          ? data.description
          : data.description.value || '';
      }
      plot = stripHtml(plot);

      const pages = data.number_of_pages
        ? String(data.number_of_pages)
        : (searchDoc && searchDoc.number_of_pages_median ? String(searchDoc.number_of_pages_median) : draftFields.draft_pages || 'unknown');
      const isbn10 = data.isbn_10 && data.isbn_10[0] ? data.isbn_10[0] : '';
      const isbn13 = data.isbn_13 && data.isbn_13[0] ? data.isbn_13[0] : '';
      const searchIsbn = searchDoc && searchDoc.isbn && searchDoc.isbn.length > 0 ? String(searchDoc.isbn[0]) : '';
      const primaryIsbn = isbn13 || isbn10 || draftFields.draft_isbn || searchIsbn || 'unknown';

      const onlineRating = searchDoc && searchDoc.ratings_average
        ? Number(searchDoc.ratings_average).toFixed(1)
        : '0';

      const image = draftFields.draft_cover ||
        (searchDoc && searchDoc.cover_i ? 'https://covers.openlibrary.org/b/id/' + searchDoc.cover_i + '-L.jpg' : '');

      const author = searchDoc && searchDoc.author_name
        ? makeList(searchDoc.author_name)
        : draftFields.draft_author || '[[Unknown]]';

      return {
        title: finalTitle,
        book_title: cleanTitle,
        englishTitle: cleanTitle,
        year: year,
        dataSource: 'OpenLibrary',
        url: 'https://openlibrary.org' +
          (data.key ? data.key : '/isbn/' + id),
        id: data.key || id,
        plot: plot,
        pages: pages,
        image: image,
        onlineRating: onlineRating,
        isbn: primaryIsbn,
        isbn13: isbn13 || primaryIsbn,
        released: 'true',
        status: 'Backlog',
        genres: data.subjects && Array.isArray(data.subjects) ? makeList(data.subjects.slice(0, 5)) : '',
        tags: '$:/tags/media-importer/Media',
        'media-type': 'Book',
        modified: formatCustomDate(),
        author: author,
      };
    });
  },
};
