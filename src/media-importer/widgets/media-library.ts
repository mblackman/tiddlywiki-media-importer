/*\
title: $:/plugins/mblackman/media-importer/widget-media-library.ts
type: application/javascript
module-type: widget

Media Library Widget
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

const h = (tag: string, attributes: Record<string, string | undefined> = {}, children: IParseTreeNode[] = []): IParseTreeNode => {
  const attributes_: Record<string, any> = {};
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
  created: Date;
  favorite: boolean;
  genres: string[];
}

class MediaLibraryGridWidget extends Widget {
  execute() {
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';
    const favoriteTiddler = '$:/state/mblackman/media-importer/library/favorite';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'Book');
    const currentRating = this.wiki.getTiddlerText(ratingTiddler, 'All');
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'title-asc');
    const currentYear = this.wiki.getTiddlerText(yearTiddler, 'All');
    const currentStatus = this.wiki.getTiddlerText(statusTiddler, 'All');
    const currentSearch = this.wiki.getTiddlerText(searchTiddler, '');
    const currentFavorite = this.wiki.getTiddlerText(favoriteTiddler, 'false').trim();
    const currentGenre = this.wiki.getTiddlerText(genreTiddler, 'All');

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
      const fields: Record<string, any> = tiddler?.fields || {};
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
        created: (fields['created'] as Date) || new Date(0),
        favorite: fields['favorite'] === 'yes',
        genres: $tw.utils.parseStringArray(fields['genres'] as string || '') || [],
      };
    });

    // 4. Filter
    if (currentType !== 'All') {
      items = items.filter(index => index.type === currentType);
    }

    if (currentStatus !== 'All') {
      items = items.filter(index => index.status === currentStatus);
    }

    if (currentGenre !== 'All') {
      items = items.filter(index => index.genres.includes(currentGenre));
    }

    if (currentSearch) {
      const lower = currentSearch.toLowerCase();
      items = items.filter(index => index.title.toLowerCase().includes(lower) || index.englishTitle.toLowerCase().includes(lower));
    }

    if (currentYear !== 'All') {
      items = items.filter(index => index.logs.some(l => l.date.startsWith(currentYear)));
    }

    if (currentFavorite === 'true') {
      items = items.filter(index => index.favorite);
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
        case 'added-desc':
          return b.created.getTime() - a.created.getTime();
        case 'added-asc':
          return a.created.getTime() - b.created.getTime();
        default:
          return a.title.localeCompare(b.title);
      }
    });

    const inProgressItems = items.filter(item => item.status === 'Active');
    const gridItemsData = items.filter(item => item.status !== 'Active');

    const totalRated = items.filter(i => i.averageRating > 0);
    const overallRating = totalRated.length > 0 
      ? (totalRated.reduce((sum, i) => sum + i.averageRating, 0) / totalRated.length).toFixed(1)
      : '0';

    const countLabel = h('div', { class: 'mi-sublabel mi-library-count', style: 'display: flex; justify-content: space-between; margin-bottom: 10px;' }, [
      h('span', {}, [text('Found '), h('b', {}, [text(items.length.toString())]), text(' items')]),
      h('span', {}, [text(`Avg Rating: ${overallRating} ★`)]),
    ]);

    const makeGrid = (itemsList: MediaItem[]) => {
      const gridItemsNodes: IParseTreeNode[] = [];
      for (const item of itemsList) {
        const cardContent = h('div', { class: 'mi-card mi-library-card' }, [
          h('div', { class: 'mi-library-card-image-container', style: 'position: relative;' }, [
            item.favorite
              ? h('div', { style: 'position: absolute; top: 5px; left: 5px; color: #f59e0b; font-size: 1.2em; text-shadow: 0 1px 2px rgba(0,0,0,0.6); z-index: 10;' }, [text('★')])
              : text(''),
            item.image
              ? { type: 'image', attributes: { source: { type: 'string', value: item.image }, class: { type: 'string', value: 'mi-library-card-image' } } }
              : text(''),
          ]),
          h('div', { class: 'mi-library-card-content' }, [
            h('div', { class: 'mi-library-card-title' }, [text(item.title)]),
            h('div', { class: 'mi-sublabel mi-library-card-rating' }, [
              item.averageRating > 0 ? text(`${item.averageRating.toFixed(1).replace(/\.0$/, '')} ★`) : text(''),
            ]),
          ]),
        ]);

        gridItemsNodes.push({
          type: 'link',
          attributes: { to: { type: 'string', value: item.title }, class: { type: 'string', value: 'mi-library-card-link' } },
          children: [cardContent],
        });
      }
      return h('div', { class: 'mi-library-grid' }, gridItemsNodes);
    };

    const children: IParseTreeNode[] = [countLabel];

    if (inProgressItems.length > 0) {
      children.push(h('h3', { style: 'margin-bottom: 10px; margin-top: 5px;' }, [text('Active')]));
      children.push(makeGrid(inProgressItems));
      if (gridItemsData.length > 0) {
        children.push(h('h3', { style: 'margin-bottom: 10px; margin-top: 20px;' }, [text('Library')]));
      }
    }
    
    if (gridItemsData.length > 0 || inProgressItems.length === 0) {
      children.push(makeGrid(gridItemsData));
    }

    this.makeChildWidgets(children);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';
    const favoriteTiddler = '$:/state/mblackman/media-importer/library/favorite';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';

    const stateChanged = [typeTiddler, ratingTiddler, sortTiddler, yearTiddler, statusTiddler, searchTiddler, favoriteTiddler, genreTiddler].some(t => changedTiddlers[t]);
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
    this.addEventListener('mi-surprise-me', this.handleSurpriseMe.bind(this));
  }

  handleRefresh() {
    this.refreshSelf();
    return false;
  }

  handleSurpriseMe() {
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';
    
    const currentType = this.wiki.getTiddlerText(typeTiddler, 'All');
    const currentGenre = this.wiki.getTiddlerText(genreTiddler, 'All');
    
    let backlog = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]status[Backlog]]');

    if (currentType !== 'All') {
      backlog = backlog.filter(title => {
        const t = this.wiki.getTiddler(title);
        return t && t.fields['media-type'] === currentType;
      });
    }

    if (currentGenre !== 'All') {
      backlog = backlog.filter(title => {
        const t = this.wiki.getTiddler(title);
        if (!t || !t.fields.genres) return false;
        const parsed = $tw.utils.parseStringArray(t.fields.genres as string) || [];
        return parsed.includes(currentGenre);
      });
    }

    if (backlog.length > 0) {
      const randomItem = backlog[Math.floor(Math.random() * backlog.length)];
      this.dispatchEvent({ type: 'tm-navigate', navigateTo: randomItem } as any);
    }
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
    const favoriteTiddler = '$:/state/mblackman/media-importer/library/favorite';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'Book');

    // --- Filters ---

    // 1. Type Options
    const typeOptions = this.wiki.filterTiddlers('[[$:/plugins/mblackman/media-importer/data/importers]indexes[]]');

    // 2. Year Options
    const yearOptions = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/WatchLog]has[date]get[date]search-replace:g:regexp[-.*$],[]unique[]!sort[]]`);

    // 3. Status Options
    const statusOptions = this.wiki.filterTiddlers('[enlist{$:/plugins/mblackman/media-importer/data/statuses}]');

    // 4. Genre Options
    const allMedia = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]]');
    const genreSet = new Set<string>();
    for (const title of allMedia) {
      const tiddler = this.wiki.getTiddler(title);
      if (tiddler && tiddler.fields.genres) {
        if (currentType !== 'All' && tiddler.fields['media-type'] !== currentType) {
          continue;
        }
        const parsed = $tw.utils.parseStringArray(tiddler.fields.genres as string) || [];
        for (const g of parsed) {
          genreSet.add(g);
        }
      }
    }
    const genreOptions = Array.from(genreSet).sort();

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

    const typeSelect = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Type')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: typeTiddler }, default: { type: 'string', value: 'Book' }, class: { type: 'string', value: 'mi-input' } },
        children: typeSelectChildren,
      },
    ]);

    // Status Select
    const statusSelectChildren = [createOption('All', 'All Statuses'), ...statusOptions.map(s => createOption(s, s))];
    const statusSelect = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Status')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: statusTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: statusSelectChildren,
      },
    ]);

    // Genre Select
    const genreSelectChildren = [createOption('All', 'All Genres'), ...genreOptions.map(g => createOption(g, g))];
    const genreSelect = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Genre')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: genreTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: genreSelectChildren,
      },
    ]);

    // Rating Select
    const ratingSelect = h('div', { class: 'mi-filter-group' }, [
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
    const yearSelect = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Year Finished')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: yearTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: yearSelectChildren,
      },
    ]);

    // Favorite Toggle
    const favoriteToggle = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Favorites')]),
      // Active State (True) -> Button to unset
      {
        type: 'list',
        attributes: { filter: { type: 'string', value: `[title[${favoriteTiddler}]get[text]else[false]match[true]]` }, variable: { type: 'string', value: 'ignore' } },
        children: [{
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-input' },
            style: { type: 'string', value: 'text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; height: 2.5em;' },
          },
          children: [
            text('Show Favorites'),
            h('span', { style: 'color: #f59e0b;' }, [text('★')]),
            { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: favoriteTiddler }, text: { type: 'string', value: 'false' } } },
          ],
        }],
      },
      // Inactive State (False) -> Button to set
      {
        type: 'list',
        attributes: { filter: { type: 'string', value: `[title[${favoriteTiddler}]get[text]else[false]!match[true]]` }, variable: { type: 'string', value: 'ignore' } },
        children: [{
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-input' },
            style: { type: 'string', value: 'text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; width: 100%; height: 2.5em;' },
          },
          children: [
            text('Show Favorites'),
            h('span', { style: 'color: #ccc;' }, [text('☆')]),
            { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: favoriteTiddler }, text: { type: 'string', value: 'true' } } },
          ],
        }],
      },
    ]);

    // Sort Select
    const sortSelect = h('div', { class: 'mi-filter-group' }, [
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
          createOption('added-desc', 'Added Date (Newest)'),
          createOption('added-asc', 'Added Date (Oldest)'),
        ],
      },
    ]);

    // Refresh Button
    const refreshButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn mi-refresh-btn' },
        message: { type: 'string', value: 'mi-refresh-library' },
        tooltip: { type: 'string', value: 'Refresh Library' },
      },
      children: [text('↻')],
    } as IParseTreeNode;

    // Surprise Me Button
    const surpriseMeButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn mi-action-btn' },
        style: { type: 'string', value: 'margin-left: 8px;' },
        tooltip: { type: 'string', value: 'Pick a random backlog item' },
        message: { type: 'string', value: 'mi-surprise-me' },
      },
      children: [text('🎲 Surprise Me')],
    } as IParseTreeNode;
    
    // Quick Sort: Recently Added
    const quickSortAddedButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn' },
        style: { type: 'string', value: 'margin-left: 8px;' },
      },
      children: [
        text('Recently Added'),
        { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: sortTiddler }, text: { type: 'string', value: 'added-desc' } } }
      ],
    } as IParseTreeNode;

    // Quick Sort: Recently Finished
    const quickSortFinishedButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn' },
        style: { type: 'string', value: 'margin-left: 8px;' },
      },
      children: [
        text('Recently Finished'),
        { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: sortTiddler }, text: { type: 'string', value: 'date-desc' } } }
      ],
    } as IParseTreeNode;

    // Controls Container
    const controls = h('div', { class: 'mi-section' }, [
      h('div', { class: 'mi-library-controls' }, [
        typeSelect,
        statusSelect,
        genreSelect,
        ratingSelect,
        yearSelect,
        favoriteToggle,
        sortSelect,
        refreshButton,
        surpriseMeButton,
      ]),
      h('div', { style: 'margin-top: 10px; display: flex; align-items: center;' }, [
        text('Quick Sort: '),
        quickSortAddedButton,
        quickSortFinishedButton,
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
    const importersTiddler = '$:/plugins/mblackman/media-importer/data/importers';
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';

    const importersChanged = changedTiddlers[importersTiddler];
    const typeChanged = changedTiddlers[typeTiddler];

    // Check if any media items changed (for list updates)
    const mediaChanged = Object.keys(changedTiddlers).some(t => {
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });

    // Check if any log items changed (for list updates)
    const logsChanged = Object.keys(changedTiddlers).some(t => t.startsWith('$:/data/media-log/'));

    if (importersChanged || mediaChanged || logsChanged || typeChanged) {
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
