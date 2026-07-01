import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { httpClient } from '../http-client'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'

const API_URL = 'https://movies-api.accel.li/api/v2'

export class Yts extends BaseProvider {
  id = 'yts'
  name = 'YTS'
  url = 'https://yts.mx'
  supportedCategories = [Category.Movies]
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const json = await ctx.httpClient.getJson(`${API_URL}/list_movies.json?query_term=${query}`)
    if (!json?.data?.movies) return []
    return parseResults(json.data.movies, this.name, this.url)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const id = new URL(detailsPageUrl).searchParams.get('id') || detailsPageUrl.split('/').filter(Boolean).pop()
    if (!id) return null
    const json = await httpClient.getJson(`${API_URL}/movie_details.json?movie_id=${id}`)
    if (!json?.data?.movie) return null
    const m = json.data.movie
    const torrent = m.torrents?.[0]
    if (!torrent) return null
    const infoHash = getInfoHashFromMagnetUri(torrent.hash || '')
    return {
      infoHash,
      name: m.title,
      size: torrent.size || undefined,
      seeders: torrent.seeds || 0,
      peers: torrent.peers || 0,
      category: Category.Movies,
      magnetUri: createMagnetUri(infoHash),
      description: m.description_full || m.description_intro || undefined,
      posterUrl: m.large_cover_image || m.medium_cover_image || undefined,
      screenshotUrls: [m.large_screenshot_image1, m.large_screenshot_image2, m.large_screenshot_image3].filter(Boolean),
    }
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const json = await httpClient.getJson(`${API_URL}/list_movies.json?limit=50&sort=date_added&order=desc`)
    if (!json?.data?.movies) return []
    return parseResults(json.data.movies, this.name, this.url)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const json = await httpClient.getJson(`${API_URL}/list_movies.json?limit=50&sort=seeds&order=desc`)
    if (!json?.data?.movies) return []
    return parseResults(json.data.movies, this.name, this.url)
  }
}

function parseResults(movies: any[], providerName: string, providerUrl: string): Torrent[] {
  const results: Torrent[] = []
  for (const m of movies) {
    const torrents = m.torrents || []
    for (const t of torrents) {
      const infoHash = getInfoHashFromMagnetUri(t.hash || '')
      if (!infoHash) continue
      results.push({
        infoHash,
        name: `${m.title} (${m.year}) [${t.quality}]`,
        size: t.size || undefined,
        seeders: t.seeds || 0,
        peers: t.peers || 0,
        providerName,
        category: Category.Movies,
        magnetUri: t.url || createMagnetUri(infoHash),
        descriptionPageUrl: m.url || `${providerUrl}/movie/${m.id}`,
      })
    }
  }
  return results
}
