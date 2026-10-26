describe('Media Importer UI & Workflow', function() {
  it('renders MediaImporter search results with batch queue and post-import actions', function() {
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: '$:/temp/search/result/00',
        tags: 'SearchResult',
        draft_title: 'Blood Meridian',
        draft_year: '1985',
        draft_author: '[[Cormac McCarthy]]',
        draft_cover: 'https://covers.openlibrary.org/b/id/419991-L.jpg',
        batch_selected: 'yes',
      }),
    );
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: '$:/temp/search/result/01',
        tags: 'SearchResult',
        draft_title: 'Suttree',
        draft_year: '1979',
        draft_author: '[[Cormac McCarthy]]',
        draft_cover: '',
      }),
    );
    $tw.wiki.setText('$:/state/Book-search', 'text', null, 'done');

    const html = $tw.wiki.renderTiddler('text/html', '$:/plugins/mblackman/media-importer/ui');
    expect(html).toContain('Import Selected (1)');
    expect(html).toContain('↗ Jump to Media');
    expect(html).toContain('+ Log Today');
    expect(html).not.toContain('Copy [[Link]]');
    expect(html).toContain('✎ Stage');

    // Clean up temporary search state
    $tw.wiki.deleteTiddler('$:/temp/search/result/00');
    $tw.wiki.deleteTiddler('$:/temp/search/result/01');
    $tw.wiki.deleteTiddler('$:/state/Book-search');
  });

  it('renders ViewTemplate without whitespace concatenation bugs or duplicate h1', function() {
    const html = $tw.wiki.renderTiddler(
      'text/html',
      '$:/core/ui/ViewTemplate/body/default',
      { variables: { currentTiddler: 'Blood Meridian (1985)' } },
    );
    const tplHtml = $tw.wiki.renderTiddler(
      'text/html',
      '$:/plugins/mblackman/media-importer/view-template',
      { variables: { currentTiddler: 'Blood Meridian (1985)' } },
    );
    expect(tplHtml).toContain('OpenLibraryAPI Score');
    expect(tplHtml).not.toContain('OpenLibraryAPIScore');
    expect(tplHtml).toContain('View on OpenLibraryAPI ↗');
    expect(tplHtml).toContain('External Cover URI');
    expect(tplHtml).toContain('Copy [[Link]]');
    expect(tplHtml).not.toContain('<h1');
    expect(html).toBeDefined();
  });

  it('renders MediaLibrary with top header, search box, and mobile filter toggle', function() {
    const libHtml = $tw.wiki.renderTiddler('text/html', '$:/plugins/mblackman/media-importer/ui/media-library');
    expect(libHtml).toContain('Media Library');
    expect(libHtml).toContain('+ Import Media');
    expect(libHtml).toContain('Filters &amp; Sort');
    expect(libHtml).toContain('Blood Meridian (1985)');
  });

  it('preserves the search input DOM node after switching media type, typing, and receiving search results', function() {
    const parser = $tw.wiki.parseTiddler('$:/plugins/mblackman/media-importer/ui');
    const widgetNode = $tw.wiki.makeWidget(parser, { document: $tw.fakeDocument });
    const container = $tw.fakeDocument.createElement('div');
    widgetNode.render(container, null);

    // 1. Switch media type from Book to Movie
    $tw.wiki.setText('$:/state/media-importer-selected', 'text', null, 'Movie');
    widgetNode.refresh({ '$:/state/media-importer-selected': { modified: true } });

    const findSearchInput = function(node) {
      if (!node) return null;
      if (node.tag === 'input' && node.attributes && String(node.attributes.class || '').indexOf('mi-unified-search-input') !== -1) {
        return node;
      }
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        const found = findSearchInput(children[i]);
        if (found) return found;
      }
      return null;
    };

    const inputAfterSwitch = findSearchInput(container);
    expect(Boolean(inputAfterSwitch)).toBe(true);

    // 2. Simulate typing into the search box (debounced update to $:/temp/media-importer/search-input)
    $tw.wiki.setText('$:/temp/media-importer/search-input', 'text', null, 'Inception');
    widgetNode.refresh({ '$:/temp/media-importer/search-input': { modified: true } });

    const inputAfterTyping = findSearchInput(container);
    expect(inputAfterTyping === inputAfterSwitch).toBe(true);

    // 3. Simulate async search state transitions (loading -> done + result tiddlers arriving)
    $tw.wiki.setText('$:/state/Movie-search', 'text', null, 'loading');
    widgetNode.refresh({ '$:/state/Movie-search': { modified: true } });
    expect(findSearchInput(container) === inputAfterSwitch).toBe(true);

    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: '$:/temp/search/movie/00',
        tags: 'MovieSearchResult',
        draft_title: 'Inception',
        draft_year: '2010',
      }),
    );
    $tw.wiki.setText('$:/state/Movie-search', 'text', null, 'done');
    widgetNode.refresh({
      '$:/temp/search/movie/00': { modified: true },
      '$:/state/Movie-search': { modified: true },
    });

    const inputAfterResults = findSearchInput(container);
    expect(inputAfterResults === inputAfterSwitch).toBe(true);

    // Clean up temporary state
    $tw.wiki.deleteTiddler('$:/temp/search/movie/00');
    $tw.wiki.deleteTiddler('$:/state/Movie-search');
    $tw.wiki.deleteTiddler('$:/temp/media-importer/search-input');
    $tw.wiki.deleteTiddler('$:/state/media-importer-selected');
  });
});
