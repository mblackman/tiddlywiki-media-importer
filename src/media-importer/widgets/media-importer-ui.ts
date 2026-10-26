/*\
title: $:/plugins/mblackman/media-importer/widget-media-importer-ui.ts
type: application/javascript
module-type: widget

Media Importer UI Widget & Cover Dropzone Widget
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

declare const $tw: any;

// Helper to create element nodes
const h = (tag: string, attributes: Record<string, any> = {}, children: IParseTreeNode[] = []): IParseTreeNode => {
  const attributes_: Record<string, any> = {};
  for (const key in attributes) {
    if (attributes[key] !== undefined) {
      attributes_[key] = { type: 'string', value: String(attributes[key]) };
    }
  }
  return { type: 'element', tag, attributes: attributes_, children };
};

// Helper for text nodes
const text = (string_: string): IParseTreeNode => ({ type: 'text', text: string_ });

class MediaImporterResultsWidget extends Widget {
  execute() {
    this.computeAttributes();
    const type = this.getAttribute('type', '');
    const loadingText = this.getAttribute('loadingText', 'Loading...');
    const resultTag = this.getAttribute('resultTag', '');
    const imageField = this.getAttribute('imageField', 'draft_image');
    const subtitleContent = this.getAttribute('subtitleContent', '');

    const searchStateTitle = `$:/state/${type}-search`;
    const searchPageTitle = `$:/state/${type}-search-page`;
    const namingPattern = (this.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/naming', 'title-year') || 'title-year').trim();
    const defaultStatus = (this.wiki.getTiddlerText('$:/state/mblackman/media-importer/staging/status', 'Backlog') || 'Backlog').trim();
    const statusOptions = this.wiki.filterTiddlers('[enlist{$:/plugins/mblackman/media-importer/data/statuses}]');

    const searchState = this.wiki.getTiddlerText(searchStateTitle, '');
    const searchPage = parseInt(this.wiki.getTiddlerText(searchPageTitle, '1'), 10);

    const todayDate = $tw.utils.formatDateString(new Date(), 'YYYY-0MM-0DD');
    const todayLogTitle = `$:/media-log/${todayDate}`;
    const todayLoggedItems = new Set<string>(this.wiki.getTiddlerList(todayLogTitle, 'media-log') || []);

    // --- Results Area ---
    const resultsNodes: IParseTreeNode[] = [];
    const results = this.wiki.filterTiddlers(`[tag[${resultTag}]sort[title]]`);

    if (searchState === 'loading') {
      const skeletonCards: IParseTreeNode[] = [];
      for (let index = 0; index < 3; index++) {
        skeletonCards.push(
          h('div', { class: 'mi-card mi-flex-row mi-search-result-card mi-skeleton-card' }, [
            h('div', { class: 'mi-skeleton-thumb' }, []),
            h('div', { class: 'mi-search-result-info' }, [
              h('div', { class: 'mi-skeleton-line mi-skeleton-line-title' }, []),
              h('div', { class: 'mi-skeleton-line mi-skeleton-line-sub' }, []),
            ]),
            h('div', { class: 'mi-skeleton-btn' }, []),
          ]),
        );
      }
      resultsNodes.push(
        h('div', { class: 'mi-section' }, [
          h('div', { class: 'mi-loading-header' }, [
            h('span', { class: 'mi-spinner', 'aria-hidden': 'true' }, []),
            h('span', {}, [text(loadingText)]),
          ]),
          ...skeletonCards,
        ]),
      );
    } else if (searchState === 'missing-key') {
      resultsNodes.push(
        h('div', { class: 'mi-card mi-callout-warning' }, [
          h('div', { class: 'mi-callout-title' }, [
            text(`API Key Required for ${type}`),
          ]),
          h('div', { class: 'mi-callout-body' }, [
            text(`Configure your free ${type} API key in plugin settings to search online, or add this item manually with a custom cover.`),
          ]),
          h('div', { class: 'mi-flex-row mi-callout-actions' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-primary' },
                message: { type: 'string', value: 'tm-navigate' },
                param: { type: 'string', value: '$:/plugins/mblackman/media-importer/config' },
              },
              children: [text('Configure API Key')],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn' },
                message: { type: 'string', value: 'ui-switch-to-manual' },
              },
              children: [text('+ Add Manually Instead')],
            },
          ]),
        ]),
      );
    } else if (searchState === 'error') {
      resultsNodes.push(
        h('div', { class: 'mi-card mi-callout-error' }, [
          h('div', { class: 'mi-callout-title' }, [
            text(`Search failed for ${type}`),
          ]),
          h('div', { class: 'mi-callout-body' }, [
            text('Please check your network connection or verify your API key in the plugin settings, or add the item manually.'),
          ]),
          h('div', { class: 'mi-flex-row mi-callout-actions' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-primary' },
                message: { type: 'string', value: 'ui-trigger-search' },
              },
              children: [text('Retry Search')],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn' },
                message: { type: 'string', value: 'ui-switch-to-manual' },
              },
              children: [text('+ Add Manually')],
            },
          ]),
        ]),
      );
    } else if (results.length === 0 && searchState === 'done') {
      resultsNodes.push(
        h('div', { class: 'mi-section mi-status-banner' }, [
          h('div', { style: 'font-weight: 600; font-style: normal; margin-bottom: 6px; color: <<colour foreground>>;' }, [
            text(`No ${type.toLowerCase()} results found.`),
          ]),
          h('div', { style: 'margin-bottom: 12px; font-style: normal; font-size: 0.9em;' }, [
            text('Try a broader title keyword, check spelling, or create a custom entry with your own cover art.'),
          ]),
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-primary' },
              message: { type: 'string', value: 'ui-switch-to-manual' },
            },
            children: [text('+ Create Custom Entry')],
          },
        ]),
      );
    } else if (results.length > 0) {
      // Count batch selections
      const selectedTitles = results.filter(rTitle => {
        const rTid = this.wiki.getTiddler(rTitle);
        return rTid?.fields['batch_selected'] === 'yes';
      });

      // Batch queue bar above results
      const batchBarChildren: IParseTreeNode[] = [
        h('div', { class: 'mi-batch-bar-left' }, [
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'tc-btn-invisible mi-batch-toggle-link' },
              message: { type: 'string', value: selectedTitles.length === results.length ? 'ui-clear-batch' : 'ui-select-all-batch' },
            },
            children: [
              text(selectedTitles.length === results.length ? '☑ Deselect All' : '☐ Select All Page Results'),
            ],
          },
          selectedTitles.length > 0
            ? h('span', { class: 'mi-batch-count-pill' }, [text(`${selectedTitles.length} queued`)])
            : h('span', { class: 'mi-batch-hint' }, [text(`Showing ${results.length} results (Page ${searchPage})`)]),
        ]),
      ];

      if (selectedTitles.length > 0) {
        batchBarChildren.push(
          h('div', { class: 'mi-batch-bar-right' }, [
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
                message: { type: 'string', value: 'tm-batch-fetch-media' },
                param: { type: 'string', value: type },
              },
              children: [text(`Import Selected (${selectedTitles.length})`)],
            },
            {
              type: 'button',
              attributes: {
                class: { type: 'string', value: 'mi-btn mi-btn-sm' },
                message: { type: 'string', value: 'ui-clear-batch' },
              },
              children: [text('Clear')],
            },
          ]),
        );
      }

      resultsNodes.push(h('div', { class: 'mi-batch-queue-bar' }, batchBarChildren));

      for (const title of results) {
        const tiddler = this.wiki.getTiddler(title);
        if (!tiddler) continue;

        const stagedCoverUri = ((tiddler.fields['staged_cover_uri'] as string) || '').trim();
        const imgUrl = stagedCoverUri || (tiddler.fields[imageField] as string) || '';
        const draftTitle = (tiddler.fields['draft_title'] as string) || '';
        const draftYear = (tiddler.fields['draft_year'] as string) || '';
        const stagedTitle = ((tiddler.fields['staged_title'] as string) || '').trim();
        const importedTitleField = ((tiddler.fields['imported_title'] as string) || '').trim();

        const defaultExpectedTitle = namingPattern === 'title-only'
          ? draftTitle
          : `${draftTitle} (${draftYear})`;
        const resolvedTitle = importedTitleField || stagedTitle || defaultExpectedTitle;

        const existingTiddler = this.wiki.getTiddler(resolvedTitle) || this.wiki.getTiddler(`${draftTitle} (${draftYear})`);
        const isAlreadyImported = Boolean(existingTiddler && existingTiddler.hasTag('$:/tags/media-importer/Media'));
        const actualImportedTitle = isAlreadyImported && existingTiddler ? existingTiddler.fields.title : resolvedTitle;
        const isFetching = this.wiki.getTiddlerText(`$:/temp/fetching/${title}`, '') === 'loading';
        const isSelected = tiddler.fields['batch_selected'] === 'yes';
        const isStageOpen = this.wiki.getTiddlerText(`$:/temp/media-importer/stage-open/${title}`, 'no') === 'yes';
        const isLoggedToday = todayLoggedItems.has(actualImportedTitle);

        // Parse subtitle content (which might contain wikitext like {{!!year}})
        const subtitleParser = this.wiki.parseText('text/vnd.tiddlywiki', subtitleContent, { parseAsInline: true });

        const actionButtons: IParseTreeNode[] = [];
        if (isFetching) {
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-sm' },
              disabled: { type: 'string', value: 'yes' },
            },
            children: [text('Importing...')],
          });
        } else if (isAlreadyImported) {
          // 1. Primary Jump to Media button (stays on search screen, lets user jump when ready)
          actionButtons.push({
            type: 'link',
            attributes: {
              to: { type: 'string', value: actualImportedTitle },
              class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
            },
            children: [text('↗ Jump to Media')],
          });
          // 2. Quick Log Today toggle button
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: isLoggedToday ? 'mi-btn mi-btn-active-subtle mi-btn-sm' : 'mi-btn mi-btn-sm' },
              tooltip: { type: 'string', value: isLoggedToday ? "Logged in today's activity (click to remove)" : "Add to today's daily activity log" },
              message: { type: 'string', value: 'ui-toggle-log-today' },
              param: { type: 'string', value: actualImportedTitle },
            },
            children: [text(isLoggedToday ? '✓ Logged Today' : '+ Log Today')],
          });
          // 3. Re-fetch metadata button
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-sm mi-btn-icon-only' },
              tooltip: { type: 'string', value: 'Re-fetch metadata from source (preserves status & logs)' },
              message: { type: 'string', value: `tm-fetch-${type}` },
              param: { type: 'string', value: title },
            },
            children: [text('↻')],
          });
        } else {
          // Stage / Customize button
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: isStageOpen ? 'mi-btn mi-btn-active-subtle mi-btn-sm' : 'mi-btn mi-btn-sm' },
              tooltip: { type: 'string', value: 'Customize title, status, tags, or cover URI before importing' },
              message: { type: 'string', value: 'ui-toggle-stage-item' },
              param: { type: 'string', value: title },
            },
            children: [text(isStageOpen ? '✎ Done' : '✎ Stage')],
          });
          // Primary Import button
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-primary mi-btn-sm' },
              message: { type: 'string', value: `tm-fetch-${type}` },
              param: { type: 'string', value: title },
            },
            children: [text('Import')],
          });
        }

        const storageBadgeText = imgUrl
          ? (imgUrl.startsWith('data:') ? 'Embedded' : 'URI')
          : '';

        const mainRow = h('div', { class: 'mi-flex-row mi-flex-between mi-search-result-card' }, [
          // Batch select checkbox button
          {
            type: 'button',
            attributes: {
              class: {
                type: 'string',
                value: isSelected
                  ? 'tc-btn-invisible mi-batch-checkbox mi-batch-checkbox-checked'
                  : 'tc-btn-invisible mi-batch-checkbox',
              },
              tooltip: { type: 'string', value: isSelected ? 'Remove from batch queue' : 'Select for batch import' },
              'aria-label': { type: 'string', value: `Select ${draftTitle} for batch import` },
              message: { type: 'string', value: 'ui-toggle-batch-item' },
              param: { type: 'string', value: title },
            },
            children: [text(isSelected ? '✓' : '')],
          },
          // Aspect-ratio-safe thumbnail
          h(
            'div',
            { class: 'mi-search-result-thumb' },
            [
              ...(imgUrl
                ? [h('img', { src: imgUrl, class: 'mi-search-result-img', alt: draftTitle })]
                : [h('div', { class: 'mi-search-result-placeholder' }, [text(type)])]),
              storageBadgeText
                ? h('span', { class: 'mi-thumb-storage-badge', title: imgUrl.startsWith('data:') ? 'Embedded base64 cover' : 'External Cover URI' }, [
                  text(storageBadgeText),
                ])
                : text(''),
            ],
          ),
          // Info & metadata
          h('div', { class: 'mi-search-result-info' }, [
            h('div', { class: 'mi-search-result-heading' }, [
              h('b', { class: 'mi-search-result-title' }, [text(stagedTitle || draftTitle)]),
              draftYear && draftYear !== '0000'
                ? h('span', { class: 'mi-search-result-year' }, [text(`(${draftYear})`)])
                : text(''),
              isAlreadyImported
                ? h('span', { class: 'mi-imported-pill' }, [
                  text(`✓ In Library • ${(existingTiddler?.fields['status'] as string) || 'Backlog'}`),
                ])
                : text(''),
              stagedTitle || tiddler.fields['staged_status'] || tiddler.fields['staged_tags'] || stagedCoverUri
                ? h('span', { class: 'mi-staged-pill' }, [text('Staged Override')])
                : text(''),
            ]),
            h('div', { class: 'mi-search-subtitle' }, subtitleParser.tree),
          ]),
          // Action buttons
          h('div', { class: 'mi-search-result-actions' }, actionButtons),
        ]);

        const cardChildren: IParseTreeNode[] = [mainRow];

        // Inline Pre-Import Staging Drawer
        if (isStageOpen) {
          cardChildren.push(
            h('div', { class: 'mi-inline-stage-drawer' }, [
              h('div', { class: 'mi-inline-stage-grid' }, [
                h('div', { class: 'mi-stage-field' }, [
                  h('span', { class: 'mi-sublabel' }, [text('Tiddler Title Override')]),
                  {
                    type: 'edit-text',
                    attributes: {
                      tiddler: { type: 'string', value: title },
                      field: { type: 'string', value: 'staged_title' },
                      tag: { type: 'string', value: 'input' },
                      default: { type: 'string', value: defaultExpectedTitle },
                      placeholder: { type: 'string', value: defaultExpectedTitle },
                      class: { type: 'string', value: 'mi-input mi-input-sm' },
                    },
                    children: [],
                  },
                ]),
                h('div', { class: 'mi-stage-field' }, [
                  h('span', { class: 'mi-sublabel' }, [text('Initial Status')]),
                  {
                    type: 'select',
                    attributes: {
                      tiddler: { type: 'string', value: title },
                      field: { type: 'string', value: 'staged_status' },
                      default: { type: 'string', value: defaultStatus },
                      class: { type: 'string', value: 'mi-input mi-input-sm' },
                    },
                    children: statusOptions.map(s => h('option', { value: s }, [text(s)])),
                  },
                ]),
                h('div', { class: 'mi-stage-field' }, [
                  h('span', { class: 'mi-sublabel' }, [text('Extra Tags (space-separated)')]),
                  {
                    type: 'edit-text',
                    attributes: {
                      tiddler: { type: 'string', value: title },
                      field: { type: 'string', value: 'staged_tags' },
                      tag: { type: 'string', value: 'input' },
                      default: { type: 'string', value: '' },
                      placeholder: { type: 'string', value: 'e.g. sci-fi [[Must Read]]' },
                      class: { type: 'string', value: 'mi-input mi-input-sm' },
                    },
                    children: [],
                  },
                ]),
                h('div', { class: 'mi-stage-field' }, [
                  h('span', { class: 'mi-sublabel' }, [text('Cover Image URI Override')]),
                  {
                    type: 'edit-text',
                    attributes: {
                      tiddler: { type: 'string', value: title },
                      field: { type: 'string', value: 'staged_cover_uri' },
                      tag: { type: 'string', value: 'input' },
                      default: { type: 'string', value: imgUrl },
                      placeholder: { type: 'string', value: 'https://... or relative path' },
                      class: { type: 'string', value: 'mi-input mi-input-sm' },
                    },
                    children: [],
                  },
                ]),
              ]),
            ]),
          );
        }

        const itemCard = h(
          'div',
          {
            class: isSelected
              ? 'mi-card mi-search-result-wrapper mi-search-result-selected'
              : isAlreadyImported
              ? 'mi-card mi-search-result-wrapper mi-search-result-imported'
              : 'mi-card mi-search-result-wrapper',
          },
          cardChildren,
        );

        // Wrap in tiddler widget to set currentTiddler context for subtitle
        resultsNodes.push({
          type: 'tiddler',
          attributes: { tiddler: { type: 'string', value: title } },
          children: [itemCard],
        });
      }
    }

    // --- Pagination ---
    const hasResults = results.length > 0;
    const hasMorePages = results.length >= 5;
    const paginationNodes: IParseTreeNode[] = [];

    if (hasResults || searchPage > 1) {
      const previousButton: IParseTreeNode = searchPage > 1
        ? {
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn' },
            disabled: { type: 'string', value: searchState === 'loading' ? 'yes' : 'no' },
            message: { type: 'string', value: 'ui-paginate' },
            param: { type: 'string', value: '-1' },
          },
          children: [text('← Prev')],
        }
        : text('');

      const nextButton = {
        type: 'button',
        attributes: {
          class: { type: 'string', value: 'mi-btn' },
          disabled: { type: 'string', value: hasMorePages && searchState !== 'loading' ? 'no' : 'yes' },
          message: { type: 'string', value: 'ui-paginate' },
          param: { type: 'string', value: '1' },
        },
        children: [text('Next →')],
      } as IParseTreeNode;

      paginationNodes.push(
        h('div', { class: 'mi-flex-row mi-pagination-row' }, [
          previousButton,
          h('span', { class: 'mi-pagination-label' }, [text(`Page ${searchPage}`)]),
          nextButton,
        ]),
      );
    }

    const container = h('div', { style: (searchState || hasResults) ? 'min-height: 120px;' : '' }, resultsNodes);
    this.makeChildWidgets([container, ...paginationNodes]);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    const newType = this.getAttribute('type', '');
    const resultTag = this.getAttribute('resultTag', '');

    const searchStateTiddler = `$:/state/${newType}-search`;
    const searchPageTiddler = `$:/state/${newType}-search-page`;
    const namingTiddler = '$:/state/mblackman/media-importer/staging/naming';
    const statusTiddler = '$:/state/mblackman/media-importer/staging/status';

    if (
      changedTiddlers[searchStateTiddler] ||
      changedTiddlers[searchPageTiddler] ||
      changedTiddlers[namingTiddler] ||
      changedTiddlers[statusTiddler]
    ) {
      this.refreshSelf();
      return true;
    }

    const relevantChange = Object.keys(changedTiddlers).some(t => {
      if (
        t.startsWith('$:/temp/fetching/') ||
        t.startsWith('$:/temp/media-importer/stage-open/') ||
        t.startsWith('$:/media-log/')
      ) {
        return true;
      }
      const tiddler = this.wiki.getTiddler(t);
      if (!tiddler) return changedTiddlers[t]?.deleted;
      return (
        (resultTag && tiddler.hasTag(resultTag)) ||
        tiddler.hasTag('$:/tags/media-importer/Media')
      );
    });

    if (relevantChange) {
      this.refreshSelf();
      return true;
    }

    return this.refreshChildren(changedTiddlers);
  }
}

class MediaImporterUiWidget extends Widget {
  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
    this.addEventListener('ui-trigger-search', this.handleTriggerSearch.bind(this));
    this.addEventListener('ui-clear-search', this.handleClearSearch.bind(this));
    this.addEventListener('ui-paginate', this.handlePaginate.bind(this));
    this.addEventListener('ui-toggle-batch-item', this.handleToggleBatchItem.bind(this));
    this.addEventListener('ui-select-all-batch', this.handleSelectAllBatch.bind(this));
    this.addEventListener('ui-clear-batch', this.handleClearBatch.bind(this));
    this.addEventListener('ui-toggle-stage-item', this.handleToggleStageItem.bind(this));
    this.addEventListener('ui-toggle-log-today', this.handleToggleLogToday.bind(this));
    this.addEventListener('ui-switch-to-manual', this.handleSwitchToManual.bind(this));
  }

  execute() {
    this.computeAttributes();
    const parseTreeChildren = (this.parseTreeNode as any).children || [];
    const resultsWidgetNode: IParseTreeNode = {
      type: 'MediaImporterResults',
      attributes: {
        type: { type: 'string', value: this.getAttribute('type', '') },
        loadingText: { type: 'string', value: this.getAttribute('loadingText', 'Loading...') },
        resultTag: { type: 'string', value: this.getAttribute('resultTag', '') },
        imageField: { type: 'string', value: this.getAttribute('imageField', 'draft_image') },
        subtitleContent: { type: 'string', value: this.getAttribute('subtitleContent', '') },
      },
      children: [],
    };
    this.makeChildWidgets([...parseTreeChildren, resultsWidgetNode]);
  }

  handleTriggerSearch() {
    const type = this.getAttribute('type', '');
    const searchInputTitle = this.getAttribute('inputTiddler', '') || `$:/temp/${type}-search-input`;
    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, '1');
    const input = this.wiki.getTiddlerText(searchInputTitle);
    this.dispatchEvent({ type: `tm-search-${type}`, param: input, page: '1' });
    return false;
  }

  handleClearSearch() {
    const type = this.getAttribute('type', '');
    const searchInputTitle = this.getAttribute('inputTiddler', '') || `$:/temp/${type}-search-input`;
    const resultTag = this.getAttribute('resultTag', '');
    const tiddlersToDelete = this.wiki.filterTiddlers(`[tag[${resultTag}]]`);
    for (const title of tiddlersToDelete) {
      this.wiki.deleteTiddler(title);
    }
    this.wiki.setText(`$:/state/${type}-search`, 'text', undefined, '');
    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, '1');
    this.wiki.setText(searchInputTitle, 'text', undefined, '');
    return false;
  }

  handlePaginate(event: any) {
    const type = this.getAttribute('type', '');
    const searchInputTitle = this.getAttribute('inputTiddler', '') || `$:/temp/${type}-search-input`;
    const delta = parseInt(event.param || '0', 10);
    const currentPage = parseInt(this.wiki.getTiddlerText(`$:/state/${type}-search-page`, '1'), 10);
    const newPage = Math.max(1, currentPage + delta);

    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, newPage.toString());
    const input = this.wiki.getTiddlerText(searchInputTitle);
    this.dispatchEvent({ type: `tm-search-${type}`, param: input, page: newPage.toString() });
    return false;
  }

  handleToggleBatchItem(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const tid = this.wiki.getTiddler(targetTitle);
    if (!tid) return false;
    const nextValue = tid.fields['batch_selected'] === 'yes' ? 'no' : 'yes';
    this.wiki.addTiddler(new $tw.Tiddler(tid, { batch_selected: nextValue }));
    return false;
  }

  handleSelectAllBatch() {
    const resultTag = this.getAttribute('resultTag', '');
    const results = this.wiki.filterTiddlers(`[tag[${resultTag}]]`);
    for (const rTitle of results) {
      const tid = this.wiki.getTiddler(rTitle);
      if (tid) {
        this.wiki.addTiddler(new $tw.Tiddler(tid, { batch_selected: 'yes' }));
      }
    }
    return false;
  }

  handleClearBatch() {
    const resultTag = this.getAttribute('resultTag', '');
    const results = this.wiki.filterTiddlers(`[tag[${resultTag}]]`);
    for (const rTitle of results) {
      const tid = this.wiki.getTiddler(rTitle);
      if (tid && tid.fields['batch_selected'] === 'yes') {
        this.wiki.addTiddler(new $tw.Tiddler(tid, { batch_selected: 'no' }));
      }
    }
    return false;
  }

  handleToggleStageItem(event: any) {
    const targetTitle = event.param;
    if (!targetTitle) return false;
    const stateTitle = `$:/temp/media-importer/stage-open/${targetTitle}`;
    const current = this.wiki.getTiddlerText(stateTitle, 'no');
    this.wiki.setText(stateTitle, 'text', undefined, current === 'yes' ? 'no' : 'yes');
    return false;
  }

  handleToggleLogToday(event: any) {
    const mediaTitle = event.param;
    if (!mediaTitle) return false;
    const todayDate = $tw.utils.formatDateString(new Date(), 'YYYY-0MM-0DD');
    const todayLogTitle = `$:/media-log/${todayDate}`;
    const existingLog = this.wiki.getTiddler(todayLogTitle) || new $tw.Tiddler({ title: todayLogTitle });
    const currentList: string[] = this.wiki.getTiddlerList(todayLogTitle, 'media-log') || [];
    const index = currentList.indexOf(mediaTitle);

    if (index !== -1) {
      currentList.splice(index, 1);
    } else {
      currentList.push(mediaTitle);
      const mediaTiddler = this.wiki.getTiddler(mediaTitle);
      if (mediaTiddler && (!mediaTiddler.fields.status || mediaTiddler.fields.status === 'Backlog')) {
        this.wiki.addTiddler(new $tw.Tiddler(mediaTiddler, { status: 'Active', modified: new Date() }));
      }
    }

    const tags = ((existingLog.fields.tags as string[]) || []).slice();
    if (!tags.includes('$:/tags/media-importer/Log')) {
      tags.push('$:/tags/media-importer/Log');
    }
    const listString = currentList.map(item => `[[${item}]]`).join(' ');
    this.wiki.addTiddler(
      new $tw.Tiddler(existingLog, {
        'media-log': listString,
        tags,
        'log-date': todayDate,
        modified: new Date(),
      }),
    );
    return false;
  }

  handleSwitchToManual() {
    const type = this.getAttribute('type', 'Book');
    const searchInputTitle = this.getAttribute('inputTiddler', '') || '$:/temp/media-importer/search-input';
    const currentQuery = (this.wiki.getTiddlerText(searchInputTitle, '') || '').trim();
    if (currentQuery) {
      this.wiki.setText('$:/temp/media-importer/manual/title', 'text', undefined, currentQuery);
    }
    if (type && type !== 'Manual') {
      this.wiki.setText('$:/temp/media-importer/manual/type', 'text', undefined, type);
    }
    this.wiki.setText('$:/state/media-importer-selected', 'text', undefined, 'Manual');
    return false;
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

class MediaCoverDropzoneWidget extends Widget {
  private statePrefix: string = '$:/temp/media-importer/manual';

  execute() {
    this.statePrefix = this.getAttribute('statePrefix', '$:/temp/media-importer/manual');
  }

  render(parent: Element, nextSibling: Element | null) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const document = this.document;
    const container = document.createElement('div');
    container.className = 'mi-cover-dropzone-wrapper';
    parent.insertBefore(container, nextSibling);
    this.domNodes.push(container);

    const dropzone = document.createElement('div');
    dropzone.className = 'mi-dropzone';
    dropzone.setAttribute('tabindex', '0');
    dropzone.setAttribute('role', 'region');
    dropzone.setAttribute('aria-label', 'Cover art dropzone and paste area');
    container.appendChild(dropzone);

    const fileInput = document.createElement('input') as unknown as HTMLInputElement;
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    container.appendChild(fileInput);

    const currentUri = (this.wiki.getTiddlerText(`${this.statePrefix}/cover-uri`, '') || '').trim();
    const currentMode = (this.wiki.getTiddlerText(`${this.statePrefix}/cover-mode`, 'external-uri') || 'external-uri').trim();
    const currentFilename = (this.wiki.getTiddlerText(`${this.statePrefix}/cover-filename`, '') || '').trim();

    // Preview + Dropzone Inner Layout
    const layout = document.createElement('div');
    layout.className = 'mi-dropzone-inner';
    dropzone.appendChild(layout);

    // Thumbnail Preview Column
    const previewCol = document.createElement('div');
    previewCol.className = 'mi-dropzone-preview';
    layout.appendChild(previewCol);

    if (currentUri) {
      const img = document.createElement('img') as unknown as HTMLImageElement;
      img.src = currentUri;
      img.className = 'mi-dropzone-preview-img';
      img.alt = 'Staged Cover Preview';
      previewCol.appendChild(img);
    } else {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'mi-dropzone-preview-empty';
      emptyBox.textContent = '2:3 Cover Preview';
      previewCol.appendChild(emptyBox);
    }

    // Controls Column
    const controlsCol = document.createElement('div');
    controlsCol.className = 'mi-dropzone-controls';
    layout.appendChild(controlsCol);

    const headingRow = document.createElement('div');
    headingRow.className = 'mi-dropzone-heading-row';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'mi-dropzone-title';
    titleSpan.textContent = 'Drop cover image here, paste (Ctrl+V), or link external URI';
    headingRow.appendChild(titleSpan);

    if (currentUri) {
      const badge = document.createElement('span');
      badge.className = currentMode === 'embedded'
        ? 'mi-storage-badge mi-storage-badge-embedded'
        : 'mi-storage-badge mi-storage-badge-uri';
      badge.textContent = currentMode === 'embedded'
        ? `Embedded Base64${currentFilename ? ` (${currentFilename})` : ''}`
        : 'External URI (_canonical_uri)';
      headingRow.appendChild(badge);
    }
    controlsCol.appendChild(headingRow);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'mi-dropzone-btn-row';

    const chooseButton = document.createElement('button') as unknown as HTMLButtonElement;
    chooseButton.type = 'button';
    chooseButton.className = 'mi-btn mi-btn-sm';
    chooseButton.textContent = 'Choose Image / Photo';
    chooseButton.addEventListener('click', () => {
      fileInput.click();
    });
    buttonRow.appendChild(chooseButton);

    if (currentUri) {
      const clearButton = document.createElement('button') as unknown as HTMLButtonElement;
      clearButton.type = 'button';
      clearButton.className = 'mi-btn mi-btn-sm';
      clearButton.textContent = 'Remove Cover';
      clearButton.addEventListener('click', () => {
        this.wiki.deleteTiddler(`${this.statePrefix}/cover-uri`);
        this.wiki.deleteTiddler(`${this.statePrefix}/cover-filename`);
        this.wiki.setText(`${this.statePrefix}/cover-mode`, 'text', undefined, 'external-uri');
      });
      buttonRow.appendChild(clearButton);
    }
    controlsCol.appendChild(buttonRow);

    // URL / _canonical_uri input
    const uriInput = document.createElement('input') as unknown as HTMLInputElement;
    uriInput.type = 'url';
    uriInput.className = 'mi-input mi-input-sm';
    uriInput.placeholder = 'Or paste external image URL / _canonical_uri path (https://... or ./files/cover.jpg)';
    uriInput.value = currentUri.startsWith('data:') ? '' : currentUri;
    uriInput.addEventListener('input', () => {
      const value = uriInput.value.trim();
      this.wiki.setText(`${this.statePrefix}/cover-uri`, 'text', undefined, value);
      this.wiki.setText(`${this.statePrefix}/cover-mode`, 'text', undefined, 'external-uri');
      this.wiki.deleteTiddler(`${this.statePrefix}/cover-filename`);
    });
    controlsCol.appendChild(uriInput);

    // Process dropped or selected File
    const handleImageFile = (file: File) => {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const sizeKb = Math.round(file.size / 1024);
        this.wiki.setText(`${this.statePrefix}/cover-uri`, 'text', undefined, dataUrl);
        this.wiki.setText(`${this.statePrefix}/cover-mode`, 'text', undefined, 'embedded');
        this.wiki.setText(`${this.statePrefix}/cover-filename`, 'text', undefined, `${file.name}, ${sizeKb} KB`);
      };
      reader.readAsDataURL(file);
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) {
        handleImageFile(file);
      }
    });

    // Drag-and-drop state cleanup & handling
    const setDragActive = (active: boolean) => {
      if (active) {
        dropzone.classList.add('mi-dropzone-active');
      } else {
        dropzone.classList.remove('mi-dropzone-active');
      }
    };

    dropzone.addEventListener('dragenter', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    });
    dropzone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    });
    dropzone.addEventListener('dragleave', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    });
    dropzone.addEventListener('dragend', () => {
      setDragActive(false);
    });
    dropzone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleImageFile(e.dataTransfer.files[0]);
        return;
      }
      const droppedUri = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain') || '';
      if (droppedUri && (droppedUri.startsWith('http') || droppedUri.startsWith('./') || droppedUri.startsWith('/'))) {
        this.wiki.setText(`${this.statePrefix}/cover-uri`, 'text', undefined, droppedUri.trim());
        this.wiki.setText(`${this.statePrefix}/cover-mode`, 'text', undefined, 'external-uri');
      }
    });

    // Clipboard Paste support
    dropzone.addEventListener('paste', (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            handleImageFile(blob);
            return;
          }
        }
      }
      const pastedText = e.clipboardData?.getData('text/plain') || '';
      if (pastedText && (pastedText.startsWith('http://') || pastedText.startsWith('https://'))) {
        this.wiki.setText(`${this.statePrefix}/cover-uri`, 'text', undefined, pastedText.trim());
        this.wiki.setText(`${this.statePrefix}/cover-mode`, 'text', undefined, 'external-uri');
      }
    });
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (
      Object.keys(changedAttributes).length > 0 ||
      changedTiddlers[`${this.statePrefix}/cover-uri`] ||
      changedTiddlers[`${this.statePrefix}/cover-mode`] ||
      changedTiddlers[`${this.statePrefix}/cover-filename`]
    ) {
      this.refreshSelf();
      return true;
    }
    return false;
  }
}

declare let exports: {
  MediaImporter: typeof MediaImporterUiWidget;
  MediaImporterResults: typeof MediaImporterResultsWidget;
  MediaCoverDropzone: typeof MediaCoverDropzoneWidget;
};

exports.MediaImporter = MediaImporterUiWidget;
exports.MediaImporterResults = MediaImporterResultsWidget;
exports.MediaCoverDropzone = MediaCoverDropzoneWidget;
