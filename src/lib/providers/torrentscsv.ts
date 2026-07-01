import { Torrent, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { formatBytes } from '../utils/filesize'

export class TorrentsCSV extends BaseProvider {
  id = 'torrentscsv'
  name = 'TorrentsCSV'
  url = 'https://torrents-csv.com'
  supportedCategories = [Category.Other]
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const json = await ctx.httpClient.getJson(`${this.url}/service/search?q=${query}`)
    if (!json?.torrents) return []
    return json.torrents.map((t: any) => {
      const name = t.name
      const infoHash = t.infohash
      if (!name || !infoHash) return null
      const size = t.size_bytes != null ? formatBytes(t.size_bytes) : undefined
      const seeders = t.seeders ?? undefined
      const peers = t.leechers ?? undefined
      const uploadDate = t.created_unix != null ? new Date(t.created_unix * 1000).toISOString() : undefined
      return { infoHash, name, size, seeders, peers, providerName: this.name, uploadDate, category: Category.Other } as Torrent
    }).filter(Boolean)
  }
}
