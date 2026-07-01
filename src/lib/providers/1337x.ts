import * as cheerio from 'cheerio'
import { parse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class ThirteenThirtySevenX extends BaseProvider {
  id = '1337x'
  name = '1337x'
  url = 'https://1337x.to'
  supportedCategories = [Category.Anime, Category.Apps, Category.Games, Category.Movies, Category.Music, Category.Other, Category.Porn, Category.Series]
  isCloudflareProtected = true
  enabledByDefault = false

  private categoryMap: Record<string, string> = {
    [Category.Anime]: 'Anime', [Category.Apps]: 'Apps', [Category.Games]: 'Games',
    [Category.Movies]: 'Movies', [Category.Music]: 'Music', [Category.Other]: 'Other',
    [Category.Porn]: 'XXX', [Category.Series]: 'TV',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const url = ctx.category === Category.All
      ? `${this.url}/search/${query}/1/`
      : `${this.url}/category-search/${query}/${this.categoryMap[ctx.category]!}/1/`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/top-100`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetailsPage(html, detailsPageUrl)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('table.table-list > tbody > tr').toArray()
  const results = await Promise.all(items.map(async (el) => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: any, providerName: string): Promise<Torrent | null> {
  const detailsPageUrl = $el.find('td.name > a:nth-child(2)').attr('abs:href')
  if (!detailsPageUrl) return null
  const html = await httpClient.get(detailsPageUrl)
  const details = parseDetailsPage(html, detailsPageUrl)
  if (!details) return null

  const name = $el.find('td.name > a:nth-child(2)').first().text().trim()
  if (!name) return null
  const size = ($el.find('td.size').first().text().trim() || '').replace(/,/g, '') || undefined
  const seedersText = $el.find('td.seeds').first().text().trim()
  const peersText = $el.find('td.leeches').first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const uploadDate = parseDate($el.find('td.coll-date').first().text().trim())

  const catHref = $el.find('td.name > a:nth-child(1)').attr('href') || ''
  const catId = catHref.replace('/sub/', '').split('/')[0]
  const category = getCategoryFromId(catId)

  return {
    infoHash: details.infoHash,
    name, size, seeders, peers,
    uploadDate,
    providerName, category,
    descriptionPageUrl: detailsPageUrl,
    magnetUri: details.magnetUri,
    fileDownloadLink: details.fileDownloadLink,
  }
}

function parseDetailsPage(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const container = 'div.box-info.torrent-detail-page'
  const torrentName = $(`${container} > div.box-info-heading > h1`).first().text().trim()
  if (!torrentName) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null

  const col1 = `${container} > div:nth-child(2) > div:nth-child(1) > ul:nth-child(2)`
  const col2 = `${container} > div:nth-child(2) > div:nth-child(1) > ul:nth-child(3)`

  const size = ($(`${col1} > li:nth-child(4) > span`).first().text().trim() || '').replace(/,/g, '') || undefined
  const seedersText = $(`${col2} > li:nth-child(4) > span`).first().text().trim()
  const peersText = $(`${col2} > li:nth-child(5) > span`).first().text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const uploadDate = parseDate($(`${col2} > li:nth-child(3) > span`).first().text().trim())
  const catText = $(`${col1} > li:nth-child(1) > span`).first().text().trim()
  const category = getCategoryFromString(catText)
  const uploader = $(`${col1} > li:nth-child(5) > span`).first().text().trim() || undefined
  const lastChecked = parseDate($(`${col2} > li:nth-child(2) > span`).first().text().trim())
  const fileDownloadLink = $(`a[href^="https://itorrents.org"]`).attr('abs:href')
  const description = $('#description').html() || undefined
  const posterUrl = $('div.torrent-image > img').attr('abs:src')

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name: torrentName, size, seeders, peers,
    uploadDate, category, uploader, lastChecked,
    magnetUri, fileDownloadLink, description, posterUrl,
  }
}

function parseDate(date: string): string | undefined {
  const normalizedDate = date
    .replace(/(\d+)(st|nd|rd|th)/g, '$1')
    .replace(/(\d)(am|pm)\b/gi, '$1 $2')
    .replace(/\./g, '')
    .replace(/'/g, '')

  const d1 = parse(normalizedDate, 'MMM d yy', new Date())
  if (isValid(d1)) return d1.toISOString()

  const currentYear = new Date().getFullYear()
  const d2 = parse(`${normalizedDate} ${currentYear}`, 'h a MMM d yyyy', new Date())
  if (isValid(d2)) return d2.toISOString()

  const timeMatch = normalizedDate.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2] || '0')
    if (timeMatch[3].toLowerCase() === 'pm' && hours !== 12) hours += 12
    if (timeMatch[3].toLowerCase() === 'am' && hours === 12) hours = 0
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
  }

  return undefined
}

function getCategoryFromId(id: string): Category | undefined {
  if (['28', '78', '79', '80', '81'].includes(id)) return Category.Anime
  if (['22', '23', '24', '25', '26', '27', '53', '58', '59', '60', '68', '69'].includes(id)) return Category.Music
  if (['1', '2', '3', '4', '42', '54', '55', '66', '70', '73', '76'].includes(id)) return Category.Movies
  if (['5', '6', '7', '41', '71', '74', '75', '9'].includes(id)) return Category.Series
  if (['18', '19', '20', '21', '56', '57'].includes(id)) return Category.Apps
  if (['10', '11', '12', '13', '14', '15', '16', '17', '43', '44', '45', '46', '72', '77', '82'].includes(id)) return Category.Games
  if (['48', '49', '50', '51', '67'].includes(id)) return Category.Porn
  if (['33', '34', '35', '36', '37', '38', '39', '40', '47', '52'].includes(id)) return Category.Other
  return Category.Other
}

function getCategoryFromString(raw: string): Category | undefined {
  const map: Record<string, Category> = {
    Anime: Category.Anime, Apps: Category.Apps, Games: Category.Games,
    Movies: Category.Movies, Music: Category.Music, Other: Category.Other,
    XXX: Category.Porn, TV: Category.Series, Documentaries: Category.Series,
  }
  return map[raw] || Category.Other
}
