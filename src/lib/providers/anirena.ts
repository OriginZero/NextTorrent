import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

const LIST_ITEM = 'table.tl-table > tbody > tr'
const TORRENT_NAME = 'td.col-name > div.tl-name-wrap > a.tl-torrent-name'
const SIZE = 'td.col-size'
const SEEDERS = 'td.col-se > span.tl-se'
const PEERS = 'td.col-le > span.tl-le'
const CATEGORY_SEL = 'td.col-cat'
const MAGNET_URI = 'td.col-actions > div.tl-actions > a:nth-child(1)'
const FILE_DOWNLOAD_LINK = 'td.col-actions > div.tl-actions > a:nth-child(2)'
const DETAILS_PAGE_URL = TORRENT_NAME

export class AniRena extends BaseProvider {
  id = 'anirena'
  name = 'AniRena'
  url = 'https://anirena.com'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Music, Category.Porn, Category.Series, Category.Other]
  enabledByDefault = false

  private categoryMap: Record<string, string> = {
    [Category.Anime]: 'anime',
    [Category.Apps]: 'software',
    [Category.Books]: 'manga',
    [Category.Music]: 'audio',
    [Category.Porn]: 'hentai',
    [Category.Series]: 'live',
    [Category.Other]: 'other',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let requestUrl = `${this.url}?q=${query}&page=1`
    if (ctx.category !== Category.All) {
      const cat = this.categoryMap[ctx.category]
      if (cat) requestUrl += `&cat=${cat}`
    }
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(this.url)
    return parseResults(html, this.url, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    return this.getLatestTorrents(category)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }
}

async function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $(LIST_ITEM).each((_, el) => {
    const $el = $(el)
    const magnetUriSourceLink = $el.find(MAGNET_URI).first().attr('abs:href')
    if (!magnetUriSourceLink) return
    // We'll resolve redirects asynchronously later
    const torrentName = $el.find(TORRENT_NAME).first().text().trim()
    if (!torrentName) return
    const $magnetLink = $el.find(MAGNET_URI).first()
    const magnetSrc = $magnetLink.attr('abs:href') || ''
    const size = $el.find(SIZE).first().text().trim() || undefined
    const seedersText = $el.find(SEEDERS).first().text().trim()
    const peersText = $el.find(PEERS).first().text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const ts = $el.attr('data-created-ts')
    const uploadDate = ts ? new Date(parseInt(ts) * 1000).toISOString() : undefined
    const catTitle = $el.find(CATEGORY_SEL).first().attr('title') || ''
    const category = catTitle ? getCategoryFromRawString(catTitle.split('/')[0].trim()) : undefined
    const fileDownloadLink = $el.find(FILE_DOWNLOAD_LINK).first().attr('abs:href') || undefined
    const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

    // Store data to resolve magnet later
    results.push({
      name: torrentName, size, seeders, peers,
      uploadDate, category, providerName,
      fileDownloadLink, descriptionPageUrl: detailsPageUrl,
      infoHash: '', magnetUri: magnetSrc,
    })
  })
  // Resolve magnet redirects
  await Promise.all(results.map(async (r) => {
    if (r.magnetUri && !r.magnetUri.startsWith('magnet:')) {
      const location = await getRedirectLocation(r.magnetUri)
      if (location) {
        r.magnetUri = location
        r.infoHash = getInfoHashFromMagnetUri(location)
      }
    } else if (r.magnetUri) {
      r.infoHash = getInfoHashFromMagnetUri(r.magnetUri)
    }
  }))
  return results.filter(r => r.infoHash)
}

async function getRedirectLocation(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    })
    clearTimeout(timer)
    return res.headers.get('Location')
  } catch {
    return null
  }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const infoHashCode = $('code.td-ov-stat-hash').first().text().trim().toLowerCase()
  if (!infoHashCode) return null
  const torrentName = $('h1.td-title').first().text().trim()
  if (!torrentName) return null

  const size = $('div.td-ov-stats > div.td-ov-stat:nth-child(4) > div.td-ov-stat-num').first().text().trim() || undefined
  const seedersText = $('div.td-ov-stats > div.td-ov-stat--se > div.td-ov-stat-num').first().text().trim()
  const peersText = $('div.td-ov-stats > div.td-ov-stat--le > div.td-ov-stat-num').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const dateEl = $('div.td-ov-meta > div.td-ov-meta-val:nth-child(6) > span').first()
  const utc = dateEl.attr('data-utc')
  const uploadDate = utc ? parseDateString(utc)?.toISOString() : undefined
  const catText = $('div.td-ov-meta-val:nth-child(2) a.td-cat-name.td-cat-link').first().text().trim()
  const category = catText ? getCategoryFromRawString(catText) : undefined
  const uploader = $('div.td-ov-meta > div.td-ov-meta-val:nth-child(4)').first().text().trim() || undefined
  const magnetLink = $('div.td-actions > a:nth-child(1)').first().attr('abs:href') || ''
  const fileDownloadLink = $('div.td-actions > a:nth-child(2)').first().attr('abs:href') || undefined
  const description = $('script#td-description-raw').first().html()?.replace(/^"/, '').replace(/"$/, '') || undefined
  const posterUrl = $('div.td-anime-poster > img').first().attr('abs:src') || undefined

  const magnetUri = magnetLink.startsWith('magnet:') ? magnetLink : (() => {
    // If it's a redirect URL, we'd resolve it, but fallback to creating it
    return createMagnetUri(infoHashCode)
  })()
  const infoHash = getInfoHashFromMagnetUri(magnetUri) || infoHashCode

  return { infoHash, name: torrentName, size, seeders, peers, uploadDate, category, uploader, magnetUri, fileDownloadLink, description, posterUrl }
}

function getCategoryFromRawString(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    'Anime': Category.Anime, 'Manga': Category.Books, 'Audio': Category.Music,
    'Literature': Category.Books, 'Live Action': Category.Series,
    'Software': Category.Apps, 'Hentai': Category.Porn, 'Other': Category.Other,
  }
  return map[raw] || Category.Other
}
