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
  execute() {
    const startDate = this.getAttribute('startDate', '0000-00-00');
    const endDate = this.getAttribute('endDate', '9999-99-99');

    const mediaLogFilter =
      `[tag[$:/tags/media-importer/Log]!has[draft.of]] :filter[get[log-date]compare:string:gteq[${startDate}]] :filter[get[log-date]compare:string:lteq[${endDate}]]`;

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

    if (startDate !== '0000-00-00' || endDate !== '9999-99-99') {
      let rangeText = '';
      if (startDate !== '0000-00-00' && endDate !== '9999-99-99') {
        rangeText = `${startDate} to ${endDate}`;
      } else if (startDate !== '0000-00-00') {
        rangeText = `Since ${startDate}`;
      } else {
        rangeText = `Until ${endDate}`;
      }
      nodes.push(h('div', { class: 'mi-section-tight' }, [
        h('div', { class: 'mi-label' }, [text(`Summary: ${rangeText}`)]),
      ]));
    }

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

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    // Refresh if any media log changes or if media types change
    // This is a broad check, could be optimized
    if (Object.keys(changedTiddlers).some(t => t.startsWith('$:/media-log/') || this.wiki.getTiddler(t)?.hasTag('$:/tags/media-importer/Media'))) {
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
