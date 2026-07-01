import * as cheerio from 'cheerio'
import { createHash } from 'crypto'
import { parse as dateParse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, SearchContext, Category } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const SESSION_ID = 'meta[name="csrf-token"]'
const LIST_ITEM = 'table.search-table > tbody > tr'
const TORRENT_NAME = 'td:nth-child(1) > div:nth-child(1) > a.torrent-title-link'
const SIZE = 'td:nth-child(2) > div > span:nth-child(2)'
const SEEDERS = 'td:nth-child(5) > div > span:nth-child(2)'
const PEERS = 'td:nth-child(6) > div > span:nth-child(3)'
const UPLOAD_DATE = 'td:nth-child(4) > div > span:nth-child(2)'
const CATEGORY_SEL = 'td:nth-child(1) > div:nth-child(1) > div.related-posted > a:nth-child(2)'
const TORRENT_ID = 'td:nth-child(1) > div:nth-child(2) > a.search-magnet-btn'
const DETAILS_PAGE_URL = TORRENT_NAME

const CATEGORY_MAP: Record<string, number> = {
  [Category.Anime]: 7, [Category.Apps]: 5, [Category.Books]: 6,
  [Category.Games]: 4, [Category.Movies]: 1, [Category.Music]: 3,
  [Category.Other]: 8, [Category.Porn]: 10, [Category.Series]: 2,
}

export class Ext extends BaseProvider {
  id = 'extdotto'
  name = 'Ext'
  url = 'https://ext.to'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Other, Category.Porn, Category.Series]
  enabledByDefault = false
  isCloudflareProtected = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let requestUrl = `${this.url}/browse/?`
    const catId = CATEGORY_MAP[ctx.category]
    if (catId) requestUrl += `cat=${catId}&`
    requestUrl += `q=${query}`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, this.name)
  }
}

async function parseResults(html: string, pageUrl: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const sessionId = $(SESSION_ID).first().attr('content')
  const pageToken = extractSearchPageToken($)

  const items = $(LIST_ITEM).toArray()
  const results = await Promise.all(
    items.map(async (el) => {
      const $el = $(el)
      const torrentId = $el.find(TORRENT_ID).first().attr('data-id')
      if (!torrentId) return null
      const magnetUri = await getSearchMagnetUri(torrentId, sessionId ?? undefined, pageToken ?? undefined)
      if (!magnetUri) return null
      const infoHash = getInfoHashFromMagnetUri(magnetUri)

      const torrentName = $el.find(TORRENT_NAME).first().text().trim()
      if (!torrentName) return null
      const size = $el.find(SIZE).first().text().trim() || undefined
      const seedersText = $el.find(SEEDERS).first().text().trim()
      const peersText = $el.find(PEERS).first().text().trim()
      const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
      const peers = peersText ? parseInt(peersText) || undefined : undefined

      const dateText = $el.find(UPLOAD_DATE).first().attr('title') || ''
      let uploadDate: string | undefined
      if (dateText) {
        const d = dateParse(dateText, 'dd MMMM yyyy', new Date())
        if (isValid(d)) uploadDate = d.toISOString()
      }

      const catHref = $el.find(CATEGORY_SEL).first().attr('href') || ''
      const category = getCategoryFromRaw(catHref.replace(/^\//, '').replace(/\/$/, ''))
      const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

      return {
        infoHash, name: torrentName, size, seeders, peers,
        uploadDate, category, providerName,
        magnetUri, descriptionPageUrl: detailsPageUrl,
      } as Torrent
    })
  )
  return results.filter(Boolean) as Torrent[]
}

function extractSearchPageToken($: cheerio.CheerioAPI): string | null {
  const text = $('script')
    .toArray()
    .map(el => $(el).html()?.trim() || '')
    .filter(Boolean)
    .find(t => t.startsWith('window.searchPageToken'))
  if (!text) return null
  const match = text.match(/window\.searchPageToken\s*=\s*'([^']+)'/)
  return match ? match[1] : null
}

async function getSearchMagnetUri(torrentId: string, sessionId?: string, pageToken?: string): Promise<string | null> {
  if (!sessionId || !pageToken) return null
  const timestamp = Math.floor(Date.now() / 1000)
  const token = computeHash(torrentId, timestamp, pageToken)
  const response = await httpClient.submitForm('https://ext.to/ajax/getSearchMagnet.php', {
    torrent_id: torrentId,
    hash: '',
    name: '',
    timestamp: timestamp.toString(),
    hmac: token,
    sessid: sessionId,
  })
  if (!response) return null
  try { return JSON.parse(response).url } catch { return null }
}

function computeHash(torrentId: string, timestamp: number, pageToken: string): string {
  return createHash('sha256').update(`${torrentId}|${timestamp}|${pageToken}`).digest('hex')
}

async function parseDetails(html: string, providerName: string): Promise<TorrentDetails | null> {
  const $ = cheerio.load(html)
  const torrentId = $('a.detail-magnet-link.download-btn-magnet').first().attr('data-id')
  const sessionId = $(SESSION_ID).first().attr('content')
  if (!torrentId || !sessionId) return null

  const pageToken = extractDetailsPageToken($)
  if (!pageToken) return null

  const magnetUri = await getDetailsMagnetUri(torrentId, sessionId, pageToken)
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const torrentName = $('div.card-body .card-title').first().text().trim()
  if (!torrentName) return null

  const size = $('div.card-body .content-size').first().text().trim().replace(/^Size: /, '') || undefined
  const seedersText = $('div.card-body #seed-counter').first().text().trim()
  const peersText = $('div.card-body #leech-counter').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const dateText = $('div.detail-torrent-poster-info > span:nth-child(1)').first().attr('title') || ''
  let uploadDate: string | undefined
  if (dateText) {
    const d = dateParse(dateText, 'dd MMMM yyyy', new Date())
    if (isValid(d)) uploadDate = d.toISOString()
  }

  const catHref = $('div.detail-torrent-poster-info > a:nth-child(3)').first().attr('href') || ''
  const category = getCategoryFromRaw(catHref.replace(/^\//, '').replace(/\/$/, ''))
  const uploader = $('span.external-user').first().text().trim() || undefined

  const lastCheckedText = $('span.detail-update-date > strong').first().text().trim()
  const lastChecked = lastCheckedText ? parseDateString(lastCheckedText)?.toISOString() : undefined

  const posterUrlEl = $('div.poster-block > a > img').first().attr('abs:src')
    || $('img.detail-torrent-image').first().attr('abs:src')
  const posterUrl = posterUrlEl?.endsWith('no-torrent-image.png') ? undefined : posterUrlEl

  return {
    infoHash, name: torrentName, size, seeders, peers,
    uploadDate, category, uploader, lastChecked,
    magnetUri, posterUrl,
  }
}

async function getDetailsMagnetUri(torrentId: string, sessionId: string, pageToken: string): Promise<string | null> {
  const timestamp = Math.floor(Date.now() / 1000)
  const token = computeHash(torrentId, timestamp, pageToken)
  const response = await httpClient.submitForm('https://ext.to/ajax/getTorrentMagnet.php', {
    torrent_id: torrentId,
    download_type: 'magnet',
    timestamp: timestamp.toString(),
    hmac: token,
    sessid: sessionId,
  })
  if (!response) return null
  try { return JSON.parse(response).url } catch { return null }
}

function extractDetailsPageToken($: cheerio.CheerioAPI): string | null {
  const text = $('script')
    .toArray()
    .map(el => ($(el).html() || '').trim().split('\n')[0])
    .filter(Boolean)
    .find(t => t.startsWith('window.pageToken'))
  if (!text) return null
  const match = text.match(/window\.pageToken\s*=\s*'([^']+)'/)
  return match ? match[1] : null
}

function getCategoryFromRaw(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    'anime': Category.Anime, 'applications': Category.Apps, 'books': Category.Books,
    'games': Category.Games, 'movies': Category.Movies, 'music': Category.Music,
    'other': Category.Other, 'tv': Category.Series, 'xxx': Category.Porn,
  }
  return map[raw] || Category.Other
}
