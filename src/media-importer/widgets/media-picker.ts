/*\
title: $:/plugins/mblackman/media-importer/widgets/media-picker.ts
type: application/javascript
module-type: widget

Media Picker Widget
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

class MediaPickerWidget extends Widget {
  constructor(parseTreeNode: any, options: any) {
    super(parseTreeNode, options);
    this.addEventListener('mi-add-item', this.handleAddItem.bind(this));
    this.addEventListener('mi-remove-item', this.handleRemoveItem.bind(this));
    this.addEventListener('mi-clear-query', this.handleClearQuery.bind(this));
  }

  getDate() {
    const date = this.getAttribute('date', '');
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return date;
    }
    return $tw.utils.formatDateString(new Date(), 'YYYY-MM-DD');
  }

  execute() {
    const placeholder = this.getAttribute('placeholder', 'Search your media...');
    const targetDate = this.getDate();
    const targetTiddler = `$:/media-log/${targetDate}`;
    const temporaryState = `$:/temp/media-importer/picker/${targetTiddler}/media-log`;

    const currentLog = this.wiki.getTiddlerList(targetTiddler, 'media-log');

    // --- Chips (Selected Items) ---
    const chips: IParseTreeNode[] = [];
    for (const item of currentLog) {
      chips.push(
        h('span', {
          style:
            'display: inline-block; background: <<colour tiddler-info-background>>; border: 1px solid <<colour tiddler-info-border>>; border-radius: 12px; padding: 2px 10px; margin: 2px 4px 2px 0; font-size: 0.9em;',
        }, [
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'tc-btn-invisible' },
              style: { type: 'string', value: 'margin-right: 4px; color: <<colour muted-foreground>>;' },
              tooltip: { type: 'string', value: 'Remove' },
              message: { type: 'string', value: 'mi-remove-item' },
              param: { type: 'string', value: item },
            },
            children: [text('×')],
          },
          {
            type: 'link',
            attributes: { to: { type: 'string', value: item }, style: { type: 'string', value: 'text-decoration: none; color: <<colour foreground>>;' } },
            children: [text(item)],
          },
        ]),
      );
    }

    // --- Dropdown ---
    const dropdownNodes: IParseTreeNode[] = [
      {
        type: 'reveal',
        attributes: {
          state: { type: 'string', value: temporaryState },
          type: { type: 'string', value: 'nomatch' },
          text: { type: 'string', value: '' },
        },
        children: [
          // Overlay to close
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'mi-media-picker-overlay' },
              message: { type: 'string', value: 'mi-clear-query' },
            },
            children: [],
          },
          // Dropdown list
          h('div', { class: 'tc-drop-down mi-media-picker-dropdown' }, [
            {
              type: 'list',
              attributes: {
                filter: { type: 'string', value: `[tag[$:/tags/media-importer/Media]!is[system]search:title{${temporaryState}}sort[title]limit[15]]` },
                emptyMessage: { type: 'string', value: '<div class="tc-dropdown-item mi-disabled-item">No matches found</div>' },
              },
              children: [
                {
                  type: 'button',
                  attributes: {
                    class: { type: 'string', value: 'tc-btn-invisible tc-dropdown-item' },
                    actions: { type: 'string', value: '<$action-sendmessage $message="mi-add-item" $param=<<currentTiddler>>/>' },
                  },
                  children: [
                    { type: 'view', attributes: { field: { type: 'string', value: 'title' } } },
                    h('span', { style: 'opacity:0.6; font-size:0.8em;' }, [
                      text(' ('),
                      { type: 'view', attributes: { field: { type: 'string', value: 'media-type' } } },
                      text(')'),
                    ]),
                  ],
                },
              ],
            },
          ]),
        ],
      },
    ];

    // --- Input Area ---
    const inputArea = h('div', { class: 'mi-media-picker-input-wrapper' }, [
      h('div', { style: 'position:relative;' }, [
        {
          type: 'edit-text',
          attributes: {
            tiddler: { type: 'string', value: temporaryState },
            tag: { type: 'string', value: 'input' },
            class: { type: 'string', value: 'mi-input' },
            placeholder: { type: 'string', value: placeholder },
            default: { type: 'string', value: '' },
          },
          children: [],
        },
        {
          type: 'reveal',
          attributes: {
            state: { type: 'string', value: temporaryState },
            type: { type: 'string', value: 'nomatch' },
            text: { type: 'string', value: '' },
          },
          children: [{
            type: 'button',
            attributes: { class: { type: 'string', value: 'tc-btn-invisible mi-media-picker-clear-btn' }, message: { type: 'string', value: 'mi-clear-query' } },
            children: [text('✕')],
          }],
        },
      ]),
      ...dropdownNodes,
    ]);

    const wrapper = h('div', { class: 'mi-media-wrapper' }, [
      h('div', { style: 'margin-bottom: 4px;' }, chips),
      inputArea,
    ]);

    this.makeChildWidgets([wrapper]);
  }

  handleRemoveItem(event: any) {
    const item = event.param;
    const targetTiddler = `$:/media-log/${this.getDate()}`;

    const list = this.wiki.getTiddlerList(targetTiddler, 'media-log');
    const index = list.indexOf(item);
    if (index !== -1) {
      list.splice(index, 1);
      const tiddler = this.wiki.getTiddler(targetTiddler) || new $tw.Tiddler({ title: targetTiddler });
      const listString = list.map((i: any) => `[[${i}]]`).join(' ');
      this.wiki.addTiddler(new $tw.Tiddler(tiddler, { 'media-log': listString, modified: new Date(), 'log-date': this.getDate() }));
    }
    return false;
  }

  handleAddItem(event: any) {
    const item = event.param;
    const targetTiddler = `$:/media-log/${this.getDate()}`;

    const list = this.wiki.getTiddlerList(targetTiddler, 'media-log');
    if (!list.includes(item)) list.push(item);

    const tiddler = this.wiki.getTiddler(targetTiddler) || new $tw.Tiddler({ title: targetTiddler });
    const tags = (tiddler.fields.tags || []).slice();
    if (!tags.includes('$:/tags/media-importer/Log')) tags.push('$:/tags/media-importer/Log');

    const listString = list.map((i: any) => `[[${i}]]`).join(' ');
    this.wiki.addTiddler(new $tw.Tiddler(tiddler, { 'media-log': listString, tags: tags, modified: new Date(), 'log-date': this.getDate() }));
    this.handleClearQuery();
    return false;
  }

  handleClearQuery() {
    const targetTiddler = `$:/media-log/${this.getDate()}`;
    const temporaryState = `$:/temp/media-importer/picker/${targetTiddler}/media-log`;
    this.wiki.setText(temporaryState, 'text', undefined, '');
    return false;
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    const targetTiddler = `$:/media-log/${this.getDate()}`;

    if (changedTiddlers[targetTiddler]) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

declare let exports: {
  MediaPicker: typeof MediaPickerWidget;
};

exports.MediaPicker = MediaPickerWidget;
