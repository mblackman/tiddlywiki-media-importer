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

// --- CORE LOGIC: REGISTER IMPORTER ---
function registerMediaImporter(config: MediaImporterConfig) {
  const type = config.type; // e.g., "book", "game"
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
      apiKey = $tw.wiki.getTiddlerText(config.apiKeyTiddler);
      if (!apiKey) {
        alert('Missing API Key for ' + type + '. Please set it in the Media Importer Plugin Config.');
        $tw.wiki.setText(stateTiddler, 'text', null, '');
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

    const apiKey = config.apiKeyTiddler
      ? $tw.wiki.getTiddlerText(config.apiKeyTiddler)
      : '';

    config
      .fetchFn(temporaryTiddler.fields, apiKey)
      .then(fields => {
        const finalTitle = fields.title;

        // Preserve created date from temporary tiddler or use current time
        if (!fields.created) {
          fields.created = temporaryTiddler.fields.created || new Date();
        }

        // Create Tiddler
        $tw.wiki.addTiddler(new $tw.Tiddler(fields));

        // UI Cleanup
        $tw.notifier.display('$:/temp/notification', {
          variables: { title: finalTitle },
        });
        $tw.wiki.setText(stateTiddler, 'text', null, '');

        // Force Open in StoryList
        const storyList = $tw.wiki.getTiddlerList('$:/StoryList');
        if (storyList.indexOf(finalTitle) !== -1) {
          storyList.splice(storyList.indexOf(finalTitle), 1);
        }
        storyList.unshift(finalTitle);
        $tw.wiki.addTiddler(
          new $tw.Tiddler({ title: '$:/StoryList', list: storyList }),
        );
      })
      .catch(error => {
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
}
