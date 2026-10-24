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
        h('span', { class: 'mi-picker-chip' }, [
          {
            type: 'button',
            attributes: {
              class: { type: 'string', value: 'tc-btn-invisible mi-picker-chip-remove' },
              tooltip: { type: 'string', value: 'Remove' },
              message: { type: 'string', value: 'mi-remove-item' },
              param: { type: 'string', value: item },
            },
            children: [text('×')],
          },
          {
            type: 'link',
            attributes: { to: { type: 'string', value: item }, class: { type: 'string', value: 'mi-picker-chip-link' } },
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

    const document = this.document;
    const wrapper = document.createElement('div');
    wrapper.className = 'mi-media-wrapper';
    parent.insertBefore(wrapper, nextSibling);
    this.domNodes.push(wrapper);

    // Render Chips
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'mi-picker-chips-container';
    wrapper.appendChild(chipsContainer);
    this.renderChildren(chipsContainer, null);

    // Render Input & Dropdown
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'mi-media-picker-input-wrapper';
    inputWrapper.style.position = 'relative';
    wrapper.appendChild(inputWrapper);

    const input = document.createElement('input') as unknown as HTMLInputElement;
    input.type = 'text';
    input.className = 'mi-input';
    input.placeholder = this.getAttribute('placeholder', 'Search your media (or click to pick active)...');
    input.style.width = '100%';
    inputWrapper.appendChild(input);

    const dropdown = document.createElement('div') as unknown as HTMLDivElement;
    dropdown.className = 'tc-drop-down mi-media-picker-dropdown';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.zIndex = '1000';
    dropdown.style.width = '100%';
    inputWrapper.appendChild(dropdown);

    let activeIndex = -1;
    let currentMatches: string[] = [];

    const updateSelectionHighlight = () => {
      const optionEls = dropdown.querySelectorAll('.mi-picker-option');
      optionEls.forEach((el, idx) => {
        if (idx === activeIndex) {
          el.classList.add('mi-dropdown-item-active');
          (el as HTMLElement).scrollIntoView({ block: 'nearest' });
        } else {
          el.classList.remove('mi-dropdown-item-active');
        }
      });
    };

    const populateDropdown = () => {
      const query = input.value.trim().toLowerCase();
      const targetTiddler = `$:/media-log/${this.getDate()}`;
      const alreadyPicked = new Set(this.wiki.getTiddlerList(targetTiddler, 'media-log'));

      const allMedia = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]!is[system]sort[title]]');
      let matches: string[] = [];
      let showingActiveSuggestions = false;

      if (!query) {
        matches = allMedia.filter(title => {
          if (alreadyPicked.has(title)) return false;
          const tid = this.wiki.getTiddler(title);
          return tid?.fields['status'] === 'Active';
        });
        showingActiveSuggestions = matches.length > 0;
        if (matches.length === 0) {
          dropdown.style.display = 'none';
          currentMatches = [];
          activeIndex = -1;
          return;
        }
      } else {
        matches = allMedia
          .filter(title => {
            if (alreadyPicked.has(title)) return false;
            const tid = this.wiki.getTiddler(title);
            const englishTitle = ((tid?.fields['englishTitle'] as string) || '').toLowerCase();
            return title.toLowerCase().includes(query) || englishTitle.includes(query);
          })
          .slice(0, 15);
      }

      currentMatches = matches;
      activeIndex = matches.length > 0 ? 0 : -1;
      dropdown.innerHTML = '';
      dropdown.style.display = 'block';

      if (showingActiveSuggestions) {
        const header = document.createElement('div');
        header.className = 'mi-picker-dropdown-header';
        header.innerText = 'Currently Active';
        dropdown.appendChild(header);
      }

      if (matches.length === 0) {
        const noMatch = document.createElement('div');
        noMatch.className = 'tc-dropdown-item mi-disabled-item';
        noMatch.innerText = 'No matches found';
        dropdown.appendChild(noMatch);
      } else {
        matches.forEach((title, idx) => {
          const item = document.createElement('div');
          item.className = 'tc-dropdown-item mi-picker-option' + (idx === activeIndex ? ' mi-dropdown-item-active' : '');
          item.style.cursor = 'pointer';
          const tid = this.wiki.getTiddler(title);
          const type = tid?.fields['media-type'];
          item.innerText = title + (type ? ` (${type})` : '');
          item.addEventListener('mousedown', (e: MouseEvent) => {
            e.preventDefault();
            this.addItem(title);
            input.value = '';
            dropdown.style.display = 'none';
          });
          dropdown.appendChild(item);
        });
      }
    };

    // Event Handlers
    let closeDropdownTimer: ReturnType<typeof setTimeout> | null = null;
    const closeDropdown = () => {
      closeDropdownTimer = setTimeout(() => {
        dropdown.style.display = 'none';
      }, 150);
    };

    input.addEventListener('blur', closeDropdown);
    input.addEventListener('focus', () => {
      if (closeDropdownTimer !== null) {
        clearTimeout(closeDropdownTimer);
        closeDropdownTimer = null;
      }
      populateDropdown();
    });
    input.addEventListener('input', populateDropdown);
    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (dropdown.style.display === 'none') {
        if (e.key === 'ArrowDown') {
          populateDropdown();
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentMatches.length > 0) {
          activeIndex = (activeIndex + 1) % currentMatches.length;
          updateSelectionHighlight();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentMatches.length > 0) {
          activeIndex = (activeIndex - 1 + currentMatches.length) % currentMatches.length;
          updateSelectionHighlight();
        }
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < currentMatches.length) {
          e.preventDefault();
          this.addItem(currentMatches[activeIndex]);
          input.value = '';
          dropdown.style.display = 'none';
        }
      } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
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
      const listString = list.map((index_: any) => `[[${index_}]]`).join(' ');
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

    const listString = list.map((index: any) => `[[${index}]]`).join(' ');
    this.wiki.addTiddler(new $tw.Tiddler(tiddler, { 'media-log': listString, tags: tags, modified: new Date(), 'log-date': this.getDate() }));

    // Automatically transition item status from Backlog to Active when logged in Daily Picker
    const mediaTiddler = this.wiki.getTiddler(item);
    if (mediaTiddler && (!mediaTiddler.fields.status || mediaTiddler.fields.status === 'Backlog')) {
      this.wiki.addTiddler(new $tw.Tiddler(mediaTiddler, { status: 'Active', modified: new Date() }));
    }
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
