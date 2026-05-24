export interface MediaDraftFields {
  draft_title?: string;
  draft_year?: string;
  draft_id?: string;
  draft_image?: string;
  draft_cover?: string;
  draft_poster?: string;
  draft_author?: string;
  draft_publisher?: string;
  draft_overview?: string;
  [key: string]: any;
}

export interface MediaFinalFields {
  title: string;
  englishTitle?: string;
  year: string;
  dataSource: string;
  url: string;
  id: string;
  status: string;
  tags: string;
  'media-type': string;
  modified: string;
  image?: string;
  plot?: string;
  onlineRating?: string;
  released?: string;
  [key: string]: any;
}

export interface MediaImporterConfig {
  type: string;
  apiKeyTiddler?: string;
  searchTag: string;
  prefix: string;
  searchFn: (query: string, apiKey: string, page: number) => Promise<MediaDraftFields[]>;
  fetchFn: (draftFields: MediaDraftFields, apiKey: string) => Promise<MediaFinalFields>;
}
