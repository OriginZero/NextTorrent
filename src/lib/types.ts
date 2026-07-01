export type SearchProviderId = string
export type MagnetUri = string

export enum Category {
  All = 'All',
  Anime = 'Anime',
  Apps = 'Apps',
  Books = 'Books',
  Games = 'Games',
  Movies = 'Movies',
  Music = 'Music',
  Porn = 'Porn',
  Series = 'Series',
  Other = 'Other',
}

export interface Torrent {
  infoHash: string
  name: string
  size?: string
  seeders?: number
  peers?: number
  providerName: string
  uploadDate?: string
  category?: Category
  descriptionPageUrl?: string
  magnetUri?: string
  fileDownloadLink?: string
}

export interface TorrentDetails {
  infoHash: string
  name: string
  size?: string
  seeders?: number
  peers?: number
  uploadDate?: string
  category?: Category
  uploader?: string
  lastChecked?: string
  magnetUri: string
  fileDownloadLink?: string
  description?: string
  posterUrl?: string
  screenshotUrls?: string[]
}

export interface SearchResults {
  successes: Torrent[]
  failures: SearchException[]
}

export interface SearchException {
  searchProviderName: string
  searchProviderUrl: string
  message: string
  cause?: string
}

export interface SearchContext {
  category: Category
  httpClient: HttpClient
}

export interface HttpClient {
  get(url: string, headers?: Record<string, string>): Promise<string>
  getJson(url: string, headers?: Record<string, string>): Promise<any>
  postJson(url: string, payload: any): Promise<any>
  submitForm(url: string, formData: Record<string, string>): Promise<string | null>
}

export enum SearchProviderType {
  Builtin = 'Builtin',
  Torznab = 'Torznab',
}

export interface SearchProvider {
  id: SearchProviderId
  name: string
  url: string
  alternateUrlDomains?: string[]
  cloudflareSolverUrl?: string
  supportedCategories: Category[]
  safetyStatus: 'safe' | { unsafe: string }
  enabledByDefault: boolean
  type: SearchProviderType
  isCloudflareProtected: boolean
  search(query: string, context: SearchContext): Promise<Torrent[]>
  getDetails?(detailsPageUrl: string): Promise<TorrentDetails | null>
  getLatestTorrents?(category?: Category): Promise<Torrent[]>
  getTopTorrents?(category?: Category): Promise<Torrent[]>
}
