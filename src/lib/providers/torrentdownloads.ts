import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

export class TorrentDownloads extends BaseProvider {
  id = 'torrentdownloads'
  name = 'TorrentDownloads'
  url = 'https://torrentdownloads.pro'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Series, Category.Other]
  cloudflareSolverUrl = 'https://torrentdownloads.pro/search/?s_cat=0&search=ubuntu'
  isCloudflareProtected = true
  enabledByDefault = true

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const url = `${this.url}/search/?s_cat=${getCategoryId(ctx.category)}&search=${query}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const path = latestCategoryPath(category)
    const url = path ? `${this.url}/view/today/${path}.html` : `${this.url}/most-active`
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const path = topCategoryPath(category)
    const url = path ? `${this.url}/view/popular/${path}.html` : `${this.url}/most-seeded`
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }
}

function latestCategoryPath(category: Category): string | undefined {
  return ({ 'Anime': 'Anime', 'Apps': 'Software', 'Books': 'Books', 'Games': 'Games', 'Movies': 'Movies', 'Music': 'Music', 'Series': 'TV_Shows', 'Other': 'Other' } as Record<string, string | undefined>)[category]
}

function topCategoryPath(category: Category): string | undefined {
  return latestCategoryPath(category)
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $('div.inner_container').last().find('div.grey_bar3').slice(2).toArray()
  const results = await Promise.all(items.map(el => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: cheerio.Cheerio<any>, providerName: string): Promise<Torrent | null> {
  const detailsUrl = $el.find('p:nth-child(1) > a:nth-child(2)').attr('abs:href')
  if (!detailsUrl) return null
  const detailsHtml = await httpClient.get(detailsUrl)
  const details = parseDetails(detailsHtml, detailsUrl)
  if (!details) return null
  const size = details.size || $el.find('span:nth-child(5)').text().trim() || undefined
  const seeders = details.seeders ?? (parseInt($el.find('span:nth-child(4)').text().trim()) || undefined)
  const peers = details.peers ?? (parseInt($el.find('span:nth-child(3)').text().trim()) || undefined)
  const category = details.category || getCategoryFromIcon($el.find('p:nth-child(1) > img:nth-child(1)').attr('src') || '')
  return { infoHash: details.infoHash, name: details.name, size, seeders, peers, providerName, uploadDate: details.uploadDate, category, descriptionPageUrl: detailsUrl, magnetUri: details.magnetUri }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('div.inner_container > h1.titl_1 > span').text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = $('div.inner_container > div:nth-child(13) > p').text().trim() || undefined
  const seedersText = $('div.inner_container > div:nth-child(15) > p').text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peersText = $('div.inner_container > div:nth-child(16) > p').text().trim()
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const uploadDateText = $('div.inner_container > div:nth-child(19) > p').text().trim()
  const uploadDate = uploadDateText ? parseDateString(uploadDateText)?.toISOString() : undefined
  const lastCheckedText = $('div.inner_container > div:nth-child(18) > p').text().trim().replace(/ \(\)$/, '')
  const lastChecked = lastCheckedText ? parseDateString(lastCheckedText)?.toISOString() : undefined
  const category = getCategoryFromIcon($('div.inner_container > h1:nth-child(1) > img').attr('src') || '')
  const fileDownloadLink = $('u.download > li:nth-child(2) > a').attr('abs:href')
  return { infoHash, name, size, seeders, peers, uploadDate, category, lastChecked, magnetUri, fileDownloadLink }
}

function getCategoryId(category: Category): number {
  return ({ 'All': 0, 'Anime': 1, 'Books': 2, 'Games': 3, 'Movies': 4, 'Music': 5, 'Apps': 7, 'Series': 8, 'Other': 9, 'Porn': 9 } as Record<string, number>)[category] ?? 0
}

function getCategoryFromIcon(url: string): Category | undefined {
  const icon = url.replace('/templates/new/images/icons/', '')
  return ({ 'menu_icon1.png': Category.Anime, 'menu_icon2.png': Category.Books, 'menu_icon3.png': Category.Games, 'menu_icon4.png': Category.Movies, 'menu_icon5.png': Category.Music, 'menu_icon7.png': Category.Apps, 'menu_icon8.png': Category.Series, 'menu_icon9.png': Category.Other } as Record<string, Category>)[icon] ?? Category.Other
}
