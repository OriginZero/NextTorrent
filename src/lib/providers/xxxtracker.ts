import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

const MONTH_MAP: Record<string, string> = { 'Янв': 'Jan', 'Фев': 'Feb', 'Мар': 'Mar', 'Апр': 'Apr', 'Май': 'May', 'Июн': 'Jun', 'Июл': 'Jul', 'Авг': 'Aug', 'Сен': 'Sep', 'Окт': 'Oct', 'Ноя': 'Nov', 'Дек': 'Dec' }

function normalizeUploadDate(uploadDate: string): string {
  const [day, russianMonth, year] = uploadDate.split(' ')
  return `${day} ${MONTH_MAP[russianMonth]} ${year}`
}

export class XXXTracker extends BaseProvider {
  id = 'xxxtracker'
  name = 'XXXTracker'
  url = 'https://xxxtor.com'
  supportedCategories = [Category.Porn]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/b.php?search=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/b.php`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/top`)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table > tbody > tr').slice(1).each((_, el) => {
    const $el = $(el)
    const name = $el.find('td:nth-child(2) > a:nth-child(3)').text().trim()
    if (!name) return
    const magnetUri = $el.find('td:nth-child(2) > a:nth-child(1)').attr('href')
    if (!magnetUri) return
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = $el.find('td:nth-child(3)').text().trim() || undefined
    const seedersText = $el.find('td:nth-child(4) > span:nth-child(1)').text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peersText = $el.find('td:nth-child(4) > span:nth-child(2)').text().trim()
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const dateText = $el.find('td:nth-child(1)').text().trim()
    const uploadDate = dateText ? parseDateString(normalizeUploadDate(dateText))?.toISOString() : undefined
    const fileDownloadLink = $el.find('td:nth-child(2) > a:nth-child(2)').attr('abs:href')
    const detailsUrl = $el.find('td:nth-child(2) > a:nth-child(3)').attr('abs:href')
    results.push({ infoHash, name, size, seeders, peers, uploadDate, category: Category.Porn, descriptionPageUrl: detailsUrl, providerName, magnetUri, fileDownloadLink })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('#content > h1').text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const sizeText = $('#details > tbody > tr:nth-last-child(2) > td:nth-child(2)').text().trim()
  const size = sizeText.split('(')[0].trim() || undefined
  const seedersText = $('#details > tbody > tr:nth-last-child(7) > td:nth-child(2)').text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peersText = $('#details > tbody > tr:nth-last-child(6) > td:nth-child(2)').text().trim()
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const dateText = $('#details > tbody > tr:nth-last-child(3) > td:nth-child(2)').text().trim().split(/\s+/)[0].trim()
  const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
  const fileDownloadLink = $('#download > a:nth-child(1)').attr('abs:href')
  const posterUrl = $('#details > tbody > tr:nth-child(1) > td:nth-child(2) > img').attr('src')
  const $desc = $('#details > tbody > tr:nth-child(1) > td:nth-child(2)')
  $desc.find('> *:lt(3)').remove()
  const description = $desc.html() || undefined
  return { infoHash, name, size, seeders, peers, uploadDate, category: Category.Porn, magnetUri, fileDownloadLink, description, posterUrl }
}
