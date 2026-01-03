/*\
title: $:/plugins/mblackman/media-importer/fetch-media.js
type: application/javascript
module-type: startup

Unified Media Manager for Books, Comics, Games, and Manga.
Fetches data from various APIs and formats them into fields.
\*/

(function () {
    /*jslint node: true, browser: true */
    /*global $tw: false */
    "use strict";
  
    exports.name = "media-manager-startup";
    exports.platforms = ["browser"];
    exports.after = ["startup"];
    exports.synchronous = true;

    // --- UTILS ---
    // Helper: Convert array to TiddlyWiki list string "[[Item]] [[Item2]]"
    function makeList(arr) {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return "";
      return arr
        .map(function (item) {
          // Support objects with `name` or plain strings
          var name =
            typeof item === "string" ? item : item && item.name ? item.name : "";
          if (!name) return "";
          // Replace spaces with underscores
          var token = name.trim().replace(/\s+/g, "_");
          return token;
        })
        .filter(Boolean)
        .join(" ");
    }
  
    // Helper: Format Date like "2025-08-02 - 11:28 pm"
    function formatCustomDate() {
      var d = new Date();
      var datePart =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
  
      var hours = d.getHours();
      var ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      var timePart =
        hours + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ampm;
      return datePart + " - " + timePart;
    }
  
    // --- HELPER: JSONP (For ComicVine) ---
    function fetchJSONP(url) {
      return new Promise(function (resolve, reject) {
        var callbackName = "cv_jsonp_" + Math.round(100000 * Math.random());
        window[callbackName] = function (data) {
          delete window[callbackName];
          document.body.removeChild(script);
          resolve(data);
        };
        var script = document.createElement("script");
        script.src = url + "&json_callback=" + callbackName;
        script.onerror = function () {
          delete window[callbackName];
          document.body.removeChild(script);
          reject(new Error("JSONP request failed"));
        };
        document.body.appendChild(script);
      });
    }
  
    // --- HELPER: GraphQL (For AniList) ---
    function fetchGraphQL(query, variables) {
      return fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query: query, variables: variables }),
      }).then((r) => r.json());
    }
  
    // --- HELPER: Pagination Strategy ---
    // Maps a smaller UI page size to a larger API page size (e.g. 5 items from a 20-item API page)
    function getPagedSlice(uiPage, uiSize, apiSize) {
      var ratio = Math.floor(apiSize / uiSize);
      var apiPage = Math.floor((uiPage - 1) / ratio) + 1;
      var offset = ((uiPage - 1) % ratio) * uiSize;
      return {
        apiPage: apiPage,
        start: offset,
        end: offset + uiSize
      };
    }

    // --- CORE LOGIC: REGISTER IMPORTER ---
    function registerMediaImporter(config) {
      var type = config.type; // e.g., "book", "game"
      var stateTiddler = "$:/state/" + type + "-search";
      var searchPrefix =
        "$:/temp/search/" + (config.prefix || type + "-result") + "/";
  
      // 1. SEARCH LISTENER
      $tw.rootWidget.addEventListener("tm-search-" + type, function (event) {
        var query = event.param;
        if (!query) return;

        var page = 1;
        if (event.paramObject && event.paramObject.page) {
          page = parseInt(event.paramObject.page, 10);
        }
  
        // Check API Key if required
        var apiKey = "";
        if (config.apiKeyTiddler) {
          apiKey = $tw.wiki.getTiddlerText(config.apiKeyTiddler);
          if (!apiKey) {
            alert("Missing API Key for " + type + ". Please set it in Control Panel > Media Importer.");
            return;
          }
        }
  
        $tw.wiki.setText(stateTiddler, "text", null, "loading");
  
        // Clear previous results
        var oldResults = $tw.wiki.filterTiddlers(
          "[prefix[" + searchPrefix + "]]"
        );
        for (var i = 0; i < oldResults.length; i++) {
          $tw.wiki.deleteTiddler(oldResults[i]);
        }
  
        // Execute Search Strategy
        config
          .searchFn(query, apiKey, page)
          .then((results) => {
            if (!results || results.length === 0) {
              $tw.wiki.setText(stateTiddler, "text", null, "done");
              return;
            }
  
            results.forEach(function (item, index) {
              var fields = Object.assign(
                {
                  title: searchPrefix + index,
                  tags: config.searchTag || "SearchResult",
                },
                item
              );
              $tw.wiki.addTiddler(new $tw.Tiddler(fields));
            });
            $tw.wiki.setText(stateTiddler, "text", null, "done");
          })
          .catch((err) => {
            console.error(type + " Search Error:", err);
            $tw.wiki.setText(stateTiddler, "text", null, "error");
          });
      });
  
      // 2. FETCH DETAILS LISTENER
      $tw.rootWidget.addEventListener("tm-fetch-" + type, function (event) {
        var tempTitle = event.param;
        var tempTiddler = $tw.wiki.getTiddler(tempTitle);
        if (!tempTiddler) return;
  
        var apiKey = config.apiKeyTiddler
          ? $tw.wiki.getTiddlerText(config.apiKeyTiddler)
          : "";
  
        config
          .fetchFn(tempTiddler.fields, apiKey)
          .then((fields) => {
            var finalTitle = fields.title;
  
            // Create Tiddler
            $tw.wiki.addTiddler(new $tw.Tiddler(fields));
  
            // UI Cleanup
            $tw.notifier.display("$:/temp/notification", {
              variables: { title: finalTitle },
            });
            $tw.wiki.setText(stateTiddler, "text", null, "");
  
            // Force Open in StoryList
            var storyList = $tw.wiki.getTiddlerList("$:/StoryList");
            if (storyList.indexOf(finalTitle) !== -1) {
              storyList.splice(storyList.indexOf(finalTitle), 1);
            }
            storyList.unshift(finalTitle);
            $tw.wiki.addTiddler(
              new $tw.Tiddler({ title: "$:/StoryList", list: storyList })
            );
          })
          .catch((err) => {
            console.error(type + " Fetch Error:", err);
            alert("Error fetching " + type + " details.");
          });
      });
    }
  
    exports.startup = function () {
      // --- CONFIG 1: BOOKS (OpenLibrary) ---
      registerMediaImporter({
        type: "Book",
        searchTag: "SearchResult",
        prefix: "result", // Matches original: $:/temp/search/result/
        searchFn: function (query, apiKey, page) {
          var p = page || 1;
          var url =
            "https://openlibrary.org/search.json?limit=5&q=" +
            encodeURIComponent(query) + "&page=" + p;
          return fetch(url)
            .then((res) => res.json())
            .then((data) => {
              return data.docs.slice(0, 5).map((book) => {
                var coverUrl = book.cover_i
                  ? "https://covers.openlibrary.org/b/id/" +
                    book.cover_i +
                    "-L.jpg"
                  : "";
                var fetchId =
                  book.isbn && book.isbn.length > 0
                    ? book.isbn[0]
                    : book.key || "";
                var authorList = book.author_name
                  ? makeList(book.author_name)
                  : "[[Unknown]]";
  
                return {
                  draft_title: book.title,
                  draft_author: authorList,
                  draft_year: book.first_publish_year
                    ? String(book.first_publish_year)
                    : "0000",
                  draft_id: fetchId,
                  draft_cover: coverUrl,
                };
              });
            });
        },
        fetchFn: function (draftFields) {
          var id = draftFields.draft_id;
          var url =
            id.indexOf("/works/") === 0 || id.indexOf("/books/") === 0
              ? "https://openlibrary.org" + id + ".json"
              : "https://openlibrary.org/isbn/" + id + ".json";
  
          return fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("API Request failed");
              return res.json();
            })
            .then((data) => {
              var cleanTitle =
                typeof data.title === "object" && data.title.value
                  ? data.title.value
                  : data.title;
              var finalTitle = cleanTitle + " (" + draftFields.draft_year + ")";
  
              var plot = "unknown";
              if (data.description) {
                plot =
                  typeof data.description === "string"
                    ? data.description
                    : data.description.value || "unknown";
              }
  
              return {
                title: finalTitle,
                book_title: cleanTitle,
                englishTitle: cleanTitle,
                year: draftFields.draft_year,
                dataSource: "OpenLibraryAPI",
                url:
                  "https://openlibrary.org" +
                  (data.key ? data.key : "/isbn/" + id),
                id: data.key || id,
                plot: plot,
                pages: data.number_of_pages
                  ? String(data.number_of_pages)
                  : "unknown",
                image: draftFields.draft_cover,
                onlineRating: "0",
                isbn:
                  data.isbn_10 && data.isbn_10[0] ? data.isbn_10[0] : "unknown",
                isbn13:
                  data.isbn_13 && data.isbn_13[0] ? data.isbn_13[0] : "unknown",
                released: "true",
                status: "Backlog",
                lastFinished: new Date().toISOString().split("T")[0],
                personalRating: "0",
                tags: "MediaType",
                "media-type": "Book",
                modified: formatCustomDate(),
                author: draftFields.draft_author,
              };
            });
        },
      });
  
      // --- CONFIG 2: COMICS (ComicVine) ---
      registerMediaImporter({
        type: "Comic",
        apiKeyTiddler: "$:/config/comicvine-api-key",
        searchTag: "ComicSearchResult",
        prefix: "comic-result",
        searchFn: function (query, apiKey, page) {
          var p = page || 1;
          var url =
            "https://comicvine.gamespot.com/api/search/?api_key=" +
            apiKey +
            "&format=jsonp&resources=volume&limit=5&page=" + p + "&query=" +
            encodeURIComponent(query);
          return fetchJSONP(url).then((data) => {
            if (data.error && data.error !== "OK") throw new Error(data.error);
            if (!data.results) return [];
            return data.results.map((comic) => ({
              draft_title: comic.name,
              draft_year: comic.start_year || "0000",
              draft_id: comic.api_detail_url,
              draft_publisher: comic.publisher ? comic.publisher.name : "Unknown",
              draft_image: comic.image ? comic.image.icon_url : "",
            }));
          });
        },
        fetchFn: function (draftFields, apiKey) {
          var url = draftFields.draft_id + "?api_key=" + apiKey + "&format=jsonp";
          return fetchJSONP(url).then((data) => {
            if (data.error && data.error !== "OK") throw new Error(data.error);
            var comic = data.results;
            var finalTitle = comic.name + " (" + draftFields.draft_year + ")";
  
            return {
              title: finalTitle,
              englishTitle: comic.name,
              year: draftFields.draft_year,
              dataSource: "ComicVine",
              url: comic.site_detail_url,
              id: String(comic.id),
              publisher: draftFields.draft_publisher,
              count_of_issues: comic.count_of_issues
                ? String(comic.count_of_issues)
                : "unknown",
              image: comic.image ? comic.image.super_url : "",
              plot: comic.deck || comic.description || "",
              status: "Backlog",
              personalRating: "0",
              tags: "MediaType",
              "media-type": "Comic",
              modified: formatCustomDate(),
            };
          });
        },
      });
  
      // --- CONFIG 3: GAMES (RAWG) ---
      registerMediaImporter({
        type: "Game",
        apiKeyTiddler: "$:/config/rawg-api-key",
        searchTag: "GameSearchResult",
        prefix: "game-result",
        searchFn: function (query, apiKey, page) {
          var p = page || 1;
          var url =
            "https://api.rawg.io/api/games?key=" +
            apiKey +
            "&page_size=5&page=" + p + "&search=" +
            encodeURIComponent(query);
          return fetch(url)
            .then((res) => res.json())
            .then((data) => {
              return data.results.slice(0, 5).map((game) => ({
                draft_title: game.name,
                draft_year: game.released
                  ? game.released.substring(0, 4)
                  : "0000",
                draft_id: String(game.id),
                draft_image: game.background_image,
              }));
            });
        },
        fetchFn: function (draftFields, apiKey) {
          var url =
            "https://api.rawg.io/api/games/" +
            draftFields.draft_id +
            "?key=" +
            apiKey;
          return fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("API Request failed");
              return res.json();
            })
            .then((data) => {
              var finalTitle = data.name + " (" + draftFields.draft_year + ")";
              return {
                title: finalTitle,
                englishTitle: data.name,
                year: draftFields.draft_year,
                dataSource: "RAWG",
                url: "https://rawg.io/games/" + data.slug,
                id: String(data.id),
                developers: makeList(data.developers),
                publishers: makeList(data.publishers),
                genres: makeList(data.genres),
                onlineRating: String(data.rating),
                image: data.background_image,
                released: "true",
                releaseDate: data.released,
                status: "Backlog",
                personalRating: "0",
                tags: "MediaType",
                "media-type": "Game",
                modified: formatCustomDate(),
                plot: data.description_raw || "",
              };
            });
        },
      });
  
      // --- CONFIG 4: MANGA (AniList) ---
      registerMediaImporter({
        type: "Manga",
        searchTag: "MangaSearchResult",
        prefix: "manga-result",
        searchFn: function (query, apiKey, page) {
          var p = page || 1;
          var gqlQuery = `
              query ($search: String, $page: Int) {
                Page(page: $page, perPage: 5) {
                  media(search: $search, type: MANGA, sort: POPULARITY_DESC) {
                    id
                    title { romaji english }
                    startDate { year }
                    coverImage { medium }
                    staff(perPage: 1) { nodes { name { full } } }
                  }
                }
              }`;
          return fetchGraphQL(gqlQuery, { search: query, page: p }).then((data) => {
            var results = data.data.Page.media;
            if (!results) throw new Error("No results");
            return results.map((manga) => {
              var title = manga.title.english || manga.title.romaji;
              var author = manga.staff.nodes[0]
                ? manga.staff.nodes[0].name.full
                : "Unknown";
              return {
                draft_title: title,
                draft_year: manga.startDate.year
                  ? String(manga.startDate.year)
                  : "0000",
                draft_id: String(manga.id),
                draft_image: manga.coverImage.medium,
                draft_author: author,
              };
            });
          });
        },
        fetchFn: function (draftFields) {
          var gqlQuery = `
              query ($id: Int) {
                Media(id: $id, type: MANGA) {
                  id
                  title { romaji english }
                  startDate { year }
                  description(asHtml: false)
                  coverImage { extraLarge }
                  genres
                  volumes
                  chapters
                  status
                  averageScore
                  staff(perPage: 3) { edges { role node { name { full } } } }
                }
              }`;
          return fetchGraphQL(gqlQuery, { id: draftFields.draft_id }).then(
            (data) => {
              var manga = data.data.Media;
              var title = manga.title.english || manga.title.romaji;
              var year = manga.startDate.year
                ? String(manga.startDate.year)
                : "0000";
              var finalTitle = title + " (" + year + ")";
  
              var authors = [];
              if (manga.staff && manga.staff.edges) {
                manga.staff.edges.forEach((edge) => {
                  if (edge.role.includes("Story") || edge.role.includes("Art")) {
                    authors.push(edge.node.name.full);
                  }
                });
              }
              authors = [...new Set(authors)];
  
              return {
                title: finalTitle,
                englishTitle: title,
                year: year,
                dataSource: "AniList",
                url: "https://anilist.co/manga/" + manga.id,
                id: String(manga.id),
                author: makeList(authors),
                genres: makeList(manga.genres),
                volumes: manga.volumes ? String(manga.volumes) : "unknown",
                chapters: manga.chapters ? String(manga.chapters) : "unknown",
                status: manga.status,
                onlineRating: manga.averageScore
                  ? (manga.averageScore / 20).toFixed(1)
                  : "0",
                image: manga.coverImage.extraLarge,
                status: "Backlog",
                personalRating: "0",
                tags: "MediaType",
                "media-type": "Manga",
                modified: formatCustomDate(),
                plot: manga.description || "",
              };
            }
          );
        },
      });

      // --- CONFIG 5: MOVIES (TMDB) ---
      registerMediaImporter({
        type: "Movie",
        apiKeyTiddler: "$:/config/tmdb-api-key",
        searchTag: "MovieSearchResult",
        prefix: "movie-result",
        searchFn: function (query, apiKey, page) {
          var paging = getPagedSlice(page || 1, 5, 20);
          var url = "https://api.themoviedb.org/3/search/movie?api_key=" + apiKey + "&page=" + paging.apiPage + "&query=" + encodeURIComponent(query);
          return fetch(url)
            .then((res) => res.json())
            .then((data) => {
              return data.results.slice(paging.start, paging.end).map((movie) => ({
                draft_title: movie.title,
                draft_year: movie.release_date ? movie.release_date.substring(0, 4) : "0000",
                draft_id: String(movie.id),
                draft_poster: movie.poster_path ? "https://image.tmdb.org/t/p/w500" + movie.poster_path : "",
                draft_overview: movie.overview
              }));
            });
        },
        fetchFn: function (draftFields, apiKey) {
          var url = "https://api.themoviedb.org/3/movie/" + draftFields.draft_id + "?api_key=" + apiKey + "&append_to_response=credits";
          return fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("API Request failed");
              return res.json();
            })
            .then((data) => {
              var year = data.release_date ? data.release_date.substring(0, 4) : "0000";
              var finalTitle = data.title + " (" + year + ")";
              
              var directors = [];
              var cast = [];
              if (data.credits) {
                  if (data.credits.crew) directors = data.credits.crew.filter(p => p.job === "Director").map(p => p.name);
                  if (data.credits.cast) cast = data.credits.cast.slice(0, 5).map(c => c.name);
              }

              return {
                title: finalTitle,
                englishTitle: data.original_title || data.title,
                year: year,
                dataSource: "TMDB",
                url: "https://www.themoviedb.org/movie/" + data.id,
                id: String(data.id),
                director: makeList(directors),
                cast: makeList(cast),
                genres: makeList(data.genres),
                runtime: String(data.runtime),
                onlineRating: data.vote_average 
                  ? (data.vote_average / 2).toFixed(1) 
                  : "0",
                image: data.poster_path ? "https://image.tmdb.org/t/p/w500" + data.poster_path : "",
                status: "Backlog",
                personalRating: "0",
                tags: "MediaType",
                "media-type": "Movie",
                modified: formatCustomDate(),
                plot: data.overview || ""
              };
            });
        },
      });

      // --- CONFIG 6: TV SHOWS (TMDB) ---
      registerMediaImporter({
        type: "TV Show",
        apiKeyTiddler: "$:/config/tmdb-api-key",
        searchTag: "TVShowSearchResult",
        prefix: "tv-result",
        searchFn: function (query, apiKey, page) {
          var paging = getPagedSlice(page || 1, 5, 20);
          var url = "https://api.themoviedb.org/3/search/tv?api_key=" + apiKey + "&page=" + paging.apiPage + "&query=" + encodeURIComponent(query);
          return fetch(url)
            .then((res) => res.json())
            .then((data) => {
              return data.results.slice(paging.start, paging.end).map((show) => ({
                draft_title: show.name,
                draft_year: show.first_air_date ? show.first_air_date.substring(0, 4) : "0000",
                draft_id: String(show.id),
                draft_poster: show.poster_path ? "https://image.tmdb.org/t/p/w500" + show.poster_path : "",
                draft_overview: show.overview
              }));
            });
        },
        fetchFn: function (draftFields, apiKey) {
          var url = "https://api.themoviedb.org/3/tv/" + draftFields.draft_id + "?api_key=" + apiKey + "&append_to_response=credits";
          return fetch(url)
            .then((res) => {
              if (!res.ok) throw new Error("API Request failed");
              return res.json();
            })
            .then((data) => {
              var year = data.first_air_date ? data.first_air_date.substring(0, 4) : "0000";
              var finalTitle = data.name + " (" + year + ")";
              
              var creators = [];
              var cast = [];
              if (data.created_by) creators = data.created_by.map(p => p.name);
              if (data.credits && data.credits.cast) cast = data.credits.cast.slice(0, 5).map(c => c.name);

              return {
                title: finalTitle,
                englishTitle: data.original_name || data.name,
                year: year,
                dataSource: "TMDB",
                url: "https://www.themoviedb.org/tv/" + data.id,
                id: String(data.id),
                creator: makeList(creators),
                cast: makeList(cast),
                genres: makeList(data.genres),
                seasons: String(data.number_of_seasons),
                episodes: String(data.number_of_episodes),
                onlineRating: data.vote_average 
                  ? (data.vote_average / 2).toFixed(1) 
                  : "0",
                image: data.poster_path ? "https://image.tmdb.org/t/p/w500" + data.poster_path : "",
                status: "Backlog",
                personalRating: "0",
                tags: "MediaType",
                "media-type": "TV Show",
                modified: formatCustomDate(),
                plot: data.overview || ""
              };
            });
        },
      });
    };
  })();