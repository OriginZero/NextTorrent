import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { normalizeSize } from '../utils/filesize'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class TorrentDatabase extends BaseProvider {
  id = 'torrentdatabase'
  name = 'TorrentDatabase'
  url = 'https://developify.ca'
  supportedCategories = [Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series]
  isCloudflareProtected = true
  enabledByDefault = false

  private categoryMap: Record<string, string> = {
    [Category.Apps]: 'software', [Category.Books]: 'e-books',
    [Category.Games]: 'games', [Category.Movies]: 'movies',
    [Category.Music]: 'music', [Category.Porn]: 'porn', [Category.Series]: 'tv',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    let url = `${this.url}/newest?q=${query}`
    const cat = this.categoryMap[ctx.category]
    if (cat) url += `&category=${cat}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetailsPage(html)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    let url = `${this.url}/newest`
    if (category !== Category.All) {
      const cat = this.categoryMap[category]
      if (cat) {
        const slug = category === Category.Books ? cat.replace('-', '') : cat
        url += `_${slug}`
      }
    }
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    if (category === Category.All) return this.getLatestTorrents(category)
    const cat = this.categoryMap[category]
    if (!cat) return []
    const slug = category === Category.Books ? cat.replace('-', '') : cat
    const html = await httpClient.get(`${this.url}/top_seeded_${slug}`)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.torrent-table > tbody > tr').each((_, el) => {
    const $el = $(el)
    const nameEl = $el.find('td:nth-child(1) > a:nth-child(2)')
    const name = nameEl.first().text().trim()
    if (!name) return
    const href = nameEl.attr('href') || ''
    const infoHash = href.replace('/track/magnet/', '').split('?')[0]
    const magnetUri = `${createMagnetUri(infoHash)}&tr=https%3A%2F%2Fdevelopify.ca%2Fannounce`
    const descUrlEl = $el.find('td:nth-child(1) > a:nth-child(1)').attr('abs:href')
    const descriptionPageUrl = descUrlEl && descUrlEl.trim() ? descUrlEl : undefined
    const catText = $el.find('td:nth-child(2) > span.category-bubble').first().text().trim()
    const category = catText ? categoryFromRawString(catText) : undefined
    const size = $el.find('td.size-cell').first().text().trim() || undefined
    const dateRaw = $el.find('td.date-cell').first().text().trim()
    const uploadDate = dateRaw ? parseDateString(dateRaw)?.toISOString() : undefined
    const seedersText = $el.find('td:nth-child(5) > div > span:nth-child(1)').text().trim()
    const peersText = $el.find('td:nth-child(5) > div > span:nth-child(2)').text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined

    results.push({
      infoHash, name, size, seeders, peers,
      uploadDate, category, providerName,
      descriptionPageUrl, magnetUri,
    })
  })
  return results
}

function parseDetailsPage(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('div.torrent-detail-card > div.card-header.torrent-cat-header > h4').first().text().trim()
  if (!name) return null
  const magnetUri = $('#downloadMagnetBtn').attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const infoList = 'div.torrent-detail-card > div.card-body ul.torrent-info-list'
  const statsList = 'div.torrent-detail-card > div.card-body ul.torrent-stats-list'

  const sizeRaw = $(`${infoList} > li:nth-child(2) > strong.db-value`).first().text().trim()
  const size = sizeRaw ? normalizeSize(sizeRaw) : undefined

  const seedersText = $(`${statsList} > li:nth-child(1) > strong.text-success`).first().text().trim()
  const peersText = $(`${statsList} > li:nth-child(2) > strong.text-danger`).first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined

  const dateRaw = $(`${infoList} > li:nth-child(3) > strong.db-value`).first().text().trim()
  let uploadDate: string | undefined
  if (dateRaw) {
    const d = parseDateString(dateRaw)
    if (d) uploadDate = d.toISOString()
  }

  const catText = $('.cat-badge').first().text().trim()
  const category = catText ? categoryFromRawString(catText) : undefined

  const uploader = $(`${infoList} > li:nth-child(4) > a`).first().text().trim() || undefined

  const checkedRaw = $(`${infoList} li:nth-child(5) > strong.db-value`).first().text().trim()
  let lastChecked: string | undefined
  if (checkedRaw) {
    const d = parseDateString(checkedRaw)
    if (d) lastChecked = d.toISOString()
  }

  const description = $('div.torrent-info-card > div.torrent-info-content').html() || undefined

  return {
    infoHash, name, size, seeders, peers,
    uploadDate, category, uploader, lastChecked,
    magnetUri, description,
  }
}

function categoryFromRawString(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    Software: Category.Apps, 'E-Books': Category.Books, AudioBooks: Category.Books,
    Games: Category.Games, Movies: Category.Movies, Music: Category.Music,
    Porn: Category.Porn, TV: Category.Series,
  }
  return map[raw] || Category.Other
}
