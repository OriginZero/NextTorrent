import { Torrent, TorrentDetails, SearchResults, SearchException, Category, SearchContext } from './types'
import { SearchProvidersManager } from './manager'
import { httpClient } from './http-client'

export type GetTorrentDetailsResponse =
  | { type: 'success'; details: TorrentDetails }
  | { type: 'unsupported_url' }
  | { type: 'unavailable' }

export class SearchProvidersGateway {
  constructor(private manager: SearchProvidersManager) {}

  async searchTorrents(query: string, category: Category): Promise<SearchResults> {
    const providers = this.manager.getEnabledProvidersByCategory(category)
    if (providers.length === 0) return { successes: [], failures: [] }

    const encodedQuery = encodeURIComponent(query)
    const context: SearchContext = { category, httpClient }

    const results = await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const torrents = await provider.search(encodedQuery, context)
          return { ok: true as const, torrents, name: provider.name }
        } catch (err: any) {
          return {
            ok: false as const,
            exception: {
              searchProviderName: provider.name,
              searchProviderUrl: provider.url,
              message: err.message || String(err),
              cause: err.stack,
            } as SearchException,
          }
        }
      })
    )

    const successes: Torrent[] = []
    const failures: SearchException[] = []

    for (const r of results) {
      if (r.status === 'rejected') continue
      if (r.value.ok) successes.push(...r.value.torrents)
      else failures.push(r.value.exception)
    }

    return { successes, failures }
  }

  async getTorrentDetails(detailsPageUrl: string, providerName: string): Promise<GetTorrentDetailsResponse> {
    const provider =
      this.manager.findDetailsProviderByUrl(detailsPageUrl) ??
      this.manager.findDetailsProviderByName(providerName)
    if (!provider) return { type: 'unsupported_url' }

    const details = await provider.getDetails!(detailsPageUrl)
    if (!details) return { type: 'unavailable' }
    return { type: 'success', details }
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const providers = this.manager.getEnabledLatestTorrentsProviders(category)
    const results = await Promise.allSettled(
      providers.map(p => p.getLatestTorrents!(category))
    )
    return results
      .filter((r): r is PromiseFulfilledResult<Torrent[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const providers = this.manager.getEnabledTopTorrentsProviders(category)
    const results = await Promise.allSettled(
      providers.map(p => p.getTopTorrents!(category))
    )
    return results
      .filter((r): r is PromiseFulfilledResult<Torrent[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
  }
}
