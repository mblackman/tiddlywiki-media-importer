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

  it('supports Music search results and Music view template rendering', function() {
    $tw.wiki.setText('$:/state/media-importer-selected', 'text', null, 'Music');
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: '$:/temp/search/music-result/00',
        tags: 'MusicSearchResult',
        draft_title: 'OK Computer',
        draft_year: '1997',
        draft_artist: '[[Radiohead]]',
        draft_cover: 'https://coverartarchive.org/release-group/b1392450-e666-3926-a536-22c65f834433/front-250',
      }),
    );
    $tw.wiki.setText('$:/state/Music-search', 'text', null, 'done');

    const uiHtml = $tw.wiki.renderTiddler('text/html', '$:/plugins/mblackman/media-importer/ui');
    expect(uiHtml).toContain('OK Computer');
    expect(uiHtml).toContain('By Radiohead');

    // Create an imported Music tiddler and verify its ViewTemplate
    $tw.wiki.addTiddler(
      new $tw.Tiddler({
        title: 'OK Computer (1997)',
        englishTitle: 'OK Computer',
        year: '1997',
        releaseDate: '1997-05-21',
        dataSource: 'MusicBrainz',
        url: 'https://musicbrainz.org/release-group/b1392450-e666-3926-a536-22c65f834433',
        id: 'b1392450-e666-3926-a536-22c65f834433',
        artist: '[[Radiohead]]',
        releaseType: 'Album',
        tracks: '12',
        label: '[[EMI]]',
        genres: '[[alternative rock]] [[art rock]]',
        onlineRating: '4.6',
        image: 'https://coverartarchive.org/release-group/b1392450-e666-3926-a536-22c65f834433/front-500',
        status: 'Backlog',
        tags: '$:/tags/media-importer/Media',
        'media-type': 'Music',
        plot: 'Tracklist:\n1. Airbag\n2. Paranoid Android',
      }),
    );

    const tplHtml = $tw.wiki.renderTiddler(
      'text/html',
      '$:/plugins/mblackman/media-importer/view-template',
      { variables: { currentTiddler: 'OK Computer (1997)' } },
    );
    expect(tplHtml).toContain('MusicBrainz Score');
    expect(tplHtml).toContain('View on MusicBrainz ↗');
    expect(tplHtml).toContain('Radiohead');
    expect(tplHtml).toContain('Album');
    expect(tplHtml).toContain('12');
    expect(tplHtml).toContain('EMI');
    expect(tplHtml).toContain('Listening &amp; Review History');
    expect(tplHtml).toContain('Date Listened');

    // Clean up
    $tw.wiki.deleteTiddler('$:/temp/search/music-result/00');
    $tw.wiki.deleteTiddler('$:/state/Music-search');
    $tw.wiki.deleteTiddler('$:/state/media-importer-selected');
    $tw.wiki.deleteTiddler('OK Computer (1997)');
  });

  it('supports MediaBacklog ranking, spotlight pick, and start-now workflow', function() {
    $tw.wiki.setText('$:/state/mblackman/media-importer/backlog/type', 'text', null, 'Book');
    const parser = $tw.wiki.parseTiddler('$:/plugins/mblackman/media-importer/ui/media-backlog');
    const widgetNode = $tw.wiki.makeWidget(parser, { document: $tw.fakeDocument });
    const container = $tw.fakeDocument.createElement('div');
    widgetNode.render(container, null);

    const backlogHtml = $tw.wiki.renderTiddler('text/html', '$:/plugins/mblackman/media-importer/ui/media-backlog');
    expect(backlogHtml).toContain('Media Backlog');
    expect(backlogHtml).toContain('Pick Next For Me');
    expect(backlogHtml).toContain('Blood Meridian (1985)');
    expect(backlogHtml).toContain('Infinite Jest (1996)');

    // 1. Move "The Road (2006)" to #1 (Top of Queue)
    const backlogWidget = widgetNode.children[0];
    backlogWidget.dispatchEvent({
      type: 'mi-backlog-move-top',
      param: 'The Road (2006)',
    });
    expect($tw.wiki.getTiddler('The Road (2006)').fields['backlog-rank']).toBe('1');
    expect($tw.wiki.getTiddler('Blood Meridian (1985)').fields['backlog-rank']).toBe('2');

    // 2. Move "The Road (2006)" down one spot (#1 -> #2)
    backlogWidget.dispatchEvent({
      type: 'mi-backlog-move-down',
      param: 'The Road (2006)',
    });
    expect($tw.wiki.getTiddler('Blood Meridian (1985)').fields['backlog-rank']).toBe('1');
    expect($tw.wiki.getTiddler('The Road (2006)').fields['backlog-rank']).toBe('2');

    // 3. Move "Grendel (1971)" to #1 and verify Pick Next recommender selects from top-ranked items
    backlogWidget.dispatchEvent({
      type: 'mi-backlog-move-top',
      param: 'Grendel (1971)',
    });
    expect($tw.wiki.getTiddler('Grendel (1971)').fields['backlog-rank']).toBe('1');

    backlogWidget.dispatchEvent({
      type: 'mi-backlog-pick-next',
    });
    const picked = $tw.wiki.getTiddlerText('$:/temp/mblackman/media-importer/backlog/spotlight');
    expect(['Grendel (1971)', 'Blood Meridian (1985)', 'The Road (2006)']).toContain(picked);

    // 4. Start "Grendel (1971)" now -> transitions to Active and logs today
    backlogWidget.dispatchEvent({
      type: 'mi-backlog-start-now',
      param: 'Grendel (1971)',
    });
    expect($tw.wiki.getTiddler('Grendel (1971)').fields.status).toBe('Active');

    // Clean up test mutations
    for (const t of [
      'Blood Meridian (1985)',
      "Gravity's Rainbow (1973)",
      'Grendel (1971)',
      'Infinite Jest (1996)',
      'The Road (2006)',
    ]) {
      const tid = $tw.wiki.getTiddler(t);
      if (tid) {
        $tw.wiki.addTiddler(
          new $tw.Tiddler(tid, {
            status: 'Backlog',
            'backlog-rank': undefined,
          }),
        );
      }
    }
    $tw.wiki.deleteTiddler('$:/temp/mblackman/media-importer/backlog/spotlight');
    $tw.wiki.deleteTiddler('$:/state/mblackman/media-importer/backlog/sort');
    $tw.wiki.deleteTiddler('$:/state/mblackman/media-importer/backlog/type');
  });
});
