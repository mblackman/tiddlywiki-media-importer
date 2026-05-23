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
    this.addEventListener('mi-remove-item', this.handleRemoveItem.bind(this));
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
    const targetDate = this.getDate();
    const targetTiddler = `$:/media-log/${targetDate}`;

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

    this.makeChildWidgets(chips);
  }

  render(parent: Element, nextSibling: Element | null) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const doc = this.document;
    const wrapper = doc.createElement('div');
    wrapper.className = 'mi-media-wrapper';
    parent.insertBefore(wrapper, nextSibling);
    this.domNodes.push(wrapper);

    // Render Chips
    const chipsContainer = doc.createElement('div');
    chipsContainer.style.marginBottom = '4px';
    wrapper.appendChild(chipsContainer);
    this.renderChildren(chipsContainer, null);

    // Render Input & Dropdown
    const inputWrapper = doc.createElement('div');
    inputWrapper.className = 'mi-media-picker-input-wrapper';
    inputWrapper.style.position = 'relative';
    wrapper.appendChild(inputWrapper);

    const input = doc.createElement('input') as unknown as HTMLInputElement;
    input.type = 'text';
    input.className = 'mi-input';
    input.placeholder = this.getAttribute('placeholder', 'Search your media...');
    input.style.width = '100%';
    inputWrapper.appendChild(input);

    const dropdown = doc.createElement('div') as unknown as HTMLDivElement;
    dropdown.className = 'tc-drop-down mi-media-picker-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '1000';
    dropdown.style.width = '100%';
    inputWrapper.appendChild(dropdown);

    // Event Handlers
    let closeDropdownTimer: ReturnType<typeof setTimeout> | null = null;
    const closeDropdown = () => {
      closeDropdownTimer = setTimeout(() => {
        dropdown.style.display = 'none';
      }, 200);
    };

    input.addEventListener('blur', closeDropdown);
    input.addEventListener('focus', () => {
      if (closeDropdownTimer !== null) {
        clearTimeout(closeDropdownTimer);
        closeDropdownTimer = null;
      }
    });
    input.addEventListener('input', () => {
      const query = input.value;
      if (!query) {
        dropdown.style.display = 'none';
        return;
      }

      const matches = this.wiki.filterTiddlers(`[tag[$:/tags/media-importer/Media]!is[system]search:title[${query}]sort[title]limit[15]]`);
      dropdown.innerHTML = '';
      dropdown.style.display = 'block';

      if (matches.length === 0) {
        const noMatch = doc.createElement('div');
        noMatch.className = 'tc-dropdown-item mi-disabled-item';
        noMatch.innerText = 'No matches found';
        dropdown.appendChild(noMatch);
      } else {
        matches.forEach(title => {
          const item = doc.createElement('div');
          item.className = 'tc-dropdown-item';
          item.style.cursor = 'pointer';
          const type = this.wiki.getTiddler(title)?.fields['media-type'];
          item.innerText = title + (type ? ` (${type})` : '');
          item.addEventListener('click', () => {
            this.addItem(title);
            input.value = '';
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
      }
    });
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

  addItem(item: string) {
    const targetTiddler = `$:/media-log/${this.getDate()}`;
    const list = this.wiki.getTiddlerList(targetTiddler, 'media-log');
    if (!list.includes(item)) list.push(item);

    const tiddler = this.wiki.getTiddler(targetTiddler) || new $tw.Tiddler({ title: targetTiddler });
    const tags = (tiddler.fields.tags || []).slice();
    if (!tags.includes('$:/tags/media-importer/Log')) tags.push('$:/tags/media-importer/Log');

    const listString = list.map((i: any) => `[[${i}]]`).join(' ');
    this.wiki.addTiddler(new $tw.Tiddler(tiddler, { 'media-log': listString, tags: tags, modified: new Date(), 'log-date': this.getDate() }));
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
