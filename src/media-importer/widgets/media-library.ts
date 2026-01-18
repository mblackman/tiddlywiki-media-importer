/*\
title: $:/plugins/mblackman/media-importer/widget-media-library.ts
type: application/javascript
module-type: widget

Media Library Widget
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

const h = (tag: string, attributes: Record<string, string | undefined> = {}, children: IParseTreeNode[] = []): IParseTreeNode => {
  const attributes_: Record<string, { type: string; value: string | undefined }> = {};
  for (const key in attributes) {
    attributes_[key] = { type: 'string', value: attributes[key] };
  }
  return { type: 'element', tag, attributes: attributes_, children };
};

const text = (string_: string): IParseTreeNode => ({ type: 'text', text: string_ });

interface LogEntry {
  rating: number;
  date: string;
  timestamp: string;
}

interface MediaItem {
  title: string;
  englishTitle: string;
  type: string;
  status: string;
  image: string;
  logs: LogEntry[];
  averageRating: number;
  lastWatched: string;
}

class MediaLibraryGridWidget extends Widget {
  execute() {
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'Book');
    const currentRating = this.wiki.getTiddlerText(ratingTiddler, 'All');
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'title-asc');
    const currentYear = this.wiki.getTiddlerText(yearTiddler, 'All');
    const currentStatus = this.wiki.getTiddlerText(statusTiddler, 'All');
    const currentSearch = this.wiki.getTiddlerText(searchTiddler, '');

    // 1. Fetch Data
    const allMedia = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]]');
    const allLogs = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/WatchLog]]');

    // 2. Map Logs
    const logsByMedia = new Map<string, LogEntry[]>();
    for (const logTitle of allLogs) {
      const log = this.wiki.getTiddler(logTitle);
      if (!log) continue;
      const mediaTitle = log.fields['media-title'] as string;
      if (!mediaTitle) continue;

      if (!logsByMedia.has(mediaTitle)) logsByMedia.set(mediaTitle, []);
      logsByMedia.get(mediaTitle)!.push({
        rating: parseInt((log.fields.rating as string) || '0', 10),
        date: (log.fields.date as string) || '',
        timestamp: (log.fields.timestamp as string) || '',
      });
    }

    // 3. Build Models
    let items: MediaItem[] = allMedia.map(title => {
      const tiddler = this.wiki.getTiddler(title);
      const fields = tiddler?.fields || {};
      const logs = logsByMedia.get(title) || [];

      // Calculate Stats
      const ratedLogs = logs.filter(l => l.rating > 0);
      const averageRating = ratedLogs.length > 0
        ? ratedLogs.reduce((sum, l) => sum + l.rating, 0) / ratedLogs.length
        : 0;

      // Sort logs by date desc to find last watched
      logs.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.timestamp.localeCompare(a.timestamp);
      });
      const lastWatched = logs.length > 0 ? logs[0].date : '';

      return {
        title,
        englishTitle: (fields['englishTitle'] as string) || '',
        type: (fields['media-type'] as string) || 'Unknown',
        status: (fields['status'] as string) || 'Backlog',
        image: (fields['image'] as string) || '',
        logs,
        averageRating,
        lastWatched,
      };
    });

    // 4. Filter
    if (currentType !== 'All') {
      items = items.filter(index => index.type === currentType);
    }

    if (currentStatus !== 'All') {
      items = items.filter(index => index.status === currentStatus);
    }

    if (currentSearch) {
      const lower = currentSearch.toLowerCase();
      items = items.filter(index => index.title.toLowerCase().includes(lower) || index.englishTitle.toLowerCase().includes(lower));
    }

    if (currentYear !== 'All') {
      items = items.filter(index => index.logs.some(l => l.date.startsWith(currentYear)));
    }

    if (currentRating !== 'All') {
      if (currentRating === '0') {
        // Unrated: Exclude items that have any log with rating > 0
        items = items.filter(index => !index.logs.some(l => l.rating > 0));
      } else {
        const r = parseInt(currentRating, 10);
        items = items.filter(index => index.logs.some(l => l.rating === r));
      }
    }

    // 5. Sort
    items.sort((a, b) => {
      switch (currentSort) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'rating-desc':
          return b.averageRating - a.averageRating;
        case 'rating-asc':
          return a.averageRating - b.averageRating;
        case 'date-desc':
          return b.lastWatched.localeCompare(a.lastWatched);
        case 'date-asc':
          return a.lastWatched.localeCompare(b.lastWatched);
        default:
          return a.title.localeCompare(b.title);
      }
    });

    const countLabel = h('div', { class: 'mi-sublabel', style: 'margin-bottom: 15px;' }, [
      text('Found '),
      h('b', {}, [text(items.length.toString())]),
      text(' items'),
    ]);

    const gridItems: IParseTreeNode[] = [];
    for (const item of items) {
      const cardContent = h('div', { class: 'mi-card', style: 'padding: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; transition: transform 0.2s;' }, [
        h('div', { style: 'aspect-ratio: 16/9; overflow: hidden; background: #000; position: relative;' }, [
          item.image
            ? { type: 'image', attributes: { source: { type: 'string', value: item.image }, style: { type: 'string', value: 'width: 100%; height: 100%; object-fit: contain;' } } }
            : text(''),
        ]),
        h('div', { style: 'padding: 12px; flex-grow: 1; display: flex; flex-direction: column;' }, [
          h('div', { style: 'font-weight: 600; line-height: 1.3; margin-bottom: 4px;' }, [text(item.title)]),
          h('div', { class: 'mi-sublabel', style: 'margin-top: auto;' }, [
            item.averageRating > 0 ? text(`${item.averageRating.toFixed(1).replace(/\.0$/, '')} ★`) : text(''),
          ]),
        ]),
      ]);

      gridItems.push({
        type: 'link',
        attributes: { to: { type: 'string', value: item.title }, style: { type: 'string', value: 'text-decoration: none; color: inherit;' } },
        children: [cardContent],
      });
    }

    const grid = h('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 20px;' }, gridItems);

    this.makeChildWidgets([countLabel, grid]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';

    const stateChanged = [typeTiddler, ratingTiddler, sortTiddler, yearTiddler, statusTiddler, searchTiddler].some(t => changedTiddlers[t]);
    const mediaChanged = Object.keys(changedTiddlers).some(t => {
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });
    const logsChanged = Object.keys(changedTiddlers).some(t => t.startsWith('$:/data/media-log/'));

    if (stateChanged || mediaChanged || logsChanged) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

class MediaLibraryWidget extends Widget {
  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
    this.addEventListener('mi-refresh-library', this.handleRefresh.bind(this));
  }

  handleRefresh() {
    this.refreshSelf();
    return false;
  }

  execute() {
    // State Tiddlers
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';

    // --- Filters ---

    // 1. Type Options
    const typeOptions = this.wiki.filterTiddlers('[[$:/plugins/mblackman/media-importer/data/importers]indexes[]]');

    // 2. Year Options
    const yearOptions = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/WatchLog]has[date]get[date]search-replace:g:regexp[-.*$],[]unique[]!sort[]]`);

    // 3. Status Options
    const statusOptions = this.wiki.filterTiddlers('[enlist{$:/plugins/mblackman/media-importer/data/statuses}]');

    // --- UI Construction ---

    // Helper for Select Options
    const createOption = (value: string, label: string) => h('option', { value }, [text(label)]);

    // Type Select
    const allCount = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/Media]]`).length;
    const typeSelectChildren = [
      createOption('All', `All Types (${allCount})`),
      ...typeOptions.map(t => {
        const count = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/Media]media-type[${t}]]`).length;
        return createOption(t, `${t} (${count})`);
      }),
    ];

    const typeSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Type')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: typeTiddler }, default: { type: 'string', value: 'Book' }, class: { type: 'string', value: 'mi-input' } },
        children: typeSelectChildren,
      },
    ]);

    // Status Select
    const statusSelectChildren = [createOption('All', 'All Statuses'), ...statusOptions.map(s => createOption(s, s))];
    const statusSelect = h('div', { style: 'flex: 1; min-width: 140px;' }, [
      h('span', { class: 'mi-label' }, [text('Status')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: statusTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: statusSelectChildren,
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

    // Refresh Button
    const refreshButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn' },
        style: { type: 'string', value: 'height: 32px; align-self: flex-end;' },
        message: { type: 'string', value: 'mi-refresh-library' },
        tooltip: { type: 'string', value: 'Refresh Library' },
      },
      children: [text('↻')],
    };

    // Controls Container
    const controls = h('div', { class: 'mi-section' }, [
      h('div', { style: 'display: flex; flex-wrap: wrap; gap: 15px; align-items: flex-end;' }, [
        typeSelect,
        statusSelect,
        ratingSelect,
        yearSelect,
        sortSelect,
        refreshButton,
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

    this.makeChildWidgets([controls, searchInput, { type: 'MediaLibraryGrid', attributes: {}, children: [] }]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const statePrefix = '$:/state/mblackman/media-importer/library/';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';
    const importersTiddler = '$:/plugins/mblackman/media-importer/data/importers';

    // Check if any state tiddler changed
    const stateChanged = Object.keys(changedTiddlers).some(t => (t.startsWith(statePrefix) || t === importersTiddler) && t !== searchTiddler);

    // Check if any media items changed (for list updates)
    const mediaChanged = Object.keys(changedTiddlers).some(t => {
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });

    // Check if any log items changed (for list updates)
    const logsChanged = Object.keys(changedTiddlers).some(t => t.startsWith('$:/data/media-log/'));

    if (stateChanged || mediaChanged || logsChanged) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

declare let exports: {
  MediaLibrary: typeof MediaLibraryWidget;
  MediaLibraryGrid: typeof MediaLibraryGridWidget;
};

exports.MediaLibrary = MediaLibraryWidget;
exports.MediaLibraryGrid = MediaLibraryGridWidget;
