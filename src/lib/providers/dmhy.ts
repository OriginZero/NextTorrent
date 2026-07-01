import * as cheerio from 'cheerio'
import { parse as dateParse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { normalizeSize } from '../utils/filesize'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const LIST_ITEM = 'table#topic_list > tbody > tr'
const TORRENT_NAME = 'td.title > a'
const SIZE = 'td:nth-child(5)'
const SEEDERS = 'td:nth-child(6)'
const PEERS = 'td:nth-child(7)'
const UPLOAD_DATE = 'td:nth-child(1) > span'
const CATEGORY_SEL = 'td:nth-child(2) > a'
const MAGNET_URI = 'td:nth-child(4) > a:nth-child(1)'
const DETAILS_PAGE_URL = TORRENT_NAME

const CATEGORY_IDS: Record<string, number> = {
  [Category.All]: 0,
  [Category.Anime]: 2,
  [Category.Books]: 3,
  [Category.Games]: 9,
  [Category.Music]: 4,
  [Category.Series]: 6,
  [Category.Other]: 1,
}

export class Dmhy extends BaseProvider {
  id = 'dmhy'
  name = 'Dmhy'
  url = 'https://share.dmhy.org'
  supportedCategories = [Category.Anime, Category.Books, Category.Games, Category.Music, Category.Series, Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const categoryId = CATEGORY_IDS[ctx.category] ?? CATEGORY_IDS[Category.All]
    const requestUrl = `${this.url}/topics/list?keyword=${query}&sort_id=${categoryId}&team_id=0&order=date-desc`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const categoryId = CATEGORY_IDS[category] ?? CATEGORY_IDS[Category.All]
    const html = await httpClient.get(`${this.url}/topics/list/sort_id/${categoryId}`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    return this.getLatestTorrents(category)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $(LIST_ITEM).each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find(TORRENT_NAME).first().text().trim()
    if (!torrentName) return
    const magnetUri = $el.find(MAGNET_URI).first().attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = normalizeSize($el.find(SIZE).first().text().trim()) || undefined
    const seedersText = $el.find(SEEDERS).first().text().trim()
    const peersText = $el.find(PEERS).first().text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined

    const dateText = $el.find(UPLOAD_DATE).first().text().trim()
    let uploadDate: string | undefined
    if (dateText) {
      const d = dateParse(dateText, 'yyyy/MM/dd HH:mm', new Date())
      if (isValid(d)) uploadDate = d.toISOString()
    }

    const className = $el.find(CATEGORY_SEL).first().attr('class') || ''
    const catId = className.replace('sort-', '')
    const category = getCategoryFromId(catId)
    const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

    results.push({
      infoHash, name: torrentName, size, seeders, peers,
      uploadDate, category, providerName,
      magnetUri, descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('div.topic-title > h3').first().text().trim()
  if (!torrentName) return null
  const magnetUri = $('div#resource-tabs > div#tabs-1 > p:nth-child(2) > a#a_magnet').first().attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const sizeText = $('div.topic-title > div.info > ul > li:nth-child(6) > span').first().text().trim()
  const size = normalizeSize(sizeText) || undefined

  const dateText = $('div.topic-title > div.info > ul > li:nth-child(2) > span').first().text().trim()
  let uploadDate: string | undefined
  if (dateText) {
    const datePart = dateText.split(/\s/)[0]
    const d = dateParse(datePart, 'yyyy/MM/dd', new Date())
    if (isValid(d)) uploadDate = d.toISOString()
  }

  const catHref = $('div.topic-title > div.info > ul > li:nth-child(1) > span > a').first().attr('href') || ''
  const catId = catHref.replace('/topics/list/sort_id/', '')
  const category = getCategoryFromId(catId)

  const descEl = $('div.topic-nfo').first()
  descEl.find('> *:lt(2)').remove()
  const description = descEl.html() || undefined

  return { infoHash, name: torrentName, size, uploadDate, category, magnetUri, description }
}

function getCategoryFromId(id: string): Category | undefined {
  if (['2', '7', '31'].includes(id)) return Category.Anime
  if (id === '3') return Category.Books
  if (['41', '42'].includes(id)) return Category.Series
  if (['4', '43', '44', '15'].includes(id)) return Category.Music
  if (id === '6') return Category.Series
  if (['9', '17', '18', '19', '20', '21'].includes(id)) return Category.Games
  return Category.Other
}
