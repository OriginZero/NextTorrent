import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class BangumiMoe extends BaseProvider {
  id = 'bangumimoe'
  name = 'BangumiMoe'
  url = 'https://bangumi.moe'
  supportedCategories = [Category.Anime]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const responseJson = await ctx.httpClient.postJson(
      `${this.url}/api/v2/torrent/search`,
      { query }
    )
    if (!responseJson?.torrents) return []
    return parseResults(responseJson.torrents, this.name, this.url)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const torrentId = detailsPageUrl.split('/').filter(Boolean).pop()
    if (!torrentId) return null
    const responseJson = await httpClient.postJson(
      'https://bangumi.moe/api/torrent/fetch',
      { _id: torrentId }
    )
    if (!responseJson) return null
    return parseDetailsJson(responseJson)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const responseJson = await httpClient.getJson(`${this.url}/api/torrent/latest`)
    if (!responseJson?.torrents) return []
    return parseResults(responseJson.torrents, this.name, this.url)
  }
}

function parseResults(torrents: any[], providerName: string, providerUrl: string): Torrent[] {
  return torrents
    .map((obj: any) => {
      const torrentName = obj.title
      const magnetUri = obj.magnet
      if (!torrentName || !magnetUri) return null
      const infoHash = obj.infohash || getInfoHashFromMagnetUri(magnetUri)
      const size = obj.size || undefined
      const seeders = (obj.seeders as number) ?? undefined
      const peers = (obj.leechers as number) ?? undefined
      const uploadDate = obj.publish_time ? new Date(obj.publish_time).toISOString() : undefined
      const detailsPageUrl = obj._id ? `${providerUrl}/torrent/${obj._id}` : undefined
      return {
        infoHash, name: torrentName, size, seeders, peers,
        uploadDate, providerName,
        category: Category.Anime,
        magnetUri, descriptionPageUrl: detailsPageUrl,
      } as Torrent
    })
    .filter(Boolean) as Torrent[]
}

function parseDetailsJson(obj: any): TorrentDetails | null {
  const torrentName = obj.title
  const magnetUri = obj.magnet
  if (!torrentName || !magnetUri) return null
  const infoHash = obj.infohash || getInfoHashFromMagnetUri(magnetUri)
  const size = obj.size || undefined
  const seeders = (obj.seeders as number) ?? undefined
  const peers = (obj.leechers as number) ?? undefined
  const uploadDate = obj.publish_time ? new Date(obj.publish_time).toISOString() : undefined
  return {
    infoHash, name: torrentName, size, seeders, peers,
    uploadDate, category: Category.Anime,
    magnetUri,
  }
}
