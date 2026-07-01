import { SearchProvider, SearchContext, Torrent, TorrentDetails, Category, SearchProviderType } from '../types'
import { httpClient } from '../http-client'

export abstract class BaseProvider implements SearchProvider {
  abstract id: string
  abstract name: string
  abstract url: string
  abstract supportedCategories: Category[]
  abstract enabledByDefault: boolean

  cloudflareSolverUrl?: string
  safetyStatus: 'safe' | { unsafe: string } = 'safe'
  type: SearchProviderType = SearchProviderType.Builtin
  isCloudflareProtected: boolean = false

  abstract search(query: string, context: SearchContext): Promise<Torrent[]>

  getDetails?(detailsPageUrl: string): Promise<TorrentDetails | null>
  getLatestTorrents?(category?: Category): Promise<Torrent[]>
  getTopTorrents?(category?: Category): Promise<Torrent[]>
}
