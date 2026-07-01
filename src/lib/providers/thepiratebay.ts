import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { httpClient } from '../http-client'
import { BaseProvider } from './base'
import { formatBytes } from '../utils/filesize'
import { epochSecondToDate } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

const API_URL = 'https://apibay.org'

export class ThePirateBay extends BaseProvider {
  id = 'thepiratebay'
  name = 'ThePirateBay'
  url = 'https://thepiratebay.org'
  supportedCategories = [Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series, Category.Other]
  safetyStatus = { unsafe: 'TPB redirects to malicious websites' }
  enabledByDefault = false
  isCloudflareProtected = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const catIndex = categoryId(ctx.category)
    const json = await ctx.httpClient.getJson(`${API_URL}/q.php?q=${query}&cat=${catIndex}`)
    if (!Array.isArray(json)) return []
    return parseResults(json, this.name, this.url)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const id = detailsPageUrl.split('=').pop()
    const json = await httpClient.getJson(`${API_URL}/t.php?id=${id}`)
    if (!json || json.name === 'No results returned') return null
    return {
      infoHash: (json.info_hash || '').toLowerCase(),
      name: json.name,
      size: json.size ? formatBytes(parseFloat(json.size)) : undefined,
      seeders: parseInt(json.seeders) || 0,
      peers: parseInt(json.leechers) || 0,
      uploadDate: json.added ? epochSecondToDate(parseInt(json.added)).toISOString() : undefined,
      category: categoryFromId(parseInt(json.category)),
      uploader: json.username,
      magnetUri: getInfoHashFromMagnetUri(json.info_hash || ''),
      description: json.descr,
    }
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const url = category === Category.All
      ? `${API_URL}/precompiled/data_top100_recent.json`
      : `${API_URL}/q.php?q=category%3A${categoryId(category)}`
    const json = await httpClient.getJson(url)
    if (!Array.isArray(json)) return []
    return parseResults(json, this.name, this.url)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const url = category === Category.All
      ? `${API_URL}/precompiled/data_top100_48h.json`
      : `${API_URL}/precompiled/data_top100_48h_${categoryId(category)}.json`
    const json = await httpClient.getJson(url)
    if (!Array.isArray(json)) return []
    return parseResults(json, this.name, this.url)
  }
}

function parseResults(json: any[], providerName: string, providerUrl: string): Torrent[] {
  return json.map((item: any) => {
    if (item.name === 'No results returned') return null
    const infoHash = (item.info_hash || '').toLowerCase().trim()
    if (!infoHash) return null
    return {
      infoHash,
      name: item.name,
      size: item.size ? formatBytes(parseFloat(item.size)) : undefined,
      seeders: parseInt(item.seeders) || 0,
      peers: parseInt(item.leechers) || 0,
      providerName,
      uploadDate: item.added ? epochSecondToDate(parseInt(item.added)).toISOString() : undefined,
      category: categoryFromId(parseInt(item.category)),
      descriptionPageUrl: `${providerUrl}/description.php?id=${item.id}`,
    } as Torrent
  }).filter(Boolean) as Torrent[]
}

function categoryId(category: Category): number {
  const map: Record<string, number> = { 'All': 0, 'Anime': 0, 'Apps': 300, 'Books': 601, 'Games': 400, 'Movies': 200, 'Music': 101, 'Porn': 500, 'Series': 200, 'Other': 600 }
  return map[category] ?? 0
}

function categoryFromId(id: number): Category | undefined {
  if (id >= 300 && id <= 399) return Category.Apps
  if (id === 601) return Category.Books
  if (id >= 400 && id <= 499) return Category.Games
  if ([201, 202, 204, 207, 209, 210, 211].includes(id)) return Category.Movies
  if (id >= 100 && id <= 199) return Category.Music
  if (id >= 500 && id <= 599) return Category.Porn
  if ([205, 208, 212].includes(id)) return Category.Series
  return Category.Other
}
