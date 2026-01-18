/*\
title: $:/plugins/mblackman/media-importer/widget-media-library.ts
type: application/javascript
module-type: widget

Media Library Widget
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

const h = (tag: string, attributes: Record<string, any> = {}, children: IParseTreeNode[] = []): IParseTreeNode => {
  const attributes_: Record<string, any> = {};
  for (const key in attributes) {
    attributes_[key] = { type: 'string', value: attributes[key] };
  }
  return { type: 'element', tag, attributes: attributes_, children };
};

const text = (string_: string): IParseTreeNode => ({ type: 'text', text: string_ });

class MediaLibraryWidget extends Widget {
  execute() {
    // State Tiddlers
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';

    // Current Values
    const currentType = this.wiki.getTiddlerText(typeTiddler, 'Book');
    const currentRating = this.wiki.getTiddlerText(ratingTiddler, 'All');
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'title-asc');
    const currentYear = this.wiki.getTiddlerText(yearTiddler, 'All');
    const currentSearch = this.wiki.getTiddlerText(searchTiddler, '');

    // --- Filters ---

    // 1. Type Options
    const typeOptions = this.wiki.filterTiddlers('[[$:/plugins/mblackman/media-importer/data/importers]indexes[]]');

    // 2. Year Options
    // Regex to strip date to year: -.*$
    const yearFilter = `[tag[$:/tags/media-importer/Media]media-type[${currentType}]has[lastFinished]get[lastFinished]search-replace:g:regexp[-.*$],[]unique[]!sort[]]`;
    const yearOptions = this.wiki.filterTiddlers(yearFilter);

    // 3. Main Content Filter
    let filter = `[tag[$:/tags/media-importer/Media]media-type[${currentType}]]`;

    if (currentSearch) {
      filter += ` +[search{${searchTiddler}}]`;
    }

    if (currentRating !== 'All') {
      if (currentRating === '0') {
        filter += ` -[has[personalRating]!field:personalRating[0]]`;
      } else {
        filter += ` +[field:personalRating[${currentRating}]]`;
      }
    }

    if (currentYear !== 'All') {
      filter += ` +[search:lastFinished[${currentYear}]]`;
    }

    // Sort
    switch (currentSort) {
      case 'title-asc':
        filter += ` +[sort[title]]`;
        break;
      case 'title-desc':
        filter += ` +[!sort[title]]`;
        break;
      case 'rating-asc':
        filter += ` +[sort[personalRating]]`;
        break;
      case 'rating-desc':
        filter += ` +[!sort[personalRating]]`;
        break;
      case 'date-desc':
        filter += ` +[has[lastFinished]!sort[lastFinished]]`;
        break;
      case 'date-asc':
        filter += ` +[has[lastFinished]sort[lastFinished]]`;
        break;
    }
    console.log('Media Library Filter:', filter);
    const results = this.wiki.filterTiddlers(filter);

    // --- UI Construction ---

    // Helper for Select Options
    const createOption = (value: string, label: string) => h('option', { value }, [text(label)]);

    // Type Select
    const typeSelectChildren = typeOptions.map(t => {
      const count = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/Media]media-type[${t}]]`).length;
      return createOption(t, `${t} (${count})`);
    });

    const typeSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Type')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: typeTiddler }, default: { type: 'string', value: 'Book' }, class: { type: 'string', value: 'mi-input' } },
        children: typeSelectChildren,
      },
    ]);

    // Rating Select
    const ratingSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Rating')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: ratingTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: [
          createOption('All', 'All Ratings'),
          createOption('5', '⭐⭐⭐⭐⭐ (5)'),
          createOption('4', '⭐⭐⭐⭐ (4)'),
          createOption('3', '⭐⭐⭐ (3)'),
          createOption('2', '⭐⭐ (2)'),
          createOption('1', '⭐ (1)'),
          createOption('0', 'Unrated'),
        ],
      },
    ]);

    // Year Select
    const yearSelectChildren = [createOption('All', 'All Years'), ...yearOptions.map(y => createOption(y, y))];
    const yearSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Year Finished')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: yearTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: yearSelectChildren,
      },
    ]);

    // Sort Select
    const sortSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Sort by')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: sortTiddler }, default: { type: 'string', value: 'title-asc' }, class: { type: 'string', value: 'mi-input' } },
        children: [
          createOption('title-asc', 'Title (A-Z)'),
          createOption('title-desc', 'Title (Z-A)'),
          createOption('rating-desc', 'Rating (High-Low)'),
          createOption('rating-asc', 'Rating (Low-High)'),
          createOption('date-desc', 'Finished Date (Newest)'),
          createOption('date-asc', 'Finished Date (Oldest)'),
        ],
      },
    ]);

    // Controls Container
    const controls = h('div', { class: 'mi-section' }, [
      h('div', { style: 'display: flex; flex-wrap: wrap; gap: 15px;' }, [
        typeSelect,
        ratingSelect,
        yearSelect,
        sortSelect,
      ]),
    ]);

    // Search Input
    const searchInput = h('div', { class: 'mi-section-tight' }, [
      {
        type: 'edit-text',
        attributes: {
          tiddler: { type: 'string', value: searchTiddler },
          tag: { type: 'string', value: 'input' },
          placeholder: { type: 'string', value: 'Search library...' },
          default: { type: 'string', value: '' },
          class: { type: 'string', value: 'mi-input' },
        },
        children: [],
      },
    ]);

    // Count Label
    const countLabel = h('div', { class: 'mi-sublabel', style: 'margin-bottom: 15px;' }, [
      text('Found '),
      h('b', {}, [text(results.length.toString())]),
      text(' items'),
    ]);

    // Grid
    const gridItems: IParseTreeNode[] = [];
    for (const title of results) {
      const tiddler = this.wiki.getTiddler(title);
      if (!tiddler) continue;

      const image = tiddler.fields.image as string;
      const rating = tiddler.fields.personalRating as string;

      const cardContent = h('div', { class: 'mi-card', style: 'padding: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; transition: transform 0.2s;' }, [
        h('div', { style: 'aspect-ratio: 16/9; overflow: hidden; background: #000; position: relative;' }, [
          image
            ? { type: 'image', attributes: { source: { type: 'string', value: image }, style: { type: 'string', value: 'width: 100%; height: 100%; object-fit: contain;' } } }
            : text(''),
        ]),
        h('div', { style: 'padding: 12px; flex-grow: 1; display: flex; flex-direction: column;' }, [
          h('div', { style: 'font-weight: 600; line-height: 1.3; margin-bottom: 4px;' }, [text(title)]),
          h('div', { class: 'mi-sublabel', style: 'margin-top: auto;' }, [
            rating && rating !== '0' ? text(`${rating} ★`) : text(''),
          ]),
        ]),
      ]);

      gridItems.push({
        type: 'link',
        attributes: { to: { type: 'string', value: title }, style: { type: 'string', value: 'text-decoration: none; color: inherit;' } },
        children: [cardContent],
      });
    }

    const grid = h('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 20px;' }, gridItems);

    this.makeChildWidgets([controls, searchInput, countLabel, grid]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const statePrefix = '$:/state/mblackman/media-importer/library/';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';
    const importersTiddler = '$:/plugins/mblackman/media-importer/data/importers';

    // Check if any state tiddler changed
    const stateChanged = Object.keys(changedTiddlers).some(t => t.startsWith(statePrefix) || t === searchTiddler || t === importersTiddler);

    // Check if any media items changed (for list updates)
    const mediaChanged = Object.keys(changedTiddlers).some(t => {
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });

    if (stateChanged || mediaChanged) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

declare let exports: {
  MediaLibrary: typeof MediaLibraryWidget;
};

exports.MediaLibrary = MediaLibraryWidget;
