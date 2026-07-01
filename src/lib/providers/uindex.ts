import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

const CATEGORY_MAP: Record<string, number> = { 'All': 0, 'Books': 0, 'Anime': 7, 'Apps': 5, 'Games': 3, 'Movies': 1, 'Music': 4, 'Porn': 6, 'Series': 2, 'Other': 8 }

export class UIndex extends BaseProvider {
  id = 'uindex'
  name = 'UIndex'
  url = 'https://uindex.org'
  supportedCategories = [Category.Anime, Category.Apps, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series, Category.Other]
  cloudflareSolverUrl = 'https://uindex.org/search.php?search=ubuntu'
  isCloudflareProtected = true
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/search.php?search=${query}&c=${CATEGORY_MAP[ctx.category] ?? 0}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/search.php?c=${CATEGORY_MAP[category] ?? 0}`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/top.php?t=24h&c=${CATEGORY_MAP[category] ?? 0}`)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.sr-table, table.top-table').first().find('tbody > tr').each((_, el) => {
    const $el = $(el)
    const name = $el.find('td.sr-col-name > a.sr-torrent-link').text().trim()
    if (!name) return
    const magnetUri = $el.find('td.sr-col-name > a.sr-magnet').attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = $el.find('td.sr-col-size').text().trim() || undefined
    const seedersText = $el.find('td.sr-col-seeders > span.sr-seed').text().trim().replace(/,/g, '')
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peersText = $el.find('td.sr-col-leechers > span.sr-leech').text().trim().replace(/,/g, '')
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const dateText = $el.find('td.sr-col-uploaded').text().trim()
    const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
    const category = categoryFromRawString($el.find('td.sr-col-cat > a.sr-cat-badge').text().trim())
    const detailsUrl = $el.find('td.sr-col-name > a.sr-torrent-link').attr('abs:href')
    results.push({ infoHash, name, size, seeders, peers, providerName, uploadDate, category, descriptionPageUrl: detailsUrl, magnetUri })
  })
  return results
}

function parseDetails(html: string, baseUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('.dt-title').text().trim()
  if (!name) return null
  const magnetUri = $('a.dt-download-btn').attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = $('#content > div.dt-info-card > div > div:nth-child(1) > div:nth-child(2) > span.dt-info-value').text().trim() || undefined
  const seedersText = $('.dt-seed').text().trim().replace(/,/g, '')
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peersText = $('.dt-leech').text().trim().replace(/,/g, '')
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const dateText = $('#content > div.dt-info-card > div > div:nth-child(1) > div:nth-child(3) > span.dt-info-value > span.dt-info-dim').text().trim()
  const uploadDate = dateText ? parseDate(dateText.replace(/^\(|\)$/g, ''))?.toISOString() : undefined
  const category = categoryFromRawString($('.sr-cat-badge').text().trim())
  const lastCheckedText = $('#content > div.dt-info-card > div > div:nth-child(2) > div:nth-child(3) > span.dt-info-value > span.dt-info-dim').text().trim()
  const lastChecked = lastCheckedText ? parseDate(lastCheckedText.replace(/^\(|\)$/g, ''))?.toISOString() : undefined
  const description = $('.dt-descr-body').html() || undefined
  const posterUrl = $('.tmdb-poster > img').attr('abs:src')
  return { infoHash, name, size, seeders, peers, uploadDate, category, lastChecked, magnetUri, description, posterUrl }
}

function parseDate(date: string): Date | null {
  return parseDateString(date)
}

function categoryFromRawString(raw: string): Category | undefined {
  return ({ 'Anime': Category.Anime, 'Apps': Category.Apps, 'Games': Category.Games, 'Movies': Category.Movies, 'Music': Category.Music, 'XXX': Category.Porn, 'TV': Category.Series, 'Other': Category.Other } as Record<string, Category>)[raw] ?? Category.Other
}
