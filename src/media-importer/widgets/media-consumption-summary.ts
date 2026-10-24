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
    const watchLogFilter =
      `[tag[$:/tags/media-importer/WatchLog]!has[draft.of]] :filter[get[date]compare:string:gteq[${filterStart}]] :filter[get[date]compare:string:lteq[${filterEnd}]]`;

    const logTiddlers = this.wiki.filterTiddlers(mediaLogFilter);
    const watchLogTiddlers = this.wiki.filterTiddlers(watchLogFilter);

    // Track unique dates logged per media item so Daily Logs and WatchLogs on the same day don't double-count
    const itemDates = new Map<string, Set<string>>();
    const activeDates = new Set<string>();

    for (const log of logTiddlers) {
      const logTiddler = this.wiki.getTiddler(log);
      const logDate = (logTiddler?.fields['log-date'] as string) || log.replace('$:/media-log/', '');
      const items = this.wiki.getTiddlerList(log, 'media-log');
      for (const item of items) {
        if (!itemDates.has(item)) itemDates.set(item, new Set());
        itemDates.get(item)!.add(logDate);
        activeDates.add(logDate);
      }
    }

    for (const watchLog of watchLogTiddlers) {
      const tid = this.wiki.getTiddler(watchLog);
      if (!tid) continue;
      const item = tid.fields['media-title'] as string;
      const date = (tid.fields['date'] as string) || '';
      if (!item || !date) continue;
      if (!itemDates.has(item)) itemDates.set(item, new Set());
      itemDates.get(item)!.add(date);
      activeDates.add(date);
    }

    const mediaTypes = this.wiki.filterTiddlers('[tag[$:/tags/media-importer/Media]get[media-type]unique[]sort[]]');
    const nodes: IParseTreeNode[] = [];

    const allMediaItems = Array.from(itemDates.keys()).sort();

    if (allMediaItems.length === 0) {
      nodes.push(h('div', { class: 'mi-empty-state' }, [
        text('No media activity logged for this period.'),
      ]));
    } else {
      nodes.push(h('div', { class: 'mi-sublabel', style: 'display: flex; justify-content: space-between; margin-bottom: 8px;' }, [
        h('span', {}, [text('Unique Media: '), h('b', {}, [text(allMediaItems.length.toString())])]),
        h('span', {}, [text('Active Days: '), h('b', {}, [text(activeDates.size.toString())])]),
      ]));

      for (const type of mediaTypes) {
        const itemsOfType = allMediaItems.filter(item => this.wiki.getTiddler(item)?.fields['media-type'] === type);

        if (itemsOfType.length > 0) {
          nodes.push(h('h5', { style: 'margin-bottom: 5px; margin-top: 15px;' }, [text(type)]));

          const summaryItems: IParseTreeNode[] = [];
          for (const item of itemsOfType) {
            const count = itemDates.get(item)?.size || 0;

            summaryItems.push(h('div', { class: 'mi-summary-item' }, [
              h('div', { class: 'mi-summary-link' }, [{ type: 'link', attributes: { to: { type: 'string', value: item } }, children: [text(item)] }]),
              h('span', { class: 'mi-summary-badge' }, [text(`${count}d`)]),
            ]));
          }
          nodes.push(h('div', { class: 'mi-summary-group' }, summaryItems));
        }
      }
    }

    this.makeChildWidgets([h('div', { class: 'mi-section' }, nodes)]);
  }

  render(parent: Element, nextSibling: Element | null) {
    this.parentDomNode = parent;
    this.computeAttributes();
    this.execute();

    const document = this.document;
    const container = document.createElement('div');
    container.className = 'mi-media-consumption-summary';
    parent.insertBefore(container, nextSibling);
    this.domNodes.push(container);

    // --- Controls ---
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '10px';
    controls.style.marginBottom = '10px';
    controls.style.padding = '10px';
    controls.style.background = 'rgba(0, 0, 0, 0.05)';
    controls.style.borderRadius = '4px';

    const isReadOnly = this.getAttribute('readonly', 'false') === 'true';

    const createDateInput = (value: string, onChange: (value_: string) => void) => {
      const input = document.createElement('input') as unknown as HTMLInputElement;
      input.type = 'date';
      input.className = 'mi-input';
      input.style.padding = '4px';
      input.style.width = 'auto';
      input.value = value;
      if (isReadOnly) {
        input.disabled = true;
      } else {
        input.onchange = (e: any) => {
          onChange(e.target.value);
        };
      }
      return input;
    };

    controls.appendChild(document.createTextNode('From: '));
    controls.appendChild(createDateInput(this.startDate, (value) => {
      this.startDate = value;
      this.refreshSelf();
    }));

    controls.appendChild(document.createTextNode(' To: '));
    controls.appendChild(createDateInput(this.endDate, (value) => {
      this.endDate = value;
      this.refreshSelf();
    }));

    container.appendChild(controls);

    // --- Content ---
    const content = document.createElement('div');
    container.appendChild(content);
    this.renderChildren(content, null);
  }

  refresh(changedTiddlers: IChangedTiddlers) {
    const changedAttributes = this.computeAttributes();
    if (Object.keys(changedAttributes).length > 0) {
      this.refreshSelf();
      return true;
    }

    // Refresh if any media log, watch log, or media item changes
    if (
      Object.keys(changedTiddlers).some(t => {
        if (changedTiddlers[t]?.deleted) return true;
        const tid = this.wiki.getTiddler(t);
        return (
          tid?.hasTag('$:/tags/media-importer/Media') ||
          tid?.hasTag('$:/tags/media-importer/Log') ||
          tid?.hasTag('$:/tags/media-importer/WatchLog')
        );
      })
    ) {
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
