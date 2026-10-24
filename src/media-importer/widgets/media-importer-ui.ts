/*\
title: $:/plugins/mblackman/media-importer/widget-media-importer-ui.ts
type: application/javascript
module-type: widget

Media Importer UI Widget
\*/

import { widget as Widget } from '$:/core/modules/widgets/widget.js';
import { IChangedTiddlers, IParseTreeNode } from 'tiddlywiki';

// Helper to create element nodes
const h = (tag: string, attributes: Record<string, any> = {}, children: IParseTreeNode[] = []): IParseTreeNode => {
  const attributes_: Record<string, any> = {};
  for (const key in attributes) {
    attributes_[key] = { type: 'string', value: attributes[key] };
  }
  return { type: 'element', tag, attributes: attributes_, children };
};

// Helper for text nodes
const text = (string_: string): IParseTreeNode => ({ type: 'text', text: string_ });

class MediaImporterUiWidget extends Widget {
  private searchTimeout: any = null;

  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
    this.addEventListener('ui-trigger-search', this.handleTriggerSearch.bind(this));
    this.addEventListener('ui-clear-search', this.handleClearSearch.bind(this));
    this.addEventListener('ui-paginate', this.handlePaginate.bind(this));
  }

  execute() {
    const type = this.getAttribute('type', '');
    const placeholder = this.getAttribute('placeholder', '');
    const loadingText = this.getAttribute('loadingText', 'Loading...');
    const resultTag = this.getAttribute('resultTag', '');
    const imageField = this.getAttribute('imageField', 'draft_image');
    const imageStyle = this.getAttribute('imageStyle', 'width:50px; height:auto;');
    const subtitleContent = this.getAttribute('subtitleContent', '');

    const searchInputTitle = this.getAttribute('inputTiddler', '') || `$:/temp/${type}-search-input`;
    const searchStateTitle = `$:/state/${type}-search`;
    const searchPageTitle = `$:/state/${type}-search-page`;

    const searchState = this.wiki.getTiddlerText(searchStateTitle, '');
    const searchPage = parseInt(this.wiki.getTiddlerText(searchPageTitle, '1'), 10);

    // --- Results Area ---
    const resultsNodes: IParseTreeNode[] = [];
    const results = this.wiki.filterTiddlers(`[tag[${resultTag}]sort[title]]`);

    if (searchState === 'loading') {
      resultsNodes.push(h('div', { class: 'mi-section mi-status-banner' }, [
        h('p', { style: 'margin: 0;' }, [h('i', {}, [text(loadingText)])]),
      ]));
    } else if (searchState === 'missing-key') {
      resultsNodes.push(h('div', { class: 'mi-card mi-callout-warning' }, [
        h('div', { style: 'margin-bottom: 8px; font-weight: 600;' }, [
          text(`🔑 API Key Required for ${type}`),
        ]),
        h('div', { style: 'font-size: 0.9em; margin-bottom: 12px; opacity: 0.85;' }, [
          text(`Please configure your ${type} API key in the Media Importer plugin settings before searching.`),
        ]),
        {
          type: 'button',
          attributes: {
            class: { type: 'string', value: 'mi-btn mi-btn-primary' },
            message: { type: 'string', value: 'tm-navigate' },
            param: { type: 'string', value: '$:/plugins/mblackman/media-importer/config' },
          },
          children: [text('Open Plugin Settings')],
        },
      ]));
    } else if (searchState === 'error') {
      resultsNodes.push(h('div', { class: 'mi-card mi-callout-error' }, [
        h('div', { style: 'font-weight: 600; margin-bottom: 4px;' }, [
          text(`⚠️ Search failed for ${type}`),
        ]),
        h('div', { style: 'font-size: 0.9em; opacity: 0.85;' }, [
          text('Please check your network connection or verify your API key in the plugin settings.'),
        ]),
      ]));
    } else if (results.length === 0 && searchState === 'done') {
      resultsNodes.push(h('div', { class: 'mi-section mi-status-banner' }, [
        h('p', { style: 'margin: 0;' }, [h('i', {}, [text('No results found.')])]),
      ]));
    } else {
      for (const title of results) {
        const tiddler = this.wiki.getTiddler(title);
        if (!tiddler) continue;

        const imgUrl = tiddler.fields[imageField] as string;
        const draftTitle = (tiddler.fields['draft_title'] as string) || '';
        const draftYear = (tiddler.fields['draft_year'] as string) || '';
        const expectedFinalTitle = `${draftTitle} (${draftYear})`;
        const existingTiddler = this.wiki.getTiddler(expectedFinalTitle);
        const isAlreadyImported = Boolean(existingTiddler && existingTiddler.hasTag('$:/tags/media-importer/Media'));
        const isFetching = this.wiki.getTiddlerText(`$:/temp/fetching/${title}`, '') === 'loading';

        // Parse subtitle content (which might contain wikitext like {{!!year}})
        const subtitleParser = this.wiki.parseText('text/vnd.tiddlywiki', subtitleContent, { parseAsInline: true });

        const actionButtons: IParseTreeNode[] = [];
        if (isFetching) {
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn' },
              disabled: { type: 'string', value: 'yes' },
            },
            children: [text('Importing...')],
          });
        } else if (isAlreadyImported) {
          actionButtons.push({
            type: 'link',
            attributes: {
              to: { type: 'string', value: expectedFinalTitle },
              class: { type: 'string', value: 'mi-btn' },
            },
            children: [text('✓ Open')],
          });
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn' },
              style: { type: 'string', value: 'margin-left: 6px;' },
              tooltip: { type: 'string', value: 'Re-fetch metadata (keeps status & logs)' },
              message: { type: 'string', value: `tm-fetch-${type}` },
              param: { type: 'string', value: title },
            },
            children: [text('↻')],
          });
        } else {
          actionButtons.push({
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-btn mi-btn-primary' },
              message: { type: 'string', value: `tm-fetch-${type}` },
              param: { type: 'string', value: title },
            },
            children: [text('Import')],
          });
        }

        const itemContent = h('div', { class: 'mi-card mi-flex-row mi-flex-between mi-search-result-card' }, [
          h(
            'div',
            { class: 'mi-search-result-thumb' },
            imgUrl
              ? [h('img', { src: imgUrl, style: imageStyle, class: 'mi-search-result-img' })]
              : [h('div', { class: 'mi-search-result-placeholder' }, [text('No Cover')])],
          ),
          h('div', { class: 'mi-search-result-info' }, [
            h('div', { class: 'mi-search-result-heading' }, [
              h('b', {}, [text(draftTitle)]),
              text(' '),
              h('small', { style: 'opacity: 0.7;' }, [text(`(${draftYear})`)]),
              isAlreadyImported
                ? h('span', { class: 'mi-imported-pill' }, [text('In Library')])
                : text(''),
            ]),
            h('div', { class: 'mi-search-subtitle' }, subtitleParser.tree),
          ]),
          h('div', { class: 'mi-ml-auto mi-search-result-actions' }, actionButtons),
        ]);

        // Wrap in tiddler widget to set currentTiddler context for subtitle
        resultsNodes.push({
          type: 'tiddler',
          attributes: { tiddler: { type: 'string', value: title } },
          children: [itemContent],
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

      paginationNodes.push(h('div', { class: 'mi-flex-row', style: 'gap: 10px; margin-top: 15px; justify-content: center; align-items: center;' }, [
        previousButton,
        h('span', { style: 'font-size:0.9em; opacity:0.7;' }, [text(`Page ${searchPage}`)]),
        nextButton,
      ]));
    }

    const container = h('div', { style: (searchState || hasResults) ? 'min-height: 200px;' : '' }, resultsNodes);

    const parseTreeChildren = (this.parseTreeNode as any).children || [];
    this.makeChildWidgets([...parseTreeChildren, container, ...paginationNodes]);
  }

  handleTriggerSearch(event: any) {
    const type = this.getAttribute('type', '');
    const searchInputTitle = this.getAttribute('inputTiddler', '') || `$:/temp/${type}-search-input`;
    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, '1');
    const input = this.wiki.getTiddlerText(searchInputTitle);
    this.dispatchEvent({ type: `tm-search-${type}`, param: input, page: '1' });
    return false;
  }

  handleClearSearch(event: any) {
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

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    const newType = this.getAttribute('type', '');

    const resultTag = this.getAttribute('resultTag', '');
    const searchInputTiddler = `$:/temp/${newType}-search-input`;


    // Check if the search state changed (e.g. from typing enter or search finishing)
    const searchStateTiddler = `$:/state/${newType}-search`;
    const searchPageTiddler = `$:/state/${newType}-search-page`;

    if (changedTiddlers[searchStateTiddler] || changedTiddlers[searchPageTiddler]) {
      this.refreshSelf();
      return true;
    }

    // Check if any newly arrived result tiddlers match our tag, or if fetching state / imported media changed
    const relevantChange = Object.keys(changedTiddlers).some(t => {
      if (t.startsWith('$:/temp/fetching/')) return true;
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

declare let exports: {
  MediaImporter: typeof MediaImporterUiWidget;
};

exports.MediaImporter = MediaImporterUiWidget;
