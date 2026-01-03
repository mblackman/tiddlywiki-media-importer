# TiddlyWiki Media Importer

A TiddlyWiki 5 plugin that serves as a unified media manager for Books, Comics, Games, Manga, Movies, and TV Shows. It fetches metadata from various public APIs and formats them into rich Tiddlers with cover images, descriptions, and ratings.

## Features

- **Unified Search Interface**: Search across multiple media types from a single dashboard.
- **Rich Metadata**: Imports titles, release dates, authors/creators, genres, plots, and cover images.
- **Library Dashboard**: A built-in library view to filter and sort your collection by status (Backlog, Active, Completed, Dropped), rating, and year.
- **Custom View Template**: Displays media tiddlers with a specialized layout including a sidebar for the poster and rating.

## Supported Services

| Media Type | Source API | API Key Required? |
| :--- | :--- | :--- |
| **Books** | [OpenLibrary](https://openlibrary.org/) | ❌ No |
| **Comics** | [ComicVine](https://comicvine.gamespot.com/) | ✅ Yes |
| **Games** | [RAWG](https://rawg.io/) | ✅ Yes |
| **Manga** | [AniList](https://anilist.co/) | ❌ No |
| **Movies** | [TMDB](https://www.themoviedb.org/) | ✅ Yes |
| **TV Shows** | [TMDB](https://www.themoviedb.org/) | ✅ Yes |

## Installation

1. Go to the [Releases](https://github.com/mblackman/tiddlywiki-media-importer/releases) page.
2. Download the `media-importer.json` file from the latest release.
3. Drag and drop the file into your TiddlyWiki.
4. Click **Import**.
5. Save and Reload your TiddlyWiki.

## Configuration

Some importers require free API keys to function.

1. Open the **Control Panel** in your TiddlyWiki.
2. Navigate to the **Settings** tab, then look for **Media Importer**.
3. Enter your API keys for the services you wish to use:
    - **ComicVine**: Get Key
    - **RAWG**: Get Key
    - **TMDB**: Get Key

## Usage

1. Create a media importer tiddler and add the text: `{{$:/plugins/mblackman/media-importer/ui}}`.
2. Select the tab for the media type you want to add (e.g., Book, Movie).
3. Type the title and press Enter or click Search.
4. Click **Import** on the desired result.
5. The item is added to your wiki and opened automatically.

## License

MIT
