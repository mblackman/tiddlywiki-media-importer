/*\
title: $:/plugins/mblackman/media-importer/services/manager.ts
type: application/javascript
module-type: startup

Unified Media Manager for Books, Comics, Games, and Manga.
Fetches data from various APIs and formats them into fields.
\*/

import { MediaImporterConfig } from './api/types';
import { OpenLibraryConfig } from './api/openlibrary';
import { ComicVineConfig } from './api/comicvine';
import { RawgConfig } from './api/rawg';
import { AniListConfig } from './api/anilist';
import { TmdbMovieConfig, TmdbTvConfig } from './api/tmdb';

declare const $tw: any;

export const name = 'media-manager-startup';
export const platforms = ['browser'];
export const after = ['startup'];
export const synchronous = true;

const registeredConfigs = new Map<string, MediaImporterConfig>();

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
              title: searchPrefix + index,
              tags: config.searchTag || 'SearchResult',
            },
            item,
          );
          $tw.wiki.addTiddler(new $tw.Tiddler(fields));
        });
        $tw.wiki.setText(stateTiddler, 'text', null, 'done');
      })
      .catch(error => {
        console.error(type + ' Search Error:', error);
        $tw.wiki.setText(stateTiddler, 'text', null, 'error');
      });
  });

  // 2. FETCH DETAILS LISTENER
  $tw.rootWidget.addEventListener('tm-fetch-' + type, function(event: any) {
    const temporaryTitle = event.param;
    const temporaryTiddler = $tw.wiki.getTiddler(temporaryTitle);
    if (!temporaryTiddler) return;

    const fetchingStateTitle = '$:/temp/fetching/' + temporaryTitle;
    $tw.wiki.setText(fetchingStateTitle, 'text', null, 'loading');

    const apiKey = config.apiKeyTiddler
      ? ($tw.wiki.getTiddlerText(config.apiKeyTiddler) || '').trim()
      : '';

    config
      .fetchFn(temporaryTiddler.fields, apiKey)
      .then(fields => {
        $tw.wiki.deleteTiddler(fetchingStateTitle);
        const finalTitle = fields.title;
        const existingTiddler = $tw.wiki.getTiddler(finalTitle);

        // Preserve created date and user fields if re-importing an existing tiddler
        if (existingTiddler) {
          fields.created = existingTiddler.fields.created || new Date();
          if (existingTiddler.fields.status) {
            fields.status = existingTiddler.fields.status;
          }
          if (existingTiddler.fields.favorite) {
            fields.favorite = existingTiddler.fields.favorite;
          }
          const existingTags = (existingTiddler.fields.tags || []).slice();
          if (!existingTags.includes('$:/tags/media-importer/Media')) {
            existingTags.push('$:/tags/media-importer/Media');
          }
          fields.tags = existingTags;
        } else if (!fields.created) {
          fields.created = temporaryTiddler.fields.created || new Date();
        }

        // Create/Update Tiddler
        $tw.wiki.addTiddler(new $tw.Tiddler(existingTiddler, fields));

        // UI Cleanup
        $tw.notifier.display('$:/temp/notification', {
          variables: { title: finalTitle },
        });

        // Force Open in StoryList
        const storyList = ($tw.wiki.getTiddlerList('$:/StoryList') || []).slice();
        const existingIndex = storyList.indexOf(finalTitle);
        if (existingIndex !== -1) {
          storyList.splice(existingIndex, 1);
        }
        storyList.unshift(finalTitle);
        $tw.wiki.addTiddler(
          new $tw.Tiddler($tw.wiki.getTiddler('$:/StoryList'), { title: '$:/StoryList', list: storyList }),
        );
      })
      .catch(error => {
        $tw.wiki.deleteTiddler(fetchingStateTitle);
        console.error(type + ' Fetch Error:', error);
        $tw.notifier.display('$:/temp/notification', {
          variables: { title: 'Error fetching ' + type + ' details.' },
        });
      });
  });
}

export function startup() {
  registerMediaImporter(OpenLibraryConfig);
  registerMediaImporter(ComicVineConfig);
  registerMediaImporter(RawgConfig);
  registerMediaImporter(AniListConfig);
  registerMediaImporter(TmdbMovieConfig);
  registerMediaImporter(TmdbTvConfig);

  // 3. REFRESH EXISTING MEDIA METADATA FROM ORIGINAL SOURCE
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
      draft_author: String(existingFields.author || ''),
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
        console.error(mediaType + ' Refresh Error:', error);
        $tw.wiki.setText(refreshStateTitle, 'text', null, 'error');
        setTimeout(() => {
          $tw.wiki.deleteTiddler(refreshStateTitle);
        }, 3500);
      });
  });
}
