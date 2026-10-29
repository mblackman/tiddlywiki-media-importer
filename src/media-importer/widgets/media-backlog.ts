/*\
title: $:/plugins/mblackman/media-importer/widgets/media-backlog.ts
type: application/javascript
module-type: widget

Media Backlog Management Widget
Provides a spacious, visual ranked queue (#1..#N), commitment & genre filtering,
inline notes/recommender tracking, batch triage, and 1-click transition to Active.
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

declare const $tw: any;

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

export type CommitmentBucket = 'Quick' | 'Standard' | 'Long' | 'Unknown';

interface BacklogItemModel {
  title: string;
  displayTitle: string;
  englishTitle: string;
  type: string;
  status: string;
  image: string;
  year: string;
  creator: string;
  genres: string[];
  onlineRating: number;
  created: Date;
  favorite: boolean;
  rank: number; // 0 if unranked, 1..N if ranked
  notes: string;
  source: string;
  lengthLabel: string;
  commitment: CommitmentBucket;
  plot: string;
  batchSelected: boolean;
}

function cleanCreatorField(raw: string): string {
  if (!raw || raw === '[[Unknown]]' || raw === 'unknown') return '';
  const parsed: string[] = ($tw.utils && $tw.utils.parseStringArray(raw)) || [raw];
  return parsed
    .map(item => item.replace(/_/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
}

function extractCreator(fields: Record<string, any>): string {
  const raw = (fields.author as string) ||
    (fields.director as string) ||
    (fields.creator as string) ||
    (fields.developers as string) ||
    (fields.artist as string) ||
    (fields.publisher as string) ||
    '';
  return cleanCreatorField(raw);
}

function stripHtmlTags(raw: string): string {
  return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function computeLengthAndCommitment(fields: Record<string, any>): { label: string; bucket: CommitmentBucket } {
  const explicitCommitment = ((fields['backlog-commitment'] as string) || '').trim() as CommitmentBucket;
  const type = (fields['media-type'] as string) || '';

  if (type === 'Movie') {
    const mins = parseInt((fields.runtime as string) || '0', 10);
    if (mins > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (mins <= 100 ? 'Quick' : mins <= 140 ? 'Standard' : 'Long');
      return { label: `${mins} min`, bucket };
    }
  } else if (type === 'Book') {
    const pages = parseInt((fields.pages as string) || '0', 10);
    if (pages > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (pages <= 250 ? 'Quick' : pages <= 450 ? 'Standard' : 'Long');
      return { label: `${pages} pages`, bucket };
    }
  } else if (type === 'TV Show') {
    const episodes = parseInt((fields.episodes as string) || '0', 10);
    const seasons = parseInt((fields.seasons as string) || '0', 10);
    if (episodes > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (episodes <= 12 ? 'Quick' : episodes <= 40 ? 'Standard' : 'Long');
      const label = seasons > 0 ? `${seasons}S • ${episodes} ep` : `${episodes} ep`;
      return { label, bucket };
    }
  } else if (type === 'Manga') {
    const volumes = parseInt((fields.volumes as string) || '0', 10);
    if (volumes > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (volumes <= 5 ? 'Quick' : volumes <= 20 ? 'Standard' : 'Long');
      return { label: `${volumes} vol`, bucket };
    }
  } else if (type === 'Comic') {
    const issues = parseInt((fields.count_of_issues as string) || '0', 10);
    if (issues > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (issues <= 6 ? 'Quick' : issues <= 24 ? 'Standard' : 'Long');
      return { label: `${issues} issues`, bucket };
    }
  } else if (type === 'Music') {
    const tracks = parseInt((fields.tracks as string) || '0', 10);
    if (tracks > 0) {
      const bucket: CommitmentBucket = explicitCommitment || (tracks <= 8 ? 'Quick' : tracks <= 16 ? 'Standard' : 'Long');
      return { label: `${tracks} tracks`, bucket };
    }
  }

  if (explicitCommitment && (explicitCommitment === 'Quick' || explicitCommitment === 'Standard' || explicitCommitment === 'Long')) {
    return { label: explicitCommitment, bucket: explicitCommitment };
  }
  return { label: '', bucket: 'Unknown' };
}

function buildBacklogModel(wiki: any, title: string): BacklogItemModel {
  const tiddler = wiki.getTiddler(title);
  const fields: Record<string, any> = tiddler?.fields || {};
  const rawRank = parseInt((fields['backlog-rank'] as string) || '0', 10);
  const rank = Number.isFinite(rawRank) && rawRank > 0 ? rawRank : 0;

  const onlineRating = parseFloat((fields.onlineRating as string) || '0') || 0;
  const { label: lengthLabel, bucket: commitment } = computeLengthAndCommitment(fields);

  const year = fields.year && fields.year !== '0000' ? String(fields.year) : '';
  const englishTitle = ((fields.englishTitle as string) || (fields.book_title as string) || '').trim();
  const displayTitle = englishTitle || title.replace(/\s*\(\d{4}\)$/, '');

  return {
    title,
    displayTitle,
    englishTitle,
    type: (fields['media-type'] as string) || 'Unknown',
    status: (fields.status as string) || 'Backlog',
    image: (fields.image as string) || '',
    year,
    creator: extractCreator(fields),
    genres: ($tw.utils && $tw.utils.parseStringArray((fields.genres as string) || '')) || [],
    onlineRating,
    created: (fields.created as Date) || new Date(0),
    favorite: fields.favorite === 'yes',
    rank,
    notes: ((fields['backlog-notes'] as string) || '').trim(),
    source: ((fields['backlog-source'] as string) || '').trim(),
    lengthLabel,
    commitment,
    plot: stripHtmlTags(((fields.plot as string) || (fields.description as string) || '').trim()),
    batchSelected: fields['backlog_selected'] === 'yes',
  };
}

function sortBacklogItems(items: BacklogItemModel[], sortMode: string): BacklogItemModel[] {
  const copy = items.slice();
  copy.sort((a, b) => {
    switch (sortMode) {
      case 'rank-asc': {
        const aRanked = a.rank > 0;
        const bRanked = b.rank > 0;
        if (aRanked && bRanked && a.rank !== b.rank) return a.rank - b.rank;
        if (aRanked !== bRanked) return aRanked ? -1 : 1;
        return a.title.localeCompare(b.title);
      }
      case 'rating-desc':
        if (b.onlineRating !== a.onlineRating) return b.onlineRating - a.onlineRating;
        return a.title.localeCompare(b.title);
      case 'added-asc':
        return a.created.getTime() - b.created.getTime();
      case 'added-desc':
        return b.created.getTime() - a.created.getTime();
      case 'year-desc':
        return (b.year || '0000').localeCompare(a.year || '0000');
      case 'title-asc':
      default:
        return a.title.localeCompare(b.title);
    }
  });
  return copy;
}

function filterBacklogItems(
  items: BacklogItemModel[],
  currentType: string,
  currentGenre: string,
  currentCommitment: string,
  currentSearch: string,
): BacklogItemModel[] {
  let result = items;
  if (currentType !== 'All') {
    result = result.filter(item => item.type === currentType);
  }
  if (currentGenre !== 'All') {
    result = result.filter(item => item.genres.includes(currentGenre));
  }
  if (currentCommitment !== 'All') {
    result = result.filter(item => item.commitment === currentCommitment);
  }
  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase().trim();
    result = result.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.englishTitle.toLowerCase().includes(q) ||
        item.creator.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.genres.some(g => g.toLowerCase().replace(/_/g, ' ').includes(q)),
    );
  }
  return result;
}

class MediaBacklogListWidget extends Widget {
  private lastStructuralSignature: string = '';
  private draggedTitle: string = '';

  private computeStructuralSignature(): string {
    const typeTiddler = '$:/state/mblackman/media-importer/backlog/type';
    const genreTiddler = '$:/state/mblackman/media-importer/backlog/genre';
    const commitmentTiddler = '$:/state/mblackman/media-importer/backlog/commitment';
    const sortTiddler = '$:/state/mblackman/media-importer/backlog/sort';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/backlog';
    const spotlightTiddler = '$:/temp/mblackman/media-importer/backlog/spotlight';

    const stateValues = [
      this.wiki.getTiddlerText(typeTiddler, 'All'),
      this.wiki.getTiddlerText(genreTiddler, 'All'),
      this.wiki.getTiddlerText(commitmentTiddler, 'All'),
      this.wiki.getTiddlerText(sortTiddler, 'rank-asc'),
      this.wiki.getTiddlerText(searchTiddler, ''),
      this.wiki.getTiddlerText(spotlightTiddler, ''),
    ].join('|');

    const backlogTitles = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]status[Backlog]] [tag[$:/tags/media-importer/Media]!has[status]]');
    const itemSignatures = backlogTitles.map((title: string) => {
      const t = this.wiki.getTiddler(title);
      const f: Record<string, any> = t?.fields || {};
      const drawerState = this.wiki.getTiddlerText(`$:/temp/mblackman/media-importer/backlog-drawer/${title}`, 'closed');
      return [
        title,
        f.status || 'Backlog',
        f['backlog-rank'] || '',
        f['backlog-commitment'] || '',
        f.favorite || '',
        f['media-type'] || '',
        f.image || '',
        f['backlog_selected'] || '',
        drawerState,
        drawerState === 'closed' ? `${f['backlog-notes'] || ''}~${f['backlog-source'] || ''}` : 'editing',
      ].join(':');
    });

    return `${stateValues}##${itemSignatures.join(';')}`;
  }

  render(parent: Element, nextSibling: Element | null) {
    super.render(parent, nextSibling);
    const wrapper = this.domNodes[0] as HTMLElement | undefined;
    if (wrapper && typeof (wrapper as any).addEventListener === 'function') {
      this.attachDragListeners(wrapper);
    }
  }

  private attachDragListeners(wrapper: HTMLElement) {
    const clearDragClasses = () => {
      const highlighted = wrapper.querySelectorAll('.mi-backlog-row-dragover, .mi-backlog-row-dragging');
      for (let index = 0; index < highlighted.length; index++) {
        highlighted[index].classList.remove('mi-backlog-row-dragover', 'mi-backlog-row-dragging');
      }
    };

    wrapper.addEventListener('dragstart', (event: DragEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.('.mi-backlog-row[data-media-title]') as HTMLElement | null;
      if (!target) return;
      const mediaTitle = target.getAttribute('data-media-title') || '';
      if (!mediaTitle) return;
      this.draggedTitle = mediaTitle;
      target.classList.add('mi-backlog-row-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', mediaTitle);
      }
    });

    wrapper.addEventListener('dragover', (event: DragEvent) => {
      if (!this.draggedTitle) return;
      const target = (event.target as HTMLElement | null)?.closest?.('.mi-backlog-row[data-media-title]') as HTMLElement | null;
      if (!target) return;
      const overTitle = target.getAttribute('data-media-title') || '';
      if (!overTitle || overTitle === this.draggedTitle) return;
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      const previousOver = wrapper.querySelectorAll('.mi-backlog-row-dragover');
      for (let index = 0; index < previousOver.length; index++) {
        if (previousOver[index] !== target) {
          previousOver[index].classList.remove('mi-backlog-row-dragover');
        }
      }
      target.classList.add('mi-backlog-row-dragover');
    });

    wrapper.addEventListener('dragleave', (event: DragEvent) => {
      const target = (event.target as HTMLElement | null)?.closest?.('.mi-backlog-row[data-media-title]') as HTMLElement | null;
      if (target && !target.contains(event.relatedTarget as Node | null)) {
        target.classList.remove('mi-backlog-row-dragover');
      }
    });

    wrapper.addEventListener('dragend', () => {
      this.draggedTitle = '';
      clearDragClasses();
    });

    wrapper.addEventListener('drop', (event: DragEvent) => {
      const sourceTitle = this.draggedTitle || event.dataTransfer?.getData('text/plain') || '';
      this.draggedTitle = '';
      clearDragClasses();
      if (!sourceTitle) return;
      const target = (event.target as HTMLElement | null)?.closest?.('.mi-backlog-row[data-media-title]') as HTMLElement | null;
      if (!target) return;
      const targetTitle = target.getAttribute('data-media-title') || '';
      if (!targetTitle || targetTitle === sourceTitle) return;
      event.preventDefault();
      this.dispatchEvent({
        type: 'mi-backlog-drop-reorder',
        param: sourceTitle,
        paramObject: { targetTitle },
      } as any);
    });
  }

  execute() {
    const typeTiddler = '$:/state/mblackman/media-importer/backlog/type';
    const genreTiddler = '$:/state/mblackman/media-importer/backlog/genre';
    const commitmentTiddler = '$:/state/mblackman/media-importer/backlog/commitment';
    const sortTiddler = '$:/state/mblackman/media-importer/backlog/sort';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/backlog';
    const spotlightTiddler = '$:/temp/mblackman/media-importer/backlog/spotlight';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'All');
    const currentGenre = this.wiki.getTiddlerText(genreTiddler, 'All');
    const currentCommitment = this.wiki.getTiddlerText(commitmentTiddler, 'All');
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'rank-asc');
    const currentSearch = this.wiki.getTiddlerText(searchTiddler, '');
    const spotlightTitle = (this.wiki.getTiddlerText(spotlightTiddler, '') || '').trim();

    this.lastStructuralSignature = this.computeStructuralSignature();

    const rawBacklogTitles = this.wiki.filterTiddlers(
      '[tag[$:/tags/media-importer/Media]status[Backlog]] [tag[$:/tags/media-importer/Media]!has[status]] +[unique[]]',
    );
    const allBacklogItems = rawBacklogTitles.map((t: string) => buildBacklogModel(this.wiki, t));
    const filteredItems = filterBacklogItems(
      allBacklogItems,
      currentType,
      currentGenre,
      currentCommitment,
      currentSearch,
    );
    const sortedItems = sortBacklogItems(filteredItems, currentSort);

    const children: IParseTreeNode[] = [];

    // --- 1. Spotlight "Pick For Me" Recommendation Card ---
    if (spotlightTitle) {
      const spotTiddler = this.wiki.getTiddler(spotlightTitle);
      if (spotTiddler && (spotTiddler.fields.status === 'Backlog' || !spotTiddler.fields.status)) {
        const spotItem = buildBacklogModel(this.wiki, spotlightTitle);
        children.push(
          h('div', { class: 'mi-card mi-backlog-spotlight' }, [
            h('div', { class: 'mi-backlog-spotlight-header' }, [
              h('span', { class: 'mi-backlog-spotlight-badge' }, [text('🎲 Recommended Next Up')]),
              {
                type: 'button',
                attributes: {
                  class: { type: 'string', value: 'tc-btn-invisible mi-banner-dismiss-btn' },
                  tooltip: { type: 'string', value: 'Dismiss recommendation' },
                  'aria-label': { type: 'string', value: 'Dismiss recommendation' },
                },
                children: [
                  text('×'),
                  { type: 'action-deletetiddler', attributes: { $tiddler: { type: 'string', value: spotlightTiddler } } },
                ],
              },
            ]),
            h('div', { class: 'mi-backlog-spotlight-body' }, [
              h('div', { class: 'mi-backlog-poster mi-backlog-spotlight-thumb' }, [
                spotItem.image
                  ? { type: 'image', attributes: { source: { type: 'string', value: spotItem.image }, class: { type: 'string', value: 'mi-search-result-img' } } }
                  : h('div', { class: 'mi-search-result-placeholder' }, [text(spotItem.type)]),
              ]),
              h('div', { class: 'mi-backlog-spotlight-info' }, [
                h('div', { class: 'mi-backlog-title-group' }, [
                  spotItem.rank > 0 ? h('span', { class: 'mi-backlog-rank-badge mi-backlog-rank-badge-ranked' }, [text(`#${spotItem.rank}`)]) : text(''),
                  {
                    type: 'link',
                    attributes: { to: { type: 'string', value: spotItem.title }, class: { type: 'string', value: 'mi-backlog-item-link' } },
                    children: [h('span', { class: 'mi-backlog-item-title' }, [text(spotItem.displayTitle)])],
                  },
                  spotItem.year ? h('span', { class: 'mi-backlog-item-year' }, [text(`(${spotItem.year})`)]) : text(''),
                ]),
                spotItem.creator ? h('div', { class: 'mi-backlog-creator' }, [text(`by ${spotItem.creator}`)]) : text(''),
                spotItem.notes || spotItem.source
                  ? h('div', { class: 'mi-backlog-note-preview' }, [
                    spotItem.source ? h('span', { class: 'mi-backlog-source-tag' }, [text(`📌 ${spotItem.source}`)]) : text(''),
                    text(spotItem.notes || 'Recommended for your queue'),
                  ])
                  : spotItem.plot
                  ? h('div', { class: 'mi-backlog-plot-snippet' }, [text(spotItem.plot)])
                  : text(''),
                h('div', { class: 'mi-backlog-spotlight-actions' }, [
                  {
                    type: 'button',
                    attributes: {
                      class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
                      message: { type: 'string', value: 'mi-backlog-start-now' },
                      param: { type: 'string', value: spotItem.title },
                    },
                    children: [text('▶ Start Now')],
                  },
                  {
                    type: 'button',
                    attributes: {
                      class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                      message: { type: 'string', value: 'mi-backlog-pick-next' },
                    },
                    children: [text('🎲 Roll Another')],
                  },
                  {
                    type: 'link',
                    attributes: {
                      to: { type: 'string', value: spotItem.title },
                      class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                    },
                    children: [text('↗ Open Tiddler')],
                  },
                ]),
              ]),
            ]),
          ]),
        );
      }
    }

    // --- 2. Subtle Summary Header / Contextual Batch Bar ---
    const selectedItems = sortedItems.filter(index => index.batchSelected);
    const rankedCount = sortedItems.filter(index => index.rank > 0).length;

    if (selectedItems.length > 0) {
      children.push(
        h('div', { class: 'mi-batch-queue-bar mi-backlog-batch-bar' }, [
          h('div', { class: 'mi-batch-bar-left' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'tc-btn-invisible mi-batch-toggle-link' },
                message: {
                  type: 'string',
                  value: selectedItems.length === sortedItems.length ? 'mi-backlog-clear-selection' : 'mi-backlog-select-all',
                },
              },
              children: [
                text(selectedItems.length === sortedItems.length ? '☑ Deselect All' : '☐ Select All'),
              ],
            },
            h('span', { class: 'mi-batch-count-pill' }, [text(`${selectedItems.length} selected`)]),
          ]),
          h('div', { class: 'mi-batch-bar-right' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-active-subtle mi-btn-sm' },
                message: { type: 'string', value: 'mi-backlog-batch-move-top' },
                tooltip: { type: 'string', value: 'Move selected items to the top of the ranked queue (#1..)' },
              },
              children: [text('⤒ Move to Top')],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
                message: { type: 'string', value: 'mi-backlog-batch-status' },
                param: { type: 'string', value: 'Active' },
              },
              children: [text('▶ Start Selected')],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                message: { type: 'string', value: 'mi-backlog-batch-status' },
                param: { type: 'string', value: 'Dropped' },
              },
              children: [text('Drop')],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                message: { type: 'string', value: 'mi-backlog-clear-selection' },
              },
              children: [text('Cancel')],
            },
          ]),
        ]),
      );
    } else if (sortedItems.length > 0) {
      children.push(
        h('div', { class: 'mi-backlog-list-meta' }, [
          h('div', { class: 'mi-backlog-list-meta-left' }, [
            h('span', { class: 'mi-backlog-count-text' }, [
              text(`${sortedItems.length} ${sortedItems.length === 1 ? 'item' : 'items'} in queue`),
              rankedCount > 0 ? text(` • ${rankedCount} ranked`) : text(' • drag or use arrows to rank'),
            ]),
          ]),
          h('div', { class: 'mi-backlog-list-meta-right' }, [
            sortedItems.length > 1
              ? ({
                type: 'button',
                attributes: {
                  class: { type: 'string', value: 'tc-btn-invisible mi-backlog-meta-action' },
                  message: { type: 'string', value: 'mi-backlog-normalize-ranks' },
                  tooltip: { type: 'string', value: 'Assign sequential #1..#N ranks matching the current order' },
                },
                children: [
                  text(currentSort === 'rank-asc' ? 'Number All (#1–#N)' : 'Lock Order as Ranks (#1–#N)'),
                ],
              } as IParseTreeNode)
              : text(''),
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'tc-btn-invisible mi-backlog-meta-action' },
                message: { type: 'string', value: 'mi-backlog-select-all' },
              },
              children: [text('Select All')],
            },
          ]),
        ]),
      );
    }

    // --- 3. Empty State ---
    if (sortedItems.length === 0) {
      children.push(
        h('div', { class: 'mi-empty-state' }, [
          h('div', { style: 'font-weight: 600; font-style: normal; margin-bottom: 6px; color: var(--suite-fg-primary);' }, [
            text(allBacklogItems.length === 0 ? 'Your media backlog is empty!' : 'No backlog items match the active filters.'),
          ]),
          h('div', { style: 'margin-bottom: 12px; font-style: normal; font-size: 0.9em;' }, [
            text(
              allBacklogItems.length === 0
                ? 'Import books, movies, games, shows, manga, comics, or music to start building and ranking your queue.'
                : 'Try resetting your backlog filters or search query.',
            ),
          ]),
          h('div', { class: 'mi-flex-row', style: 'justify-content: center; gap: 10px;' }, [
            allBacklogItems.length > 0
              ? ({
                type: 'button',
                attributes: {
                  class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                  message: { type: 'string', value: 'mi-backlog-reset-filters' },
                },
                children: [text('Reset Filters')],
              } as IParseTreeNode)
              : text(''),
            {
              type: 'link',
              attributes: {
                to: { type: 'string', value: '$:/plugins/mblackman/media-importer/ui' },
                class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
              },
              children: [text('+ Import Media')],
            },
          ]),
        ]),
      );
      this.makeChildWidgets([h('div', { class: 'mi-backlog-list-wrapper' }, children)]);
      return;
    }

    // --- 4. Render Spacious Ranked Backlog Cards ---
    const rows: IParseTreeNode[] = [];
    const totalVisible = sortedItems.length;

    sortedItems.forEach((item, index) => {
      const drawerStateTiddler = `$:/temp/mblackman/media-importer/backlog-drawer/${item.title}`;
      const isDrawerOpen = this.wiki.getTiddlerText(drawerStateTiddler, 'closed') === 'open';
      const rankInputState = `$:/temp/mblackman/media-importer/rank-input/${item.title}`;
      const displayRank = item.rank > 0 ? `${item.rank}` : `${index + 1}`;

      // Zone 1: Clean Rank + Stepper Column
      const rankZone = h('div', { class: 'mi-backlog-rank-zone' }, [
        {
          type: 'button',
          attributes: {
            class: {
              type: 'string',
              value: item.batchSelected
                ? 'tc-btn-invisible mi-batch-checkbox mi-batch-checkbox-checked'
                : 'tc-btn-invisible mi-batch-checkbox mi-backlog-checkbox',
            },
            tooltip: { type: 'string', value: item.batchSelected ? 'Deselect item' : 'Select for batch action' },
            'aria-label': { type: 'string', value: `Select ${item.title}` },
            message: { type: 'string', value: 'mi-backlog-toggle-select' },
            param: { type: 'string', value: item.title },
          },
          children: [text(item.batchSelected ? '✓' : '')],
        },
        h('div', { class: 'mi-backlog-rank-stack' }, [
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'tc-btn-invisible mi-backlog-step-btn' },
              tooltip: { type: 'string', value: 'Move Up' },
              'aria-label': { type: 'string', value: `Move ${item.title} up` },
              disabled: { type: 'string', value: index === 0 ? 'yes' : 'no' },
              message: { type: 'string', value: 'mi-backlog-move-up' },
              param: { type: 'string', value: item.title },
            },
            children: [text('▲')],
          },
          h(
            'div',
            {
              class: item.rank === 1
                ? 'mi-backlog-rank-badge mi-backlog-rank-badge-top'
                : item.rank > 0
                ? 'mi-backlog-rank-badge mi-backlog-rank-badge-ranked'
                : 'mi-backlog-rank-badge',
              title: item.rank > 0 ? `Rank #${item.rank} (drag card to reorder)` : `Position #${index + 1} (use arrows or drag to set rank)`,
            },
            [
              h('span', { class: 'mi-backlog-rank-hash' }, [text('#')]),
              h('span', { class: 'mi-backlog-rank-num' }, [text(displayRank)]),
            ],
          ),
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'tc-btn-invisible mi-backlog-step-btn' },
              tooltip: { type: 'string', value: 'Move Down' },
              'aria-label': { type: 'string', value: `Move ${item.title} down` },
              disabled: { type: 'string', value: index === totalVisible - 1 ? 'yes' : 'no' },
              message: { type: 'string', value: 'mi-backlog-move-down' },
              param: { type: 'string', value: item.title },
            },
            children: [text('▼')],
          },
        ]),
      ]);

      // Zone 2: Poster Thumbnail (64x96, 2:3 aspect ratio)
      const posterZone = {
        type: 'link',
        attributes: {
          to: { type: 'string', value: item.title },
          class: { type: 'string', value: 'mi-backlog-poster-link' },
        },
        children: [
          h('div', { class: 'mi-backlog-poster' }, [
            item.favorite ? h('span', { class: 'mi-backlog-thumb-fav', title: 'Favorite' }, [text('★')]) : text(''),
            item.image
              ? { type: 'image', attributes: { source: { type: 'string', value: item.image }, class: { type: 'string', value: 'mi-search-result-img' } } }
              : h('div', { class: 'mi-search-result-placeholder' }, [text(item.type)]),
          ]),
        ],
      } as IParseTreeNode;

      // Zone 3: Editorial Content & Metadata
      const metaPills: IParseTreeNode[] = [];
      if (currentType === 'All') {
        metaPills.push(h('span', { class: 'mi-backlog-type-pill' }, [text(item.type)]));
      }
      if (item.lengthLabel) {
        metaPills.push(
          h('span', { class: 'mi-backlog-meta-pill', title: `Commitment: ${item.commitment}` }, [
            text(item.lengthLabel),
          ]),
        );
      }
      if (item.onlineRating > 0) {
        metaPills.push(
          h('span', { class: 'mi-backlog-meta-pill mi-backlog-score-pill', title: 'Online Rating' }, [
            h('span', { class: 'mi-star-full' }, [text('★ ')]),
            text(item.onlineRating.toFixed(1).replace(/\.0$/, '')),
          ]),
        );
      }
      for (const g of item.genres.slice(0, 3)) {
        metaPills.push(
          h('span', { class: 'mi-backlog-genre-chip' }, [text(g.replace(/_/g, ' '))]),
        );
      }

      const infoZone = h('div', { class: 'mi-backlog-info-col' }, [
        h('div', { class: 'mi-backlog-title-group' }, [
          {
            type: 'link',
            attributes: { to: { type: 'string', value: item.title }, class: { type: 'string', value: 'mi-backlog-item-link' } },
            children: [h('span', { class: 'mi-backlog-item-title' }, [text(item.displayTitle)])],
          },
          item.year ? h('span', { class: 'mi-backlog-item-year' }, [text(`(${item.year})`)]) : text(''),
          item.creator ? h('span', { class: 'mi-backlog-creator-inline' }, [text(`by ${item.creator}`)]) : text(''),
        ]),
        metaPills.length > 0 ? h('div', { class: 'mi-backlog-meta-row' }, metaPills) : text(''),
        item.notes || item.source
          ? h('div', { class: 'mi-backlog-note-preview' }, [
            item.source ? h('span', { class: 'mi-backlog-source-tag' }, [text(`📌 ${item.source}`)]) : text(''),
            item.notes ? h('span', { class: 'mi-backlog-note-text' }, [text(item.notes)]) : text(''),
          ])
          : item.plot
          ? h('div', { class: 'mi-backlog-plot-snippet' }, [text(item.plot)])
          : text(''),
      ]);

      // Zone 4: Calm Action Column
      const actionButtons: IParseTreeNode[] = [];
      if (index > 0) {
        actionButtons.push({
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn mi-btn-sm mi-backlog-top-btn' },
            tooltip: { type: 'string', value: 'Move to #1 (Top of Queue)' },
            'aria-label': { type: 'string', value: `Move ${item.title} to #1` },
            message: { type: 'string', value: 'mi-backlog-move-top' },
            param: { type: 'string', value: item.title },
          },
          children: [text('⤒ #1')],
        });
      }
      actionButtons.push(
        {
          type: 'button',
          attributes: {
            class: {
              type: 'string',
              value: isDrawerOpen || item.notes || item.source
                ? 'mi-btn mi-btn-active-subtle mi-btn-sm'
                : 'mi-btn mi-btn-sm',
            },
            tooltip: { type: 'string', value: 'Edit rank number, recommender source, backlog notes, or commitment' },
            message: { type: 'string', value: 'mi-backlog-toggle-drawer' },
            param: { type: 'string', value: item.title },
          },
          children: [text(isDrawerOpen ? 'Done' : '✎ Note')],
        },
        {
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
            tooltip: { type: 'string', value: 'Set status to Active and log today' },
            message: { type: 'string', value: 'mi-backlog-start-now' },
            param: { type: 'string', value: item.title },
          },
          children: [text('▶ Start')],
        },
      );

      const actionZone = h('div', { class: 'mi-backlog-actions-col' }, actionButtons);

      const mainRow = h('div', { class: 'mi-backlog-row-main' }, [
        rankZone,
        posterZone,
        infoZone,
        actionZone,
      ]);

      const cardChildren: IParseTreeNode[] = [mainRow];

      if (isDrawerOpen) {
        cardChildren.push(
          h('div', { class: 'mi-inline-stage-drawer mi-backlog-drawer' }, [
            h('div', { class: 'mi-inline-stage-grid' }, [
              h('div', { class: 'mi-stage-field' }, [
                h('span', { class: 'mi-sublabel' }, [text(`Jump to Rank (1–${totalVisible})`)]),
                h('div', { class: 'mi-flex-row', style: 'margin-bottom: 0;' }, [
                  {
                    type: 'edit-text',
                    attributes: {
                      tiddler: { type: 'string', value: rankInputState },
                      tag: { type: 'string', value: 'input' },
                      type: { type: 'string', value: 'number' },
                      default: { type: 'string', value: String(item.rank > 0 ? item.rank : index + 1) },
                      placeholder: { type: 'string', value: String(index + 1) },
                      class: { type: 'string', value: 'mi-input mi-input-sm' },
                    },
                    children: [],
                  },
                  {
                    type: 'button',
                    attributes: {
                      class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
                      message: { type: 'string', value: 'mi-backlog-set-rank' },
                      param: { type: 'string', value: item.title },
                    },
                    children: [text('Set #')],
                  },
                ]),
              ]),
              h('div', { class: 'mi-stage-field' }, [
                h('span', { class: 'mi-sublabel' }, [text('Source / Recommended By')]),
                {
                  type: 'edit-text',
                  attributes: {
                    tiddler: { type: 'string', value: item.title },
                    field: { type: 'string', value: 'backlog-source' },
                    tag: { type: 'string', value: 'input' },
                    default: { type: 'string', value: '' },
                    placeholder: { type: 'string', value: 'e.g. Recommended by Sam, Criterion, Book Club' },
                    class: { type: 'string', value: 'mi-input mi-input-sm' },
                  },
                  children: [],
                },
              ]),
              h('div', { class: 'mi-stage-field' }, [
                h('span', { class: 'mi-sublabel' }, [text('Commitment / Length')]),
                {
                  type: 'select',
                  attributes: {
                    tiddler: { type: 'string', value: item.title },
                    field: { type: 'string', value: 'backlog-commitment' },
                    default: { type: 'string', value: '' },
                    class: { type: 'string', value: 'mi-input mi-input-sm' },
                  },
                  children: [
                    h('option', { value: '' }, [text(`Auto (${item.commitment})`)]),
                    h('option', { value: 'Quick' }, [text('Quick / Short Session')]),
                    h('option', { value: 'Standard' }, [text('Standard Commitment')]),
                    h('option', { value: 'Long' }, [text('Long / Epic Commitment')]),
                  ],
                },
              ]),
              h('div', { class: 'mi-stage-field' }, [
                h('span', { class: 'mi-sublabel' }, [text('Move Status')]),
                {
                  type: 'select',
                  attributes: {
                    tiddler: { type: 'string', value: item.title },
                    field: { type: 'string', value: 'status' },
                    default: { type: 'string', value: 'Backlog' },
                    class: { type: 'string', value: 'mi-input mi-input-sm' },
                  },
                  children: [
                    h('option', { value: 'Backlog' }, [text('Backlog')]),
                    h('option', { value: 'Active' }, [text('Active (In Progress)')]),
                    h('option', { value: 'Completed' }, [text('Completed')]),
                    h('option', { value: 'Dropped' }, [text('Dropped')]),
                  ],
                },
              ]),
            ]),
            h('div', { class: 'mi-stage-field', style: 'margin-top: 12px;' }, [
              h('span', { class: 'mi-sublabel' }, [text('Backlog Notes (Why Watch / Read / Play)')]),
              {
                type: 'edit-text',
                attributes: {
                  tiddler: { type: 'string', value: item.title },
                  field: { type: 'string', value: 'backlog-notes' },
                  tag: { type: 'string', value: 'input' },
                  default: { type: 'string', value: '' },
                  placeholder: { type: 'string', value: 'Add notes, mood tags, or why this is on your list...' },
                  class: { type: 'string', value: 'mi-input mi-input-sm' },
                },
                children: [],
              },
            ]),
          ]),
        );
      }

      rows.push(
        h(
          'div',
          {
            class: item.batchSelected
              ? 'mi-card mi-backlog-row mi-search-result-selected'
              : item.rank === 1
              ? 'mi-card mi-backlog-row mi-backlog-row-top'
              : 'mi-card mi-backlog-row',
            draggable: 'true',
            'data-media-title': item.title,
          },
          cardChildren,
        ),
      );
    });

    children.push(h('div', { class: 'mi-backlog-rows' }, rows));
    this.makeChildWidgets([h('div', { class: 'mi-backlog-list-wrapper' }, children)]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const newSignature = this.computeStructuralSignature();
    if (newSignature !== this.lastStructuralSignature) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

class MediaBacklogWidget extends Widget {
  private lastShellSignature: string = '';

  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
    this.addEventListener('mi-backlog-move-up', this.handleMoveUp.bind(this));
    this.addEventListener('mi-backlog-move-down', this.handleMoveDown.bind(this));
    this.addEventListener('mi-backlog-move-top', this.handleMoveTop.bind(this));
    this.addEventListener('mi-backlog-set-rank', this.handleSetRank.bind(this));
    this.addEventListener('mi-backlog-drop-reorder', this.handleDropReorder.bind(this));
    this.addEventListener('mi-backlog-normalize-ranks', this.handleNormalizeRanks.bind(this));
    this.addEventListener('mi-backlog-start-now', this.handleStartNow.bind(this));
    this.addEventListener('mi-backlog-pick-next', this.handlePickNext.bind(this));
    this.addEventListener('mi-backlog-toggle-drawer', this.handleToggleDrawer.bind(this));
    this.addEventListener('mi-backlog-toggle-select', this.handleToggleSelect.bind(this));
    this.addEventListener('mi-backlog-select-all', this.handleSelectAll.bind(this));
    this.addEventListener('mi-backlog-clear-selection', this.handleClearSelection.bind(this));
    this.addEventListener('mi-backlog-batch-move-top', this.handleBatchMoveTop.bind(this));
    this.addEventListener('mi-backlog-batch-status', this.handleBatchStatus.bind(this));
    this.addEventListener('mi-backlog-reset-filters', this.handleResetFilters.bind(this));
  }

  private getVisibleSortedItems(): BacklogItemModel[] {
    const currentType = this.wiki.getTiddlerText('$:/state/mblackman/media-importer/backlog/type', 'All');
    const currentGenre = this.wiki.getTiddlerText('$:/state/mblackman/media-importer/backlog/genre', 'All');
    const currentCommitment = this.wiki.getTiddlerText('$:/state/mblackman/media-importer/backlog/commitment', 'All');
    const currentSort = this.wiki.getTiddlerText('$:/state/mblackman/media-importer/backlog/sort', 'rank-asc');
    const currentSearch = this.wiki.getTiddlerText('$:/temp/mblackman/media-importer/search/backlog', '');

    const rawBacklogTitles = this.wiki.filterTiddlers(
      '[tag[$:/tags/media-importer/Media]status[Backlog]] [tag[$:/tags/media-importer/Media]!has[status]] +[unique[]]',
    );
    const allBacklog = rawBacklogTitles.map((t: string) => buildBacklogModel(this.wiki, t));
    const filtered = filterBacklogItems(
      allBacklog,
      currentType,
      currentGenre,
      currentCommitment,
      currentSearch,
    );
    return sortBacklogItems(filtered, currentSort);
  }

  private writeOrderedRanks(orderedTitles: string[]) {
    orderedTitles.forEach((title, index) => {
      const tid = this.wiki.getTiddler(title);
      if (tid) {
        const nextRank = String(index + 1);
        if (tid.fields['backlog-rank'] !== nextRank) {
          this.wiki.addTiddler(new $tw.Tiddler(tid, { 'backlog-rank': nextRank }));
        }
      }
    });
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/sort', 'text', undefined, 'rank-asc');
  }

  handleMoveUp(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const items = this.getVisibleSortedItems();
    const index = items.findIndex(index_ => index_.title === targetTitle);
    if (index <= 0) return false;
    const titles = items.map(index_ => index_.title);
    const temporary = titles[index - 1];
    titles[index - 1] = titles[index];
    titles[index] = temporary;
    this.writeOrderedRanks(titles);
    return false;
  }

  handleMoveDown(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const items = this.getVisibleSortedItems();
    const index = items.findIndex(index_ => index_.title === targetTitle);
    if (index === -1 || index >= items.length - 1) return false;
    const titles = items.map(index_ => index_.title);
    const temporary = titles[index + 1];
    titles[index + 1] = titles[index];
    titles[index] = temporary;
    this.writeOrderedRanks(titles);
    return false;
  }

  handleMoveTop(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const items = this.getVisibleSortedItems();
    const index = items.findIndex(index_ => index_.title === targetTitle);
    if (index <= 0) return false;
    const titles = items.map(index_ => index_.title);
    titles.splice(index, 1);
    titles.unshift(targetTitle);
    this.writeOrderedRanks(titles);
    return false;
  }

  handleSetRank(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const rankInputTitle = `$:/temp/mblackman/media-importer/rank-input/${targetTitle}`;
    const rawValue = (this.wiki.getTiddlerText(rankInputTitle, '') || '').trim();
    const desiredRank = parseInt(rawValue, 10);
    if (!Number.isFinite(desiredRank) || desiredRank < 1) return false;

    const items = this.getVisibleSortedItems();
    const titles = items.map(index => index.title);
    const currentIndex = titles.indexOf(targetTitle);
    if (currentIndex === -1) return false;
    titles.splice(currentIndex, 1);
    const clampedIndex = Math.min(Math.max(0, desiredRank - 1), titles.length);
    titles.splice(clampedIndex, 0, targetTitle);
    this.writeOrderedRanks(titles);
    this.wiki.deleteTiddler(rankInputTitle);
    return false;
  }

  handleDropReorder(event: any) {
    const sourceTitle = event.param;
    const targetTitle = event.paramObject?.targetTitle;
    if (!sourceTitle || !targetTitle || sourceTitle === targetTitle) return false;
    const items = this.getVisibleSortedItems();
    const titles = items.map(index => index.title);
    const fromIndex = titles.indexOf(sourceTitle);
    const toIndex = titles.indexOf(targetTitle);
    if (fromIndex === -1 || toIndex === -1) return false;
    titles.splice(fromIndex, 1);
    titles.splice(toIndex, 0, sourceTitle);
    this.writeOrderedRanks(titles);
    return false;
  }

  handleNormalizeRanks() {
    const items = this.getVisibleSortedItems();
    this.writeOrderedRanks(items.map(index => index.title));
    return false;
  }

  private logMediaToday(mediaTitle: string) {
    const todayDate = $tw.utils.formatDateString(new Date(), 'YYYY-0MM-0DD');
    const todayLogTitle = `$:/media-log/${todayDate}`;
    const existingLog = this.wiki.getTiddler(todayLogTitle) || new $tw.Tiddler({ title: todayLogTitle });
    const currentItems: string[] = this.wiki.getTiddlerList(todayLogTitle, 'media-log') || [];
    if (!currentItems.includes(mediaTitle)) {
      currentItems.push(mediaTitle);
    }
    const existingTags: string[] = ((existingLog.fields.tags as string[]) || []).slice();
    if (!existingTags.includes('$:/tags/media-importer/Log')) {
      existingTags.push('$:/tags/media-importer/Log');
    }
    const listString = currentItems.map(item => `[[${item}]]`).join(' ');
    this.wiki.addTiddler(
      new $tw.Tiddler(existingLog, {
        'media-log': listString,
        tags: existingTags,
        'log-date': todayDate,
        modified: new Date(),
      }),
    );
  }

  handleStartNow(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const tid = this.wiki.getTiddler(targetTitle);
    if (!tid) return false;
    this.wiki.addTiddler(
      new $tw.Tiddler(tid, {
        status: 'Active',
        backlog_selected: 'no',
        modified: new Date(),
      }),
    );
    this.logMediaToday(targetTitle);
    const spotlightTiddler = '$:/temp/mblackman/media-importer/backlog/spotlight';
    if (this.wiki.getTiddlerText(spotlightTiddler, '') === targetTitle) {
      this.wiki.deleteTiddler(spotlightTiddler);
    }
    return false;
  }

  handlePickNext() {
    const items = this.getVisibleSortedItems();
    if (items.length === 0) return false;
    const spotlightTiddler = '$:/temp/mblackman/media-importer/backlog/spotlight';
    const currentSpot = (this.wiki.getTiddlerText(spotlightTiddler, '') || '').trim();

    const topRankedPool = items.filter(index => index.rank > 0 && index.rank <= 3 && index.title !== currentSpot);
    const fallbackPool = items.filter(index => index.title !== currentSpot);
    const pool = topRankedPool.length > 0 ? topRankedPool : fallbackPool.length > 0 ? fallbackPool : items;

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen) {
      this.wiki.setText(spotlightTiddler, 'text', undefined, chosen.title);
    }
    return false;
  }

  handleToggleDrawer(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const drawerStateTiddler = `$:/temp/mblackman/media-importer/backlog-drawer/${targetTitle}`;
    const current = this.wiki.getTiddlerText(drawerStateTiddler, 'closed');
    this.wiki.setText(drawerStateTiddler, 'text', undefined, current === 'open' ? 'closed' : 'open');
    return false;
  }

  handleToggleSelect(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const tid = this.wiki.getTiddler(targetTitle);
    if (!tid) return false;
    const nextValue = tid.fields['backlog_selected'] === 'yes' ? 'no' : 'yes';
    this.wiki.addTiddler(new $tw.Tiddler(tid, { backlog_selected: nextValue }));
    return false;
  }

  handleSelectAll() {
    const items = this.getVisibleSortedItems();
    for (const item of items) {
      const tid = this.wiki.getTiddler(item.title);
      if (tid && tid.fields['backlog_selected'] !== 'yes') {
        this.wiki.addTiddler(new $tw.Tiddler(tid, { backlog_selected: 'yes' }));
      }
    }
    return false;
  }

  handleClearSelection() {
    const allMedia = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]field:backlog_selected[yes]]');
    for (const title of allMedia) {
      const tid = this.wiki.getTiddler(title);
      if (tid) {
        this.wiki.addTiddler(new $tw.Tiddler(tid, { backlog_selected: 'no' }));
      }
    }
    return false;
  }

  handleBatchMoveTop() {
    const items = this.getVisibleSortedItems();
    const selectedTitles = items.filter(index => index.batchSelected).map(index => index.title);
    if (selectedTitles.length === 0) return false;
    const remainingTitles = items.filter(index => !index.batchSelected).map(index => index.title);
    const ordered = [...selectedTitles, ...remainingTitles];
    ordered.forEach((title, index) => {
      const tid = this.wiki.getTiddler(title);
      if (tid) {
        this.wiki.addTiddler(
          new $tw.Tiddler(tid, {
            'backlog-rank': String(index + 1),
            backlog_selected: 'no',
          }),
        );
      }
    });
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/sort', 'text', undefined, 'rank-asc');
    return false;
  }

  handleBatchStatus(event: any) {
    const newStatus = (event.param || 'Active').trim();
    const selected = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]field:backlog_selected[yes]]');
    for (const title of selected) {
      const tid = this.wiki.getTiddler(title);
      if (tid) {
        this.wiki.addTiddler(new $tw.Tiddler(tid, { status: newStatus, backlog_selected: 'no', modified: new Date() }));
        if (newStatus === 'Active') {
          this.logMediaToday(title);
        }
      }
    }
    return false;
  }

  handleResetFilters() {
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/type', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/genre', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/commitment', 'text', undefined, 'All');
    this.wiki.setText('$:/state/mblackman/media-importer/backlog/sort', 'text', undefined, 'rank-asc');
    this.wiki.setText('$:/temp/mblackman/media-importer/search/backlog', 'text', undefined, '');
    return false;
  }

  execute() {
    this.computeAttributes();

    const typeTiddler = '$:/state/mblackman/media-importer/backlog/type';
    const genreTiddler = '$:/state/mblackman/media-importer/backlog/genre';
    const commitmentTiddler = '$:/state/mblackman/media-importer/backlog/commitment';
    const sortTiddler = '$:/state/mblackman/media-importer/backlog/sort';
    const searchTiddler = '$:/temp/mblackman/media-importer/search/backlog';

    const currentType = this.wiki.getTiddlerText(typeTiddler, 'All');
    const currentGenre = this.wiki.getTiddlerText(genreTiddler, 'All');
    const currentCommitment = this.wiki.getTiddlerText(commitmentTiddler, 'All');
    const currentSort = this.wiki.getTiddlerText(sortTiddler, 'rank-asc');

    const allMedia = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]]');
    const backlogTitles = this.wiki.filterTiddlers(
      '[tag[$:/tags/media-importer/Media]status[Backlog]] [tag[$:/tags/media-importer/Media]!has[status]] +[unique[]]',
    );

    const typeOptions = this.wiki.filterTiddlers('[[$:/plugins/mblackman/media-importer/data/importers]indexes[]]');

    // Collect Genres from Backlog
    const genreSet = new Set<string>();
    for (const title of backlogTitles) {
      const tid = this.wiki.getTiddler(title);
      if (tid && tid.fields.genres) {
        if (currentType !== 'All' && tid.fields['media-type'] !== currentType) continue;
        const parsed = ($tw.utils && $tw.utils.parseStringArray(tid.fields.genres as string)) || [];
        for (const g of parsed) {
          genreSet.add(g);
        }
      }
    }
    const genreOptions = Array.from(genreSet).sort();

    // --- 1. Top App Header ---
    const appHeader = h('div', { class: 'mi-app-header' }, [
      h('div', { class: 'mi-app-header-title-group' }, [
        h('h2', { class: 'mi-app-heading' }, [text('Media Backlog')]),
      ]),
      h('div', { class: 'mi-app-header-actions' }, [
        {
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn mi-btn-active-subtle mi-btn-sm' },
            message: { type: 'string', value: 'mi-backlog-pick-next' },
            tooltip: { type: 'string', value: 'Recommend a backlog item to start next (favors top-ranked items)' },
          },
          children: [text('🎲 Pick Next For Me')],
        },
        {
          type: 'link',
          attributes: {
            to: { type: 'string', value: '$:/plugins/mblackman/media-importer/ui/media-library' },
            class: { type: 'string', value: 'mi-btn mi-btn-sm' },
          },
          children: [text(`Media Library (${allMedia.length})`)],
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

    // --- 2. Clean Segmented Media Type Bar (Only show populated types or active selection) ---
    const populatedTypes = typeOptions.filter((t: string) => {
      if (currentType === t) return true;
      return backlogTitles.some((title: string) => this.wiki.getTiddler(title)?.fields['media-type'] === t);
    });
    const visibleTypeList = populatedTypes.length > 0 ? populatedTypes : typeOptions;

    const typePills: IParseTreeNode[] = [
      {
        type: 'button',
        attributes: {
          class: {
            type: 'string',
            value: currentType === 'All'
              ? 'tc-btn-invisible mi-segmented-pill mi-segmented-pill-active'
              : 'tc-btn-invisible mi-segmented-pill',
          },
        },
        children: [
          text(`All (${backlogTitles.length})`),
          { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: typeTiddler }, text: { type: 'string', value: 'All' } } },
        ],
      },
      ...visibleTypeList.map((t: string) => {
        const count = backlogTitles.filter((title: string) => this.wiki.getTiddler(title)?.fields['media-type'] === t).length;
        return {
          type: 'button',
          attributes: {
            class: {
              type: 'string',
              value: currentType === t
                ? 'tc-btn-invisible mi-segmented-pill mi-segmented-pill-active'
                : 'tc-btn-invisible mi-segmented-pill',
            },
          },
          children: [
            text(`${t} (${count})`),
            { type: 'action-setfield', attributes: { $tiddler: { type: 'string', value: typeTiddler }, text: { type: 'string', value: t } } },
          ],
        } as IParseTreeNode;
      }),
    ];

    // --- 4. Streamlined Single-Row Search & Filter Bar ---
    const createOption = (value: string, label: string) => h('option', { value }, [text(label)]);

    const hasActiveFilters = currentType !== 'All' ||
      currentGenre !== 'All' ||
      currentCommitment !== 'All' ||
      currentSort !== 'rank-asc';

    const filterRow = h('div', { class: 'mi-backlog-controls-row' }, [
      h('div', { class: 'mi-backlog-search-wrap' }, [
        {
          type: 'edit-text',
          attributes: {
            tiddler: { type: 'string', value: searchTiddler },
            tag: { type: 'string', value: 'input' },
            placeholder: { type: 'string', value: 'Search backlog by title, creator, genre, or note...' },
            default: { type: 'string', value: '' },
            class: { type: 'string', value: 'mi-input' },
          },
          children: [],
        },
      ]),
      h('div', { class: 'mi-backlog-selects-wrap' }, [
        {
          type: 'select',
          attributes: {
            tiddler: { type: 'string', value: commitmentTiddler },
            default: { type: 'string', value: 'All' },
            class: { type: 'string', value: 'mi-input mi-input-auto' },
            tooltip: { type: 'string', value: 'Filter by length or session commitment' },
          },
          children: [
            createOption('All', 'Length: All'),
            createOption('Quick', 'Length: Quick / Short'),
            createOption('Standard', 'Length: Standard'),
            createOption('Long', 'Length: Long / Epic'),
          ],
        },
        {
          type: 'select',
          attributes: {
            tiddler: { type: 'string', value: genreTiddler },
            default: { type: 'string', value: 'All' },
            class: { type: 'string', value: 'mi-input mi-input-auto' },
            tooltip: { type: 'string', value: 'Filter by genre' },
          },
          children: [
            createOption('All', 'Genre: All'),
            ...genreOptions.map(g => createOption(g, g.replace(/_/g, ' '))),
          ],
        },
        {
          type: 'select',
          attributes: {
            tiddler: { type: 'string', value: sortTiddler },
            default: { type: 'string', value: 'rank-asc' },
            class: { type: 'string', value: 'mi-input mi-input-auto' },
            tooltip: { type: 'string', value: 'Sort backlog queue' },
          },
          children: [
            createOption('rank-asc', 'Order: Rank (#1 → #N)'),
            createOption('rating-desc', 'Order: Online Score'),
            createOption('added-asc', 'Order: Oldest in Queue'),
            createOption('added-desc', 'Order: Recently Added'),
            createOption('year-desc', 'Order: Release Year'),
            createOption('title-asc', 'Order: Title (A–Z)'),
          ],
        },
        hasActiveFilters
          ? ({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn' },
              message: { type: 'string', value: 'mi-backlog-reset-filters' },
            },
            children: [text('Reset')],
          } as IParseTreeNode)
          : text(''),
      ]),
    ]);

    const shell = h('div', { class: 'mi-page-shell' }, [
      appHeader,
      h('div', { class: 'mi-segmented-bar mi-backlog-type-bar', role: 'tablist', 'aria-label': 'Filter backlog by media type' }, typePills),
      filterRow,
      { type: 'MediaBacklogList', attributes: {}, children: [] },
    ]);

    this.lastShellSignature = this.computeShellSignature();
    this.makeChildWidgets([shell]);
  }

  private computeShellSignature(): string {
    const typeTiddler = '$:/state/mblackman/media-importer/backlog/type';
    const genreTiddler = '$:/state/mblackman/media-importer/backlog/genre';
    const commitmentTiddler = '$:/state/mblackman/media-importer/backlog/commitment';
    const sortTiddler = '$:/state/mblackman/media-importer/backlog/sort';

    const states = [
      this.wiki.getTiddlerText(typeTiddler, 'All'),
      this.wiki.getTiddlerText(genreTiddler, 'All'),
      this.wiki.getTiddlerText(commitmentTiddler, 'All'),
      this.wiki.getTiddlerText(sortTiddler, 'rank-asc'),
    ].join('|');

    const backlogTitles = this.wiki.filterTiddlers(
      '[tag[$:/tags/media-importer/Media]status[Backlog]] [tag[$:/tags/media-importer/Media]!has[status]] +[unique[]]',
    );

    return `${states}##${backlogTitles.join(';')}`;
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const nextSig = this.computeShellSignature();
    if (nextSig !== this.lastShellSignature) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

declare let exports: {
  MediaBacklog: typeof MediaBacklogWidget;
  MediaBacklogList: typeof MediaBacklogListWidget;
};

exports.MediaBacklog = MediaBacklogWidget;
exports.MediaBacklogList = MediaBacklogListWidget;
