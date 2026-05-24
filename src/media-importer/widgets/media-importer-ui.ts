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

    const searchInputTitle = `$:/temp/${type}-search-input`;
    const searchStateTitle = `$:/state/${type}-search`;
    const searchPageTitle = `$:/state/${type}-search-page`;

    const searchState = this.wiki.getTiddlerText(searchStateTitle, '');
    const searchPage = parseInt(this.wiki.getTiddlerText(searchPageTitle, '1'), 10);

    // --- Results Area ---
    const resultsNodes: IParseTreeNode[] = [];

    if (searchState === 'loading') {
      resultsNodes.push(h('div', { class: 'mi-section' }, [
        h('p', {}, [h('i', {}, [text(loadingText)])]),
      ]));
    } else {
      const results = this.wiki.filterTiddlers(`[tag[${resultTag}]sort[draft_title]]`);

      if (results.length === 0 && searchState === 'done') {
        resultsNodes.push(h('div', { class: 'mi-section' }, [
          h('p', {}, [h('i', {}, [text('No results found.')])]),
        ]));
      } else {
        for (const title of results) {
          const tiddler = this.wiki.getTiddler(title);
          if (!tiddler) continue;

          const imgUrl = tiddler.fields[imageField] as string;
          const draftTitle = (tiddler.fields['draft_title'] as string) || '';
          const draftYear = (tiddler.fields['draft_year'] as string) || '';

          // Parse subtitle content (which might contain wikitext like {{!!year}})
          const subtitleParser = this.wiki.parseText('text/vnd.tiddlywiki', subtitleContent, { parseAsInline: true });

          const itemContent = h('div', { class: 'mi-card mi-flex-row mi-flex-between' }, [
            h(
              'div',
              { style: 'flex-shrink:0;' },
              imgUrl
                ? [
                  h('img', { src: imgUrl, style: imageStyle }),
                ]
                : [],
            ),
            h('div', {}, [
              h('b', {}, [text(draftTitle)]),
              text(' '),
              h('small', {}, [text(`(${draftYear})`)]),
              h('br'),
              h('small', {}, subtitleParser.tree),
            ]),
            h('div', { class: 'mi-ml-auto' }, [
              {
                type: 'button',
                attributes: {
                  class: { type: 'string', value: 'mi-btn mi-btn-primary' },
                  message: { type: 'string', value: `tm-fetch-${type}` },
                  param: { type: 'string', value: title },
                },
                children: [text('Import')],
              },
            ]),
          ]);

          // Wrap in tiddler widget to set currentTiddler context for subtitle
          resultsNodes.push({
            type: 'tiddler',
            attributes: { tiddler: { type: 'string', value: title } },
            children: [itemContent],
          });
        }
      }
    }

    // --- Pagination ---
    const hasResults = this.wiki.filterTiddlers(`[tag[${resultTag}]limit[1]]`).length > 0;
    const paginationNodes: IParseTreeNode[] = [];

    if (hasResults || searchPage > 1) {
      const previousButton: IParseTreeNode = searchPage > 1
        ? {
          type: 'button',
          attributes: { class: { type: 'string', value: 'mi-btn' }, message: { type: 'string', value: 'ui-paginate' }, param: { type: 'string', value: '-1' } },
          children: [text('← Prev')],
        }
        : text('');

      const nextButton = {
        type: 'button',
        attributes: {
          class: { type: 'string', value: 'mi-btn' },
          disabled: { type: 'string', value: hasResults ? 'no' : 'yes' },
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

    const container = h('div', { style: searchState ? 'min-height: 400px;' : '' }, resultsNodes);

    const parseTreeChildren = (this.parseTreeNode as any).children || [];
    this.makeChildWidgets([...parseTreeChildren, container, ...paginationNodes]);
  }

  handleTriggerSearch(event: any) {
    const type = this.getAttribute('type', '');
    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, '1');
    const input = this.wiki.getTiddlerText(`$:/temp/${type}-search-input`);
    this.dispatchEvent({ type: `tm-search-${type}`, param: input, page: '1' });
    return false;
  }

  handleClearSearch(event: any) {
    const type = this.getAttribute('type', '');
    const resultTag = this.getAttribute('resultTag', '');
    const tiddlersToDelete = this.wiki.filterTiddlers(`[tag[${resultTag}]]`);
    for (const title of tiddlersToDelete) {
      this.wiki.deleteTiddler(title);
    }
    this.wiki.setText(`$:/state/${type}-search`, 'text', undefined, '');
    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, '1');
    this.wiki.setText(`$:/temp/${type}-search-input`, 'text', undefined, '');
    return false;
  }

  handlePaginate(event: any) {
    const type = this.getAttribute('type', '');
    const delta = parseInt(event.param || '0', 10);
    const currentPage = parseInt(this.wiki.getTiddlerText(`$:/state/${type}-search-page`, '1'), 10);
    const newPage = Math.max(1, currentPage + delta);

    this.wiki.setText(`$:/state/${type}-search-page`, 'text', undefined, newPage.toString());
    const input = this.wiki.getTiddlerText(`$:/temp/${type}-search-input`);
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

    // Debounced automatic search on input change
    if (changedTiddlers[searchInputTiddler]) {
      const input = this.wiki.getTiddlerText(searchInputTiddler, '');
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      this.searchTimeout = setTimeout(() => {
        if (input.trim().length >= 3) {
          this.wiki.setText(`$:/state/${newType}-search-page`, 'text', undefined, '1');
          this.dispatchEvent({ type: `tm-search-${newType}`, param: input, page: '1' });
        }
      }, 500);
    }

    // Check if the search state changed (e.g. from typing enter or search finishing)
    const searchStateTiddler = `$:/state/${newType}-search`;
    const searchPageTiddler = `$:/state/${newType}-search-page`;

    if (changedTiddlers[searchStateTiddler] || changedTiddlers[searchPageTiddler]) {
      this.refreshSelf();
      return true;
    }

    // Check if any newly arrived result tiddlers match our tag
    if (
      resultTag && Object.keys(changedTiddlers).some(t => {
        const tiddler = this.wiki.getTiddler(t);
        return tiddler && tiddler.fields.tags && tiddler.fields.tags.includes(resultTag);
      })
    ) {
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
