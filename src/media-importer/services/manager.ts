/*\
title: $:/plugins/mblackman/media-importer/services/manager.ts
type: application/javascript
module-type: startup

Unified Media Manager for Books, Comics, Games, Manga, Movies, Music, and TV Shows.
Fetches data from various APIs and formats them into fields.
\*/

import { AniListConfig } from './api/anilist';
import { ComicVineConfig } from './api/comicvine';
import { MusicBrainzConfig } from './api/musicbrainz';
import { OpenLibraryConfig } from './api/openlibrary';
import { RawgConfig } from './api/rawg';
import { TmdbMovieConfig, TmdbTvConfig } from './api/tmdb';
import { MediaImporterConfig } from './api/types';
import { formatCustomDate, makeList } from './api/utils';

declare const $tw: any;

export const name = 'media-manager-startup';
export const platforms = ['browser'];
export const after = ['startup'];
export const synchronous = true;

const registeredConfigs = new Map<string, MediaImporterConfig>();

const RESERVED_DRAFT_FIELDS = new Set([
  'title',
  'tags',
  'text',
  'type',
  'created',
  'modified',
  'creator',
  'modifier',
  'extra_tags',
  'silent',
  'cleanup_draft',
  'result_index',
  'imported_title',
  'batch_selected',
]);

function mergeTagLists(...tagInputs: Array<string | string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const raw of tagInputs) {
    if (!raw) continue;
    const parsed: string[] = Array.isArray(raw) ? raw : ($tw.utils.parseStringArray(raw) || []);
    for (const tag of parsed) {
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        merged.push(tag);
      }
    }
  }
  return merged;
}

function formatLogError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getTodayDateString(): string {
  return $tw.utils.formatDateString(new Date(), 'YYYY-0MM-0DD');
}

function logMediaToday(mediaTitle: string) {
  const todayDate = getTodayDateString();
  const todayLogTitle = '$:/media-log/' + todayDate;
  const existingLog = $tw.wiki.getTiddler(todayLogTitle) || new $tw.Tiddler({ title: todayLogTitle });
  const currentItems: string[] = $tw.wiki.getTiddlerList(todayLogTitle, 'media-log') || [];
  if (!currentItems.includes(mediaTitle)) {
    currentItems.push(mediaTitle);
  }
  const existingTags: string[] = (existingLog.fields.tags || []).slice();
  if (!existingTags.includes('$:/tags/media-importer/Log')) {
    existingTags.push('$:/tags/media-importer/Log');
  }
  const listString = currentItems.map((item: string) => '[[' + item + ']]').join(' ');
  $tw.wiki.addTiddler(
    new $tw.Tiddler(existingLog, {
      'media-log': listString,
      tags: existingTags,
      'log-date': todayDate,
      modified: new Date(),
    }),
  );
}

function openTiddlerInStory(finalTitle: string) {
  const storyList = ($tw.wiki.getTiddlerList('$:/StoryList') || []).slice();
  const existingIndex = storyList.indexOf(finalTitle);
  if (existingIndex !== -1) {
    storyList.splice(existingIndex, 1);
  }
  storyList.unshift(finalTitle);
  $tw.wiki.addTiddler(
    new $tw.Tiddler($tw.wiki.getTiddler('$:/StoryList'), { title: '$:/StoryList', list: storyList }),
  );
}

// --- CORE LOGIC: REGISTER IMPORTER ---
function registerMediaImporter(config: MediaImporterConfig) {
  registeredConfigs.set(config.type, config);
  const type = config.type; // e.g., "Book", "Game"
  const stateTiddler = '$:/state/' + type + '-search';
  const searchPrefix = '$:/temp/search/' + (config.prefix || type + '-result') + '/';

  // 1. SEARCH LISTENER
  $tw.rootWidget.addEventListener('tm-search-' + type, function(event: any) {
    const query = event.param;
    if (!query) return;

    let page = 1;
    if (event.paramObject && event.paramObject.page) {
      page = parseInt(event.paramObject.page, 10);
    } else if (event.page) {
      page = parseInt(event.page, 10);
    }

    // Check API Key if required
    let apiKey = '';
    if (config.apiKeyTiddler) {
      apiKey = ($tw.wiki.getTiddlerText(config.apiKeyTiddler) || '').trim();
      if (!apiKey) {
        $tw.wiki.setText(stateTiddler, 'text', null, 'missing-key');
        return;
      }
    }

    $tw.wiki.setText(stateTiddler, 'text', null, 'loading');

    // Clear previous results
    const oldResults = $tw.wiki.filterTiddlers(
      '[prefix[' + searchPrefix + ']]',
    );
    for (let index = 0; index < oldResults.length; index++) {
      $tw.wiki.deleteTiddler(oldResults[index]);
    }

    // Execute Search Strategy
    config
      .searchFn(query, apiKey, page)
      .then(results => {
        if (!results || results.length === 0) {
          $tw.wiki.setText(stateTiddler, 'text', null, 'done');
          return;
        }

        results.forEach(function(item, index) {
          const fields = Object.assign(
            {
              title: searchPrefix + String(index).padStart(2, '0'),
              tags: config.searchTag || 'SearchResult',
              result_index: String(index),
            },
            item,
          );
          $tw.wiki.addTiddler(new $tw.Tiddler(fields));
        });
        $tw.wiki.setText(stateTiddler, 'text', null, 'done');
      })
      .catch(error => {
        console.error(type + ' Search Error: ' + formatLogError(error));
        $tw.wiki.setText(stateTiddler, 'text', null, 'error');
      });
  });

  // 2. FETCH DETAILS LISTENER
  $tw.rootWidget.addEventListener('tm-fetch-' + type, function(event: any) {
    const temporaryTitle = event.param;
    const temporaryTiddler = $tw.wiki.getTiddler(temporaryTitle);
    if (!temporaryTiddler) return;

    const draftFields: Record<string, any> = temporaryTiddler.fields || {};
    const isSilent = Boolean(
      draftFields.silent === 'yes' ||
        (event.paramObject && event.paramObject.silent === 'yes'),
    );
    const cleanupDraft = Boolean(
      draftFields.cleanup_draft === 'yes' ||
        (event.paramObject && event.paramObject.cleanupDraft === 'yes'),
    );

    const fetchingStateTitle = '$:/temp/fetching/' + temporaryTitle;
    if (!isSilent) {
      $tw.wiki.setText(fetchingStateTitle, 'text', null, 'loading');
    }

    const apiKey = config.apiKeyTiddler
      ? ($tw.wiki.getTiddlerText(config.apiKeyTiddler) || '').trim()
      : '';

    const defaultStatus = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/status', 'Backlog') || 'Backlog').trim();
    const namingPattern = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/naming', 'title-year') || 'title-year').trim();
    const globalCustomTags = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/tags', '') || '').trim();
    const autoLogToday = !isSilent && (
      ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/log-today', 'no') || 'no').trim() === 'yes' ||
      (event.paramObject && event.paramObject.logToday === 'yes')
    );
    const autoOpen = !isSilent && (
      ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/auto-open', 'no') || 'no').trim() === 'yes' ||
      (event.paramObject && event.paramObject.autoOpen === 'yes')
    );

    config
      .fetchFn(draftFields, apiKey)
      .then(fields => {
        if (!isSilent) {
          $tw.wiki.deleteTiddler(fetchingStateTitle);
        }

        const stagedTitle = ((draftFields.staged_title as string) || '').trim();
        const stagedStatus = ((draftFields.staged_status as string) || '').trim();
        const stagedNotes = ((draftFields.staged_notes as string) || '').trim();
        const stagedSource = ((draftFields.staged_source as string) || '').trim();
        const stagedTags = ((draftFields.staged_tags as string) || '').trim();
        const stagedCoverUri = ((draftFields.staged_cover_uri as string) || '').trim();
        const stagedCoverMode = ((draftFields.staged_cover_mode as string) || '').trim();

        let finalTitle = fields.title;
        if (stagedTitle) {
          finalTitle = stagedTitle;
        } else if (namingPattern === 'title-only' && fields.englishTitle) {
          finalTitle = String(fields.englishTitle).trim();
        }
        fields.title = finalTitle;

        const existingTiddler = $tw.wiki.getTiddler(finalTitle);

        // Preserve created date and user fields if re-importing an existing tiddler
        if (existingTiddler) {
          fields.created = existingTiddler.fields.created || fields.created || new Date();
          if (stagedStatus) {
            fields.status = stagedStatus;
          } else if (existingTiddler.fields.status) {
            fields.status = existingTiddler.fields.status;
          } else {
            fields.status = defaultStatus;
          }
          if (existingTiddler.fields.favorite) {
            fields.favorite = existingTiddler.fields.favorite;
          }
          if (existingTiddler.fields.rating) {
            fields.rating = existingTiddler.fields.rating;
          }
          for (const bKey of ['backlog-rank', 'backlog-notes', 'backlog-source', 'backlog-commitment']) {
            if (existingTiddler.fields[bKey] !== undefined) {
              fields[bKey] = existingTiddler.fields[bKey];
            }
          }
        } else {
          if (!fields.created) {
            fields.created = draftFields.created || new Date();
          }
          fields.status = stagedStatus || defaultStatus || 'Backlog';
        }

        if (stagedNotes) {
          fields['backlog-notes'] = stagedNotes;
        }
        if (stagedSource) {
          fields['backlog-source'] = stagedSource;
        }

        // Mirror plot -> description so view-template.tid displays the overview
        if (fields.plot && !fields.description) {
          fields.description = fields.plot;
        }

        // Merge tags: existing tags + base Media tag + global staging tags + per-item staged tags + extra_tags
        fields.tags = mergeTagLists(
          existingTiddler ? existingTiddler.fields.tags : undefined,
          '$:/tags/media-importer/Media',
          fields.tags,
          !isSilent ? globalCustomTags : undefined,
          stagedTags,
          draftFields.extra_tags as string | undefined,
          event.paramObject ? (event.paramObject.extraTags as string | undefined) : undefined,
        );

        // Copy any custom non-draft, non-staged fields from the temporary draft tiddler
        for (const key of Object.keys(draftFields)) {
          if (!key.startsWith('draft_') && !key.startsWith('staged_') && !RESERVED_DRAFT_FIELDS.has(key)) {
            fields[key] = draftFields[key];
          }
        }

        // Apply custom cover URI / embedded data URI if staged
        if (stagedCoverUri) {
          fields.image = stagedCoverUri;
          fields['cover-storage'] = stagedCoverMode || (stagedCoverUri.startsWith('data:') ? 'embedded' : 'external-uri');
        } else if (fields.image) {
          fields['cover-storage'] = String(fields.image).startsWith('data:') ? 'embedded' : 'external-uri';
        }

        // Auto-log today if enabled
        if (autoLogToday) {
          logMediaToday(finalTitle);
          if (!fields.status || fields.status === 'Backlog') {
            fields.status = 'Active';
          }
        }

        // Create/Update Tiddler
        $tw.wiki.addTiddler(new $tw.Tiddler(existingTiddler, fields));

        if (cleanupDraft) {
          $tw.wiki.deleteTiddler(temporaryTitle);
        } else {
          // Mark temporary search result tiddler with the resolved finalTitle and deselect from batch queue
          const latestTemporary = $tw.wiki.getTiddler(temporaryTitle);
          if (latestTemporary) {
            $tw.wiki.addTiddler(
              new $tw.Tiddler(latestTemporary, {
                imported_title: finalTitle,
                batch_selected: 'no',
              }),
            );
          }
        }

        if (!isSilent) {
          // Track last imported media for quick-jump banner
          $tw.wiki.addTiddler(
            new $tw.Tiddler({
              title: '$:/temp/media-importer/last-imported',
              text: finalTitle,
              'media-type': type,
              timestamp: $tw.utils.formatDateString(new Date(), '0hh:0mm:0ss'),
            }),
          );

          // UI Notification
          $tw.notifier.display('$:/plugins/mblackman/media-importer/ui/notification', {
            variables: { title: finalTitle },
          });

          // Only open in StoryList if user explicitly enabled auto-open or passed autoOpen
          if (autoOpen) {
            openTiddlerInStory(finalTitle);
          }
        }
      })
      .catch(error => {
        if (!isSilent) {
          $tw.wiki.deleteTiddler(fetchingStateTitle);
        }
        console.error(type + ' Fetch Error: ' + formatLogError(error));
        if (!isSilent) {
          $tw.notifier.display('$:/plugins/mblackman/media-importer/ui/error-notification', {
            variables: { title: 'Error fetching ' + type + ' details.' },
          });
        }
      });
  });
}

export function startup() {
  registerMediaImporter(OpenLibraryConfig);
  registerMediaImporter(ComicVineConfig);
  registerMediaImporter(RawgConfig);
  registerMediaImporter(AniListConfig);
  registerMediaImporter(TmdbMovieConfig);
  registerMediaImporter(MusicBrainzConfig);
  registerMediaImporter(TmdbTvConfig);

  // 3. BATCH IMPORT SELECTED SEARCH RESULTS
  $tw.rootWidget.addEventListener('tm-batch-fetch-media', function(event: any) {
    const type = (event.param || ($tw.wiki && $tw.wiki.getTiddlerText('$:/state/media-importer-selected')) || 'Book').trim();
    const config = registeredConfigs.get(type);
    if (!config) return;
    const resultTag = config.searchTag || 'SearchResult';
    const selectedResults = $tw.wiki.filterTiddlers(`[tag[${resultTag}]field:batch_selected[yes]]`);
    for (const temporaryTitle of selectedResults) {
      $tw.rootWidget.dispatchEvent({
        type: 'tm-fetch-' + type,
        param: temporaryTitle,
      });
    }
  });

  // 4. MANUAL / CUSTOM MEDIA ENTRY & COVER DROPZONE IMPORT
  $tw.rootWidget.addEventListener('tm-import-manual-media', function(event: any) {
    const statePrefix = '$:/temp/media-importer/manual';
    const rawTitle = ($tw.wiki.getTiddlerText(statePrefix + '/title', '') || '').trim();
    if (!rawTitle) return;

    const mediaType = ($tw.wiki.getTiddlerText(statePrefix + '/type', 'Book') || 'Book').trim();
    const year = ($tw.wiki.getTiddlerText(statePrefix + '/year', '') || '').trim() || String(new Date().getFullYear());
    const creator = ($tw.wiki.getTiddlerText(statePrefix + '/creator', '') || '').trim();
    const status = ($tw.wiki.getTiddlerText(statePrefix + '/status', 'Backlog') || 'Backlog').trim();
    const genresRaw = ($tw.wiki.getTiddlerText(statePrefix + '/genres', '') || '').trim();
    const customTagsRaw = ($tw.wiki.getTiddlerText(statePrefix + '/tags', '') || '').trim();
    const coverUri = ($tw.wiki.getTiddlerText(statePrefix + '/cover-uri', '') || '').trim();
    const coverMode = ($tw.wiki.getTiddlerText(statePrefix + '/cover-mode', 'external-uri') || 'external-uri').trim();
    const externalUrl = ($tw.wiki.getTiddlerText(statePrefix + '/url', '') || '').trim();
    const plot = ($tw.wiki.getTiddlerText(statePrefix + '/plot', '') || '').trim();
    const namingPattern = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/naming', 'title-year') || 'title-year').trim();
    const autoLogToday = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/log-today', 'no') || 'no').trim() === 'yes';
    const autoOpen = ($tw.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/auto-open', 'no') || 'no').trim() === 'yes' ||
      (event.paramObject && event.paramObject.autoOpen === 'yes');

    const hasYearSuffix = /\(\d{4}\)$/.test(rawTitle);
    const finalTitle = namingPattern === 'title-only' || hasYearSuffix
      ? rawTitle
      : `${rawTitle} (${year})`;

    const genresList = genresRaw
      ? makeList(genresRaw.split(',').map((g: string) => g.trim()).filter(Boolean))
      : '';
    const creatorList = creator
      ? makeList(creator.split(',').map((c: string) => c.trim()).filter(Boolean))
      : '';

    const tags = ['$:/tags/media-importer/Media'];
    const parsedExtraTags = $tw.utils.parseStringArray(customTagsRaw) || [];
    for (const t of parsedExtraTags) {
      if (t && !tags.includes(t)) tags.push(t);
    }

    const fields: Record<string, any> = {
      title: finalTitle,
      englishTitle: rawTitle,
      year: year,
      dataSource: 'Manual',
      url: externalUrl,
      id: '',
      status: status,
      tags: tags,
      'media-type': mediaType,
      image: coverUri,
      'cover-storage': coverUri ? coverMode : '',
      genres: genresList,
      plot: plot,
      onlineRating: '0',
      created: new Date(),
      modified: formatCustomDate(),
    };

    if (mediaType === 'Book' || mediaType === 'Manga') {
      fields.author = creatorList || '[[Unknown]]';
      if (mediaType === 'Book') {
        fields.book_title = rawTitle;
        fields.pages = 'unknown';
        fields.isbn = 'unknown';
      } else {
        fields.volumes = 'unknown';
      }
    } else if (mediaType === 'Movie') {
      fields.director = creatorList;
      fields.runtime = 'unknown';
    } else if (mediaType === 'TV Show') {
      fields.creator = creatorList;
      fields.seasons = 'unknown';
      fields.episodes = 'unknown';
    } else if (mediaType === 'Game') {
      fields.developers = creatorList;
    } else if (mediaType === 'Comic') {
      fields.publisher = creatorList;
      fields.count_of_issues = 'unknown';
    } else if (mediaType === 'Music') {
      fields.artist = creatorList || '[[Unknown]]';
      fields.tracks = 'unknown';
    }

    if (autoLogToday) {
      logMediaToday(finalTitle);
      if (fields.status === 'Backlog') {
        fields.status = 'Active';
      }
    }

    const existingTiddler = $tw.wiki.getTiddler(finalTitle);
    $tw.wiki.addTiddler(new $tw.Tiddler(existingTiddler, fields));

    // Also create a companion cover media tiddler with _canonical_uri if requested by user
    const createCanonicalCoverTiddler = ($tw.wiki.getTiddlerText(statePrefix + '/create-canonical-tiddler', 'no') || 'no').trim() === 'yes';
    if (createCanonicalCoverTiddler && coverUri && !coverUri.startsWith('data:')) {
      const coverTiddlerTitle = finalTitle + '/Cover';
      $tw.wiki.addTiddler(
        new $tw.Tiddler({
          title: coverTiddlerTitle,
          type: 'image/jpeg',
          _canonical_uri: coverUri,
          tags: '$:/tags/media-importer/Cover',
          'media-parent': finalTitle,
          modified: formatCustomDate(),
        }),
      );
    }

    // Clear manual form inputs
    for (const suffix of ['/title', '/creator', '/genres', '/tags', '/cover-uri', '/url', '/plot', '/cover-filename']) {
      $tw.wiki.deleteTiddler(statePrefix + suffix);
    }

    // Track last imported media for quick-jump banner
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: '$:/temp/media-importer/last-imported',
        text: finalTitle,
        'media-type': mediaType,
        timestamp: $tw.utils.formatDateString(new Date(), '0hh:0mm:0ss'),
      }),
    );

    $tw.notifier.display('$:/plugins/mblackman/media-importer/ui/notification', {
      variables: { title: finalTitle },
    });

    if (autoOpen) {
      openTiddlerInStory(finalTitle);
    }
  });

  // 5. REFRESH EXISTING MEDIA METADATA FROM ORIGINAL SOURCE
  $tw.rootWidget.addEventListener('tm-refresh-media', function(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return;

    const existingTiddler = $tw.wiki.getTiddler(targetTitle);
    if (!existingTiddler) return;

    const existingFields = existingTiddler.fields;
    const mediaType = existingFields['media-type'] as string;
    const config = registeredConfigs.get(mediaType);
    if (!config || !existingFields.id) return;

    const refreshStateTitle = '$:/temp/refreshing/' + targetTitle;

    let apiKey = '';
    if (config.apiKeyTiddler) {
      apiKey = ($tw.wiki.getTiddlerText(config.apiKeyTiddler) || '').trim();
      if (!apiKey) {
        $tw.wiki.setText(refreshStateTitle, 'text', null, 'missing-key');
        setTimeout(() => {
          $tw.wiki.deleteTiddler(refreshStateTitle);
        }, 3500);
        return;
      }
    }

    $tw.wiki.setText(refreshStateTitle, 'text', null, 'loading');

    const draftFields = {
      draft_id: String(existingFields.id),
      draft_title: String(existingFields.englishTitle || existingFields.book_title || existingFields.title || ''),
      draft_year: String(existingFields.year || '0000'),
      draft_image: String(existingFields.image || ''),
      draft_cover: String(existingFields.image || ''),
      draft_poster: String(existingFields.image || ''),
      draft_author: String(existingFields.author || existingFields.artist || ''),
      draft_artist: String(existingFields.artist || ''),
      draft_publisher: String(existingFields.publisher || ''),
      draft_pages: existingFields.pages && existingFields.pages !== 'unknown' ? String(existingFields.pages) : '',
      draft_isbn: existingFields.isbn && existingFields.isbn !== 'unknown' ? String(existingFields.isbn) : '',
    };

    config
      .fetchFn(draftFields, apiKey)
      .then(updatedFields => {
        // Keep the existing tiddler title so all WatchLogs and Daily Logs remain linked
        updatedFields.title = targetTitle;
        updatedFields.created = existingFields.created || new Date();
        if (existingFields.status) {
          updatedFields.status = existingFields.status;
        }
        if (existingFields.favorite) {
          updatedFields.favorite = existingFields.favorite;
        }
        for (const bKey of ['backlog-rank', 'backlog-notes', 'backlog-source', 'backlog-commitment']) {
          if (existingFields[bKey] !== undefined) {
            updatedFields[bKey] = existingFields[bKey];
          }
        }
        const existingTags = (existingFields.tags || []).slice();
        if (!existingTags.includes('$:/tags/media-importer/Media')) {
          existingTags.push('$:/tags/media-importer/Media');
        }
        updatedFields.tags = existingTags;

        $tw.wiki.addTiddler(new $tw.Tiddler(existingTiddler, updatedFields));
        $tw.wiki.setText(refreshStateTitle, 'text', null, 'done');
        setTimeout(() => {
          $tw.wiki.deleteTiddler(refreshStateTitle);
        }, 2500);
      })
      .catch(error => {
        console.error(mediaType + ' Refresh Error: ' + formatLogError(error));
        $tw.wiki.setText(refreshStateTitle, 'text', null, 'error');
        setTimeout(() => {
          $tw.wiki.deleteTiddler(refreshStateTitle);
        }, 3500);
      });
  });
}
