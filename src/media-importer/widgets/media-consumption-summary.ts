/*\
title: $:/plugins/mblackman/media-importer/widget-media-consumption-summary.ts
type: application/javascript
module-type: widget

Media Consumption Summary Widget
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

class MediaConsumptionSummaryWidget extends Widget {
  private startDate: string = '';
  private endDate: string = '';
  private stateInitialized: boolean = false;

  execute() {
    if (!this.stateInitialized) {
      this.startDate = this.getAttribute('startDate', '');
      this.endDate = this.getAttribute('endDate', '');
      this.stateInitialized = true;
    }

    const filterStart = this.startDate || '0000-00-00';
    const filterEnd = this.endDate || '9999-99-99';

    const mediaLogFilter =
      `[tag[$:/tags/media-importer/Log]!has[draft.of]] :filter[get[log-date]compare:string:gteq[${filterStart}]] :filter[get[log-date]compare:string:lteq[${filterEnd}]]`;

    const logTiddlers = this.wiki.filterTiddlers(mediaLogFilter);
    const itemCounts = new Map<string, number>();

    for (const log of logTiddlers) {
      const items = this.wiki.getTiddlerList(log, 'media-log');
      for (const item of items) {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
      }
    }

    const mediaTypes = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]get[media-type]unique[]sort[]]');
    const nodes: IParseTreeNode[] = [];

    const allMediaItems = Array.from(itemCounts.keys()).sort();

    for (const type of mediaTypes) {
      const itemsOfType = allMediaItems.filter(item => this.wiki.getTiddler(item)?.fields['media-type'] === type);

      if (itemsOfType.length > 0) {
        nodes.push(h('h5', { style: 'margin-bottom: 5px; margin-top: 15px;' }, [text(type)]));

        const summaryItems: IParseTreeNode[] = [];
        for (const item of itemsOfType) {
          const count = itemCounts.get(item) || 0;

          summaryItems.push(h('div', { class: 'mi-summary-item' }, [
            h('div', { class: 'mi-summary-link' }, [{ type: 'link', attributes: { to: { type: 'string', value: item } }, children: [text(item)] }]),
            h('span', { class: 'mi-summary-badge' }, [text(`${count}d`)]),
          ]));
        }
        nodes.push(h('div', { class: 'mi-summary-group' }, summaryItems));
      }
    }

    this.makeChildWidgets([h('div', { class: 'mi-section' }, nodes)]);
  }

  render(parent: Element, nextSibling: Element | null) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const doc = this.document;
    const container = doc.createElement('div');
    container.className = 'mi-media-consumption-summary';
    parent.insertBefore(container, nextSibling);
    this.domNodes.push(container);

    // --- Controls ---
    const controls = doc.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '10px';
    controls.style.marginBottom = '10px';
    controls.style.padding = '10px';
    controls.style.background = 'rgba(0, 0, 0, 0.05)';
    controls.style.borderRadius = '4px';

    const isReadOnly = this.getAttribute('readonly', 'false') === 'true';

    const createDateInput = (value: string, onChange: (val: string) => void) => {
      const input = doc.createElement('input') as unknown as HTMLInputElement;
      input.type = 'date';
      input.className = 'mi-input';
      input.style.padding = '4px';
      input.style.width = 'auto';
      input.value = value;
      if (isReadOnly) {
        input.disabled = true;
      } else {
        input.onchange = (e: any) => onChange(e.target.value);
      }
      return input;
    };

    controls.appendChild(doc.createTextNode('From: '));
    controls.appendChild(createDateInput(this.startDate, (val) => {
      this.startDate = val;
      this.refreshSelf();
    }));

    controls.appendChild(doc.createTextNode(' To: '));
    controls.appendChild(createDateInput(this.endDate, (val) => {
      this.endDate = val;
      this.refreshSelf();
    }));

    container.appendChild(controls);

    // --- Content ---
    const content = doc.createElement('div');
    container.appendChild(content);
    this.renderChildren(content, null);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    // Refresh if any media log changes or if media types change
    // This is a broad check, could be optimized
    if (Object.keys(changedTiddlers).some(t => this.wiki.getTiddler(t)?.hasTag('$:/tags/media-importer/Media') || this.wiki.getTiddler(t)?.hasTag('$:/tags/media-importer/Log'))) {
      this.refreshSelf();
      return true;
    }
    return this.refreshChildren(changedTiddlers);
  }
}

declare let exports: {
  MediaConsumptionSummary: typeof MediaConsumptionSummaryWidget;
};

exports.MediaConsumptionSummary = MediaConsumptionSummaryWidget;
