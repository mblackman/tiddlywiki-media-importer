import { MediaDraftFields, MediaFinalFields, MediaImporterConfig } from './types';
import { fetchJsonWithRetry, formatCustomDate, makeList, stripHtml } from './utils';

function formatArtists(artistCredits: any[] | undefined): string[] {
  if (!artistCredits || !Array.isArray(artistCredits)) return [];
  const names = artistCredits
    .map((credit: any) => credit.name || (credit.artist && credit.artist.name) || '')
    .filter(Boolean);
  return [...new Set(names)];
}

export const MusicBrainzConfig: MediaImporterConfig = {
  type: 'Music',
  searchTag: 'MusicSearchResult',
  prefix: 'music-result',
  searchFn: function(query: string, apiKey: string, page: number): Promise<MediaDraftFields[]> {
    const p = page || 1;
    const limit = 5;
    const offset = (p - 1) * limit;
    const url = 'https://musicbrainz.org/ws/2/release-group/?query=' +
      encodeURIComponent(query) +
      '&limit=' +
      limit +
      '&offset=' +
      offset +
      '&fmt=json';

    return fetchJsonWithRetry(url, 4, 800, 1000).then(data => {
      const groups = data['release-groups'] || [];
      return groups.slice(0, limit).map((group: any) => {
        const artists = formatArtists(group['artist-credit']);
        const artistList = artists.length > 0 ? makeList(artists) : '[[Unknown]]';
        const releaseDate = group['first-release-date'] || '';
        const year = releaseDate.length >= 4 ? releaseDate.substring(0, 4) : '0000';
        const releases: any[] = Array.isArray(group.releases) ? group.releases : [];
        const officialRelease = releases.find((r: any) => r.status === 'Official') || releases[0];
        const coverUrl = group.id
          ? 'https://coverartarchive.org/release-group/' + group.id + '/front-250'
          : '';
        const searchTags = Array.isArray(group.tags)
          ? group.tags
            .slice()
            .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
            .slice(0, 5)
            .map((t: any) => t.name)
            .filter(Boolean)
          : [];

        return {
          draft_title: group.title,
          draft_artist: artistList,
          draft_author: artistList,
          draft_year: year,
          draft_release_date: releaseDate,
          draft_release_type: group['primary-type'] || 'Album',
          draft_release_id: officialRelease && officialRelease.id ? String(officialRelease.id) : '',
          draft_genres: searchTags.length > 0 ? makeList(searchTags) : '',
          draft_id: String(group.id),
          draft_image: coverUrl,
          draft_cover: coverUrl,
        };
      });
    });
  },
  fetchFn: function(draftFields: MediaDraftFields, apiKey: string): Promise<MediaFinalFields> {
    const id = draftFields.draft_id || '';
    const detailUrl = 'https://musicbrainz.org/ws/2/release-group/' +
      encodeURIComponent(id) +
      '?inc=artist-credits+releases+tags+genres+ratings+annotation&fmt=json';

    const detailPromise = fetchJsonWithRetry(detailUrl, 4, 800, 1050).catch(() => null);

    const coverPromise = fetch('https://coverartarchive.org/release-group/' + encodeURIComponent(id), {
      headers: {
        Accept: 'application/json',
      },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(cData => {
        if (!cData || !Array.isArray(cData.images) || cData.images.length === 0) return '';
        const frontImg = cData.images.find((img: any) => img.front) || cData.images[0];
        if (!frontImg) return '';
        return (
          (frontImg.thumbnails && (frontImg.thumbnails.large || frontImg.thumbnails['500'])) ||
          frontImg.image ||
          ''
        );
      })
      .catch(() => '');

    return Promise.all([detailPromise, coverPromise]).then(([data, coverUrl]) => {
      if (!data && !draftFields.draft_title) {
        throw new Error('MusicBrainz release-group lookup failed');
      }

      const cleanTitle = (data && data.title) || draftFields.draft_title || 'Unknown';
      const releaseDate = (data && data['first-release-date']) || draftFields.draft_release_date || '';
      const year = releaseDate.length >= 4
        ? releaseDate.substring(0, 4)
        : draftFields.draft_year && draftFields.draft_year !== '0000'
        ? draftFields.draft_year
        : '0000';
      const finalTitle = cleanTitle + ' (' + year + ')';

      const artists = data ? formatArtists(data['artist-credit']) : [];
      const artistList = artists.length > 0
        ? makeList(artists)
        : draftFields.draft_artist || draftFields.draft_author || '[[Unknown]]';

      const rawGenres: any[] = data
        ? (Array.isArray(data.genres) && data.genres.length > 0
          ? data.genres
          : Array.isArray(data.tags)
          ? data.tags
          : [])
        : [];
      const sortedGenres = rawGenres
        .slice()
        .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
        .slice(0, 5)
        .map((g: any) => g.name)
        .filter(Boolean);
      const genresList = sortedGenres.length > 0
        ? makeList(sortedGenres)
        : draftFields.draft_genres || '';

      const onlineRating = data && data.rating && data.rating.value
        ? Number(data.rating.value).toFixed(1)
        : '0';

      const fallbackCover = id
        ? 'https://coverartarchive.org/release-group/' + id + '/front-500'
        : '';
      const image = coverUrl || draftFields.draft_cover || draftFields.draft_image || fallbackCover;
      const releaseType = (data && data['primary-type']) || draftFields.draft_release_type || 'Album';

      // Enrich track count, tracklist, and record label from the primary official release (queued at >= 1050ms interval)
      const releases: any[] = data && Array.isArray(data.releases) ? data.releases : [];
      const officialRelease = releases.find((r: any) => r.status === 'Official') || releases[0];
      const targetReleaseId = (officialRelease && officialRelease.id) || draftFields.draft_release_id || '';

      const releaseInfoPromise = targetReleaseId
        ? fetchJsonWithRetry(
          'https://musicbrainz.org/ws/2/release/' +
            encodeURIComponent(targetReleaseId) +
            '?inc=recordings+labels&fmt=json',
          3,
          800,
          1050,
        ).catch(() => null)
        : Promise.resolve(null);

      return releaseInfoPromise.then(releaseData => {
        let trackCount = 'unknown';
        let tracklistPlot = '';
        let labelList = '';

        if (releaseData) {
          if (Array.isArray(releaseData.media) && releaseData.media.length > 0) {
            const totalTracks = releaseData.media.reduce(
              (sum: number, medium: any) => sum + (Number(medium['track-count']) || 0),
              0,
            );
            if (totalTracks > 0) {
              trackCount = String(totalTracks);
            }
            const trackTitles: string[] = [];
            for (const medium of releaseData.media) {
              if (Array.isArray(medium.tracks)) {
                for (const t of medium.tracks) {
                  if (t.title) {
                    trackTitles.push((t.number ? t.number + '. ' : '') + t.title);
                  }
                }
              }
            }
            if (trackTitles.length > 0) {
              tracklistPlot = 'Tracklist:\n' + trackTitles.join('\n');
            }
          }

          if (Array.isArray(releaseData['label-info'])) {
            const labels = releaseData['label-info']
              .map((li: any) => li.label && li.label.name)
              .filter(Boolean);
            const uniqueLabels = [...new Set(labels)];
            if (uniqueLabels.length > 0) {
              labelList = makeList(uniqueLabels);
            }
          }
        }

        const plot = stripHtml((data && data.annotation) || '') || tracklistPlot;

        return {
          title: finalTitle,
          englishTitle: cleanTitle,
          year: year,
          releaseDate: releaseDate,
          dataSource: 'MusicBrainz',
          url: 'https://musicbrainz.org/release-group/' + ((data && data.id) || id),
          id: String((data && data.id) || id),
          artist: artistList,
          releaseType: releaseType,
          tracks: trackCount,
          label: labelList,
          genres: genresList,
          onlineRating: onlineRating,
          image: image,
          released: 'true',
          status: 'Backlog',
          tags: '$:/tags/media-importer/Media',
          'media-type': 'Music',
          modified: formatCustomDate(),
          plot: plot,
        };
      });
    });
  },
};
