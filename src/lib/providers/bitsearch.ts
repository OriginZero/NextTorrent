import * as cheerio from 'cheerio'
import { parse as dateParse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, SearchContext, Category } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const LIST_ITEM = 'div.space-y-4 > div > div:nth-child(1)'
const TORRENT_INFO = '> div:nth-child(1)'
const DOWNLOAD_LINKS = '> div:nth-child(2)'
const CATEGORY_AND_METADATA = `${TORRENT_INFO} > div:nth-last-child(2)`
const SWARM_STATS = `${TORRENT_INFO} > div:nth-last-child(1)`
const TORRENT_NAME = `${TORRENT_INFO} h3`
const SIZE = `${CATEGORY_AND_METADATA} > span:nth-child(2) > span`
const SEEDERS = `${SWARM_STATS} > span:nth-child(1) > span:nth-child(2)`
const PEERS = `${SWARM_STATS} > span:nth-child(2) > span:nth-child(2)`
const UPLOAD_DATE = `${CATEGORY_AND_METADATA} > span:nth-child(3) > span`
const CATEGORY_SEL = `${CATEGORY_AND_METADATA} > span:nth-child(1) > span`
const MAGNET_LINK = `${DOWNLOAD_LINKS} > a:nth-child(2)`
const FILE_DOWNLOAD_LINK = `${DOWNLOAD_LINKS} > a:nth-child(1)`
const DETAILS_PAGE_URL = `${TORRENT_NAME} > a`

const CATEGORY_IDS: Record<string, number | null> = {
  [Category.All]: null,
  [Category.Anime]: 4,
  [Category.Apps]: 5,
  [Category.Books]: 9,
  [Category.Games]: 6,
  [Category.Movies]: 2,
  [Category.Music]: 7,
  [Category.Porn]: 10,
  [Category.Series]: 3,
  [Category.Other]: 1,
}

export class BitSearch extends BaseProvider {
  id = 'bitsearch'
  name = 'BitSearch'
  url = 'https://bitsearch.to'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series, Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const categoryId = CATEGORY_IDS[ctx.category]
    const searches = [1, 2, 3, 4, 5].map(page =>
      this.searchPage(query, categoryId, ctx.httpClient, page)
    )
    const results = await Promise.all(searches)
    return results.flat()
  }

  private async searchPage(query: string, categoryId: number | null, http: typeof httpClient, page: number): Promise<Torrent[]> {
    let url = `${this.url}/search?q=${query}&page=${page}&sortBy=seeders`
    if (categoryId != null) url += `&category=${categoryId}`
    const html = await http.get(url)
    return parseResults(html, url, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/latest`
    const catId = CATEGORY_IDS[category]
    if (catId != null) url += `?category=${catId}`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/trending`
    const catId = CATEGORY_IDS[category]
    if (catId != null) url += `?category=${catId}`
    const html = await httpClient.get(url)
    return parseResults(html, url, this.name)
  }
}

function parseResults(html: string, pageUrl: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $(LIST_ITEM).each((_, el) => {
    const $el = $(el)
    const name = $el.find(TORRENT_NAME).first().text().trim()
    if (!name) return
    const magnetUri = $el.find(MAGNET_LINK).first().attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)

    const size = $el.find(SIZE).first().text().trim() || undefined
    const seedersText = $el.find(SEEDERS).first().text().trim()
    const peersText = $el.find(PEERS).first().text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined

    const dateText = $el.find(UPLOAD_DATE).first().text().trim()
    let uploadDate: string | undefined
    if (dateText) {
      const d = dateParse(dateText, 'M/d/yyyy', new Date())
      if (isValid(d)) {
        uploadDate = d.toISOString()
      } else {
        uploadDate = parseDateString(dateText)?.toISOString()
      }
    }

    const catText = $el.find(CATEGORY_SEL).first().text().trim()
    const category = catText ? categoryFromRawString(catText) : undefined
    const fileDownloadLink = $el.find(FILE_DOWNLOAD_LINK).first().attr('abs:href') || undefined
    const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

    results.push({
      infoHash, name, size, seeders, peers,
      providerName, uploadDate, category,
      magnetUri, fileDownloadLink,
      descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const nameEl = $('h1').first()
  const name = nameEl.text().trim()
  if (!name) return null
  const magnetUri = $('a[href^="magnet:?"]').first().attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const size = $('div.font-bold.text-white').eq(2).text().trim() || undefined
  const seedersText = $('div.font-bold.text-white').first().text().trim()
  const peersText = $('div.font-bold.text-white').eq(1).text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const dateText = $('div.text-sm.font-bold.text-gray-900').first().text().trim()
  let uploadDate: string | undefined
  if (dateText) {
    const d = dateParse(dateText, 'M/d/yyyy', new Date())
    if (isValid(d)) uploadDate = d.toISOString()
  }

  const lastCheckedText = $('div.text-sm.font-bold.text-gray-900').eq(1).text().trim()
  let lastChecked: string | undefined
  if (lastCheckedText) {
    const d = dateParse(lastCheckedText, 'M/d/yyyy', new Date())
    if (isValid(d)) lastChecked = d.toISOString()
  }

  const catText = $('span.inline-flex.items-center').first().text().trim()
  const category = catText ? categoryFromRawString(catText) : undefined
  const fileDownloadLink = $('a[href^="/download/torrent/"]').first().attr('abs:href') || undefined

  return { infoHash, name, size, seeders, peers, uploadDate, category, lastChecked, magnetUri, fileDownloadLink }
}

function categoryFromRawString(raw: string): Category | undefined {
  if (raw.startsWith('Movies')) return Category.Movies
  if (raw === 'TV') return Category.Series
  if (raw.startsWith('Anime')) return Category.Anime
  if (raw.startsWith('Softwares')) return Category.Apps
  if (raw.startsWith('Games')) return Category.Games
  if (raw.startsWith('Music')) return Category.Music
  if (raw === 'AudioBook' || raw.startsWith('Ebook')) return Category.Books
  if (raw === 'XXX') return Category.Porn
  if (raw.startsWith('Other')) return Category.Other
  return Category.Other
}
