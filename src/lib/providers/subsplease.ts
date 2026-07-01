import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'
import { formatBytes } from '../utils/filesize'
import { httpClient } from '../http-client'

export class SubsPlease extends BaseProvider {
  id = 'subsplease'
  name = 'SubsPlease'
  url = 'https://subsplease.org'
  supportedCategories = [Category.Anime]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const url = `${this.url}/api?f=search&tz=$&s=${query}`
    const json = await ctx.httpClient.getJson(url)
    if (!json) return []
    return parseResults(json, this.name, this.url)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const url = `${this.url}/api/?f=latest&tz=$`
    const json = await httpClient.getJson(url)
    if (!json) return []
    return parseResults(json, this.name, this.url)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }
}

function parseResults(json: any, providerName: string, providerUrl: string): Torrent[] {
  const results: Torrent[] = []
  for (const [showName, animeObject] of Object.entries(json)) {
    const obj = animeObject as any
    const releaseDate = obj['release_date'] as string | undefined
    const uploadDate = releaseDate ? parseDateString(releaseDate)?.toISOString() : undefined
    const detailsPageUrlBase = obj['page'] ? `${providerUrl}/${obj['page']}` : undefined
    const episodeNumber = obj['episode'] as string
    if (!episodeNumber) continue
    const downloads = obj['downloads'] as any[] | undefined
    if (!downloads) continue
    for (const d of downloads) {
      const magnetUri = d['magnet'] as string | undefined
      if (!magnetUri) continue
      const size = parseSizeFromMagnetUri(magnetUri)
      const resolution = d['res'] as string
      if (!resolution) continue
      const name = `${showName} [${resolution}p]`
      const detailsUrl = detailsPageUrlBase ? `${detailsPageUrlBase}?ep=${episodeNumber}&res=${resolution}` : undefined
      results.push({
        infoHash: getInfoHashFromMagnetUri(magnetUri),
        name, size,
        uploadDate, category: Category.Anime,
        descriptionPageUrl: detailsUrl, magnetUri, providerName,
      })
    }
  }
  return results
}

async function parseDetails(html: string, pageUrl: string): Promise<TorrentDetails | null> {
  const $ = cheerio.load(html)
  const showId = $('table#show-release-table').attr('sid')
  if (!showId) return null
  const showName = $('h1.entry-title').first().text().trim()
  if (!showName) return null
  const posterUrl = $('img.img-responsive.img-center').attr('abs:src')
  const description = $('div.series-syn > p').first().text().trim() || undefined

  const queryPart = pageUrl.substring(pageUrl.lastIndexOf('?') + 1)
  const params = new URLSearchParams(queryPart)
  const episodeNumber = params.get('ep') || ''
  const torrentResolution = params.get('res') || ''

  return await fetchEpisodeDetails(showId, episodeNumber, torrentResolution, showName, posterUrl, description)
}

async function fetchEpisodeDetails(
  showId: string, episodeNumber: string, torrentResolution: string,
  showName: string, posterUrl?: string, description?: string,
): Promise<TorrentDetails | null> {
  const url = `https://subsplease.org/api/?f=show&tz=$&sid=${showId}`
  const json = await httpClient.getJson(url)
  if (!json) return null

  const episodeObj = json['episode'] as Record<string, any> | undefined
  if (!episodeObj) return null

  const episode = Object.values(episodeObj).find((e: any) => e['episode'] === episodeNumber)
  if (!episode) return null

  const download = (episode['downloads'] as any[] | undefined)?.find((d: any) => d['res'] === torrentResolution)
  if (!download) return null

  const magnetUri = download['magnet'] as string
  if (!magnetUri) return null

  const name = `${showName} - ${episodeNumber} [${torrentResolution}p]`
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = parseSizeFromMagnetUri(magnetUri)
  const timeRaw = episode['time'] as string | undefined
  const uploadDate = timeRaw ? parseDateString(timeRaw)?.toISOString() : undefined
  const fileDownloadLink = download['torrent'] as string | undefined

  return {
    infoHash, name, size, uploadDate,
    category: Category.Anime, magnetUri, fileDownloadLink,
    description, posterUrl,
  }
}

function parseSizeFromMagnetUri(magnetUri: string): string | undefined {
  const match = magnetUri.match(/xl=(\d+)/)
  if (match) return formatBytes(parseInt(match[1]))
  return undefined
}
