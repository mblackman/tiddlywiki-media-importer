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
    if (attributes[key] !== undefined) {
      attributes_[key] = { type: 'string', value: attributes[key] };
    }
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

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'All');
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
    const allDailyLogs = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Log]!has[draft.of]]');

    // 2. Map Logs (both WatchLog reviews and Daily Activity Logs)
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

    for (const dailyLogTitle of allDailyLogs) {
      const dailyLog = this.wiki.getTiddler(dailyLogTitle);
      if (!dailyLog) continue;
      const logDate = (dailyLog.fields['log-date'] as string) || dailyLogTitle.replace('$:/media-log/', '');
      const itemsInDay = this.wiki.getTiddlerList(dailyLogTitle, 'media-log');
      for (const mediaTitle of itemsInDay) {
        if (!logsByMedia.has(mediaTitle)) logsByMedia.set(mediaTitle, []);
        logsByMedia.get(mediaTitle)!.push({
          rating: 0,
          date: logDate,
          timestamp: logDate,
        });
      }
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
        genres: $tw.utils.parseStringArray((fields['genres'] as string) || '') || [],
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

    const showActiveSplit = currentStatus === 'All';
    const inProgressItems = showActiveSplit ? items.filter(item => item.status === 'Active') : [];
    const gridItemsData = showActiveSplit ? items.filter(item => item.status !== 'Active') : items;

    const totalRated = items.filter(index => index.averageRating > 0);
    const overallRating = totalRated.length > 0
      ? (totalRated.reduce((sum, index) => sum + index.averageRating, 0) / totalRated.length).toFixed(1)
      : '0';

    const countLabel = h('div', { class: 'mi-sublabel mi-library-count' }, [
      h('span', {}, [text('Showing '), h('b', {}, [text(items.length.toString())]), text(` of ${allMedia.length} items`)]),
      h('span', {}, [text(`Avg Rating: ${overallRating} ★`)]),
    ]);

    const makeGrid = (itemsList: MediaItem[]) => {
      if (itemsList.length === 0) {
        return h('div', { class: 'mi-empty-state' }, [
          h('div', { style: 'font-weight: 600; font-style: normal; margin-bottom: 6px; color: <<colour foreground>>;' }, [
            text('No media items match the current filters.'),
          ]),
          h('div', { style: 'margin-bottom: 12px; font-style: normal; font-size: 0.9em;' }, [
            text('Try resetting active filters or import new media into your library.'),
          ]),
          h('div', { class: 'mi-flex-row', style: 'justify-content: center; gap: 10px;' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                message: { type: 'string', value: 'mi-reset-filters' },
              },
              children: [text('Reset Filters')],
            },
            {
              type: 'link',
              attributes: {
                to: { type: 'string', value: '$:/plugins/mblackman/media-importer/ui' },
                class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
              },
              children: [text('+ Import Media')],
            },
          ]),
        ]);
      }
      const gridItemsNodes: IParseTreeNode[] = [];
      for (const item of itemsList) {
        const cardContent = h('div', { class: 'mi-card mi-library-card' }, [
          h('div', { class: 'mi-library-card-image-container' }, [
            item.favorite
              ? h('div', { class: 'mi-library-card-fav', title: 'Favorite' }, [text('★')])
              : text(''),
            currentType === 'All'
              ? h('span', { class: 'mi-library-card-type-badge' }, [text(item.type)])
              : text(''),
            item.image
              ? { type: 'image', attributes: { source: { type: 'string', value: item.image }, class: { type: 'string', value: 'mi-library-card-image' } } }
              : h('div', { class: 'mi-library-card-placeholder' }, [text(item.type)]),
          ]),
          h('div', { class: 'mi-library-card-content' }, [
            h('div', { class: 'mi-library-card-title' }, [text(item.title)]),
            h('div', { class: 'mi-sublabel mi-library-card-rating' }, [
              h('span', { class: `mi-status-text mi-status-${item.status.toLowerCase()}` }, [text(item.status)]),
              h('span', { class: 'mi-star-full' }, [
                item.averageRating > 0 ? text(`${item.averageRating.toFixed(1).replace(/\.0$/, '')} ★`) : text(''),
              ]),
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
      children.push(h('h3', { class: 'mi-section-heading', style: 'margin-bottom: 10px; margin-top: 5px;' }, [text('Currently Active')]));
      children.push(makeGrid(inProgressItems));
      if (gridItemsData.length > 0) {
        children.push(h('h3', { class: 'mi-section-heading', style: 'margin-bottom: 10px; margin-top: 22px;' }, [text('Collection')]));
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
      if (changedTiddlers[t]?.deleted) return true;
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });
    const logsChanged = Object.keys(changedTiddlers).some(t => t.startsWith('$:/data/media-log/') || t.startsWith('$:/media-log/'));

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
    this.addEventListener('mi-reset-filters', this.handleResetFilters.bind(this));
    this.addEventListener('mi-surprise-me', this.handleSurpriseMe.bind(this));
    this.addEventListener('mi-toggle-mobile-filters', this.handleToggleMobileFilters.bind(this));
  }

  handleRefresh() {
    this.refreshSelf();
    return false;
  }

  handleResetFilters() {
    this.wiki.setText('$:/state/mblackman/media-importer/library/type', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/library/status', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/library/genre', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/library/rating', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/library/year', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/library/favorite', 'text', undefined, 'false');
    this.wiki.setText('$:/state/mblackman/media-importer/library/sort', 'text', undefined, 'title-asc');
    this.wiki.setText('$:/temp/mblackman/media-importer/search/library', 'text', undefined, '');
    return false;
  }

  handleToggleMobileFilters() {
    const mobileFilterState = '$:/state/mblackman/media-importer/library/mobile-filters';
    const current = this.wiki.getTiddlerText(mobileFilterState, 'closed');
    this.wiki.setText(mobileFilterState, 'text', undefined, current === 'open' ? 'closed' : 'open');
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
    this.computeAttributes();
    // State Tiddlers
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/library';
    const favoriteTiddler = '$:/state/mblackman/media-importer/library/favorite';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';
    const mobileFilterState = '$:/state/mblackman/media-importer/library/mobile-filters';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'All');
    const currentStatus = this.wiki.getTiddlerText(statusTiddler, 'All');
    const currentGenre = this.wiki.getTiddlerText(genreTiddler, 'All');
    const currentRating = this.wiki.getTiddlerText(ratingTiddler, 'All');
    const currentYear = this.wiki.getTiddlerText(yearTiddler, 'All');
    const currentFavorite = this.wiki.getTiddlerText(favoriteTiddler, 'false').trim();
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'title-asc');
    const isMobileFiltersOpen = this.wiki.getTiddlerText(mobileFilterState, 'closed') === 'open';

    let activeFilterCount = 0;
    if (currentType !== 'All') activeFilterCount++;
    if (currentStatus !== 'All') activeFilterCount++;
    if (currentGenre !== 'All') activeFilterCount++;
    if (currentRating !== 'All') activeFilterCount++;
    if (currentYear !== 'All') activeFilterCount++;
    if (currentFavorite === 'true') activeFilterCount++;

    // --- Filters ---

    // 1. Type Options
    const typeOptions = this.wiki.filterTiddlers('[[$:/plugins/mblackman/media-importer/data/importers]indexes[]]');

    // 2. Year Options (from both WatchLog and Daily Log)
    const yearOptions = this.wiki.filterTiddlers(
      `[tag[$:/tags/media-importer/WatchLog]has[date]get[date]] [tag[$:/tags/media-importer/Log]!has[draft.of]get[log-date]] +[search-replace:g:regexp[-.*$],[]unique[]!sort[]]`,
    );

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

    // --- Top Navigation Header ---
    const appHeader = h('div', { class: 'mi-app-header' }, [
      h('div', { class: 'mi-app-header-title-group' }, [
        h('h2', { class: 'mi-app-heading' }, [text('Media Library')]),
      ]),
      h('div', { class: 'mi-app-header-actions' }, [
        {
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn mi-btn-sm' },
            tooltip: { type: 'string', value: 'Pick a random backlog item' },
            message: { type: 'string', value: 'mi-surprise-me' },
          },
          children: [text('Surprise Me')],
        },
        {
          type: 'link',
          attributes: {
            to: { type: 'string', value: '$:/plugins/mblackman/media-importer/ui' },
            class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
          },
          children: [text('+ Import Media')],
        },
      ]),
    ]);

    // --- Search & Quick Toolbar Row (Always visible above the fold on mobile & desktop!) ---
    const quickSortAddedButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: currentSort === 'added-desc' ? 'mi-btn mi-btn-primary mi-btn-sm' : 'mi-btn mi-btn-sm' },
      },
      children: [
        text('Recently Added'),
        { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: sortTiddler }, text: { type: 'string', value: 'added-desc' } } },
      ],
    } as IParseTreeNode;

    const quickSortFinishedButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: currentSort === 'date-desc' ? 'mi-btn mi-btn-primary mi-btn-sm' : 'mi-btn mi-btn-sm' },
      },
      children: [
        text('Recently Active'),
        { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: sortTiddler }, text: { type: 'string', value: 'date-desc' } } },
      ],
    } as IParseTreeNode;

    const mobileFilterToggleButton = {
      type: 'button',
      attributes: {
        class: {
          type: 'string',
          value: isMobileFiltersOpen || activeFilterCount > 0
            ? 'mi-btn mi-btn-active-subtle mi-btn-sm mi-mobile-filter-toggle'
            : 'mi-btn mi-btn-sm mi-mobile-filter-toggle',
        },
        message: { type: 'string', value: 'mi-toggle-mobile-filters' },
      },
      children: [
        text(
          activeFilterCount > 0
            ? `Filters (${activeFilterCount}) ${isMobileFiltersOpen ? '▴' : '▾'}`
            : `Filters & Sort ${isMobileFiltersOpen ? '▴' : '▾'}`,
        ),
      ],
    } as IParseTreeNode;

    const searchAndQuickBar = h('div', { class: 'mi-library-top-bar' }, [
      h('div', { class: 'mi-library-search-box' }, [
        {
          type: 'edit-text',
          attributes: {
            tiddler: { type: 'string', value: searchTiddler },
            tag: { type: 'string', value: 'input' },
            placeholder: { type: 'string', value: 'Search library by title...' },
            default: { type: 'string', value: '' },
            class: { type: 'string', value: 'mi-input' },
          },
          children: [],
        },
      ]),
      h('div', { class: 'mi-library-quick-actions' }, [
        mobileFilterToggleButton,
        quickSortAddedButton,
        quickSortFinishedButton,
        activeFilterCount > 0
          ? ({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-sm' },
              message: { type: 'string', value: 'mi-reset-filters' },
              tooltip: { type: 'string', value: 'Reset all filters and search' },
            },
            children: [text('Reset')],
          } as IParseTreeNode)
          : text(''),
      ]),
    ]);

    // Helper for Select Options
    const createOption = (value: string, label: string) => h('option', { value }, [text(label)]);

    // Type Select
    const allCount = allMedia.length;
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
        attributes: { tiddler: { type: 'string', value: typeTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
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
    const genreSelectChildren = [createOption('All', 'All Genres'), ...genreOptions.map(g => createOption(g, g.replace(/_/g, ' ')))];
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
          createOption('5', '★★★★★ (5)'),
          createOption('4', '★★★★☆ (4)'),
          createOption('3', '★★★☆☆ (3)'),
          createOption('2', '★★☆☆☆ (2)'),
          createOption('1', '★☆☆☆☆ (1)'),
          createOption('0', 'Unrated'),
        ],
      },
    ]);

    // Year Select
    const yearSelectChildren = [createOption('All', 'All Years'), ...yearOptions.map(y => createOption(y, y))];
    const yearSelect = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Year Active')]),
      {
        type: 'select',
        attributes: { tiddler: { type: 'string', value: yearTiddler }, default: { type: 'string', value: 'All' }, class: { type: 'string', value: 'mi-input' } },
        children: yearSelectChildren,
      },
    ]);

    // Favorite Toggle
    const favoriteToggle = h('div', { class: 'mi-filter-group' }, [
      h('span', { class: 'mi-label' }, [text('Favorites')]),
      {
        type: 'list',
        attributes: { filter: { type: 'string', value: `[title[${favoriteTiddler}]get[text]else[false]match[true]]` }, variable: { type: 'string', value: 'ignore' } },
        children: [{
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-input mi-fav-filter-btn mi-fav-filter-active' },
          },
          children: [
            text('Favorites Only'),
            h('span', { class: 'mi-star-full' }, [text('★')]),
            { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: favoriteTiddler }, text: { type: 'string', value: 'false' } } },
          ],
        }],
      },
      {
        type: 'list',
        attributes: { filter: { type: 'string', value: `[title[${favoriteTiddler}]get[text]else[false]!match[true]]` }, variable: { type: 'string', value: 'ignore' } },
        children: [{
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-input mi-fav-filter-btn' },
          },
          children: [
            text('Show Favorites'),
            h('span', { class: 'mi-star-inactive' }, [text('☆')]),
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
          createOption('date-desc', 'Active Date (Newest)'),
          createOption('date-asc', 'Active Date (Oldest)'),
          createOption('added-desc', 'Added Date (Newest)'),
          createOption('added-asc', 'Added Date (Oldest)'),
        ],
      },
    ]);

    // Reset Filters Button
    const resetButton = {
      type: 'button',
      attributes: {
        class: { type: 'string', value: 'mi-btn mi-refresh-btn' },
        message: { type: 'string', value: 'mi-reset-filters' },
        tooltip: { type: 'string', value: 'Reset all filters and search' },
      },
      children: [text('Reset All')],
    } as IParseTreeNode;

    // Collapsible Filter Drawer Container
    const controls = h(
      'div',
      {
        class: isMobileFiltersOpen
          ? 'mi-library-filters-drawer mi-library-filters-open'
          : 'mi-library-filters-drawer',
      },
      [
        h('div', { class: 'mi-library-controls' }, [
          typeSelect,
          statusSelect,
          genreSelect,
          ratingSelect,
          yearSelect,
          favoriteToggle,
          sortSelect,
          resetButton,
        ]),
      ],
    );

    const shell = h('div', { class: 'mi-page-shell' }, [
      appHeader,
      searchAndQuickBar,
      controls,
      { type: 'MediaLibraryGrid', attributes: {}, children: [] },
    ]);

    this.makeChildWidgets([shell]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const importersTiddler = '$:/plugins/mblackman/media-importer/data/importers';
    const typeTiddler = '$:/state/mblackman/media-importer/library/type';
    const statusTiddler = '$:/state/mblackman/media-importer/library/status';
    const genreTiddler = '$:/state/mblackman/media-importer/library/genre';
    const ratingTiddler = '$:/state/mblackman/media-importer/library/rating';
    const yearTiddler = '$:/state/mblackman/media-importer/library/year';
    const favoriteTiddler = '$:/state/mblackman/media-importer/library/favorite';
    const sortTiddler = '$:/state/mblackman/media-importer/library/sort';
    const mobileFilterState = '$:/state/mblackman/media-importer/library/mobile-filters';

    const stateChanged = [
      importersTiddler,
      typeTiddler,
      statusTiddler,
      genreTiddler,
      ratingTiddler,
      yearTiddler,
      favoriteTiddler,
      sortTiddler,
      mobileFilterState,
    ].some(t => changedTiddlers[t]);

    const mediaChanged = Object.keys(changedTiddlers).some(t => {
      if (changedTiddlers[t]?.deleted) return true;
      const tid = this.wiki.getTiddler(t);
      return tid?.hasTag('$:/tags/media-importer/Media');
    });

    const logsChanged = Object.keys(changedTiddlers).some(t => t.startsWith('$:/data/media-log/') || t.startsWith('$:/media-log/'));

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
