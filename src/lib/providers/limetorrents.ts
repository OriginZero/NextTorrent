import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'

export class LimeTorrents extends BaseProvider {
  id = 'limetorrents'
  name = 'LimeTorrents'
  url = 'https://limetorrents.fun'
  supportedCategories = [Category.Anime, Category.Apps, Category.Games, Category.Movies, Category.Music, Category.Series, Category.Other]
  safetyStatus = { unsafe: 'LimeTorrents redirects to malicious websites' }
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const catStr = getCategorySearchString(ctx.category)
    const requestUrl = `${this.url}/search/${catStr}/${query}/date/1/`
    const html = await ctx.httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    if (!this.supportedCategories.includes(category)) return []
    const catStr = getCategoryBrowseString(category)
    const requestUrl = `${this.url}/browse-torrents/${catStr}/`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name, category)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    if (!this.supportedCategories.includes(category)) return []
    const catStr = getCategoryBrowseString(category)
    const requestUrl = `${this.url}/cat_top/16/${catStr}/`
    const html = await httpClient.get(requestUrl)
    return parseResults(html, requestUrl, this.name, category)
  }
}

function getCategorySearchString(category: Category): string {
  if (category === Category.All || category === Category.Books || category === Category.Porn) return 'all'
  if (category === Category.Anime) return 'anime'
  if (category === Category.Apps) return 'applications'
  if (category === Category.Games) return 'games'
  if (category === Category.Movies) return 'movies'
  if (category === Category.Music) return 'music'
  if (category === Category.Series) return 'tv'
  return 'other'
}

function getCategoryBrowseString(category: Category): string {
  if (category === Category.Anime) return 'Anime'
  if (category === Category.Apps) return 'Applications'
  if (category === Category.Books) return 'Other-E-books'
  if (category === Category.Games) return 'Games'
  if (category === Category.Movies) return 'Movies'
  if (category === Category.Music) return 'Music'
  if (category === Category.Series) return 'TV-shows'
  return 'Other'
}

function parseResults(html: string, pageUrl: string, providerName: string, searchCategory?: Category): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('.table2 > tbody > tr').each((_, el) => {
    const $el = $(el)
    const torrentName = $el.find('td:nth-child(1) > div.tt-name > a:nth-child(2)').text().trim()
    if (!torrentName) return
    const fileDownloadLink = $el.find('td:nth-child(1) > div.tt-name > a:nth-child(1)').attr('href') || ''
    if (!fileDownloadLink) return
    const infoHash = fileDownloadLink
      .replace('http://itorrents.net/torrent/', '')
      .split('.')[0]
      .toLowerCase()
    const size = $el.find('td:nth-child(3)').text().trim() || undefined
    const seedersStr = $el.find('td.tdseed').text().trim()
    const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
    const peersStr = $el.find('td.tdleech').text().trim()
    const peers = peersStr ? parseInt(peersStr) || undefined : undefined
    const rawText = $el.find('td:nth-child(2)').text().trim()
    const { uploadDate, category } = parseDateAndCategory(rawText, searchCategory)
    const detailsPageUrl = $el.find('td:nth-child(1) > div.tt-name > a:nth-child(2)').attr('abs:href') || undefined

    results.push({
      infoHash, name: torrentName, size, seeders, peers,
      providerName, uploadDate, category, descriptionPageUrl: detailsPageUrl, fileDownloadLink,
    })
  })
  return results
}

function parseDateAndCategory(text: string, fallbackCategory?: Category): { uploadDate?: string; category?: Category } {
  if (!text.includes('- in')) {
    const d = parseDateString(text.trim())
    return { uploadDate: d?.toISOString(), category: fallbackCategory }
  }
  const parts = text.split('-').map(s => s.trim())
  const rawDate = parts[0]
  const rawCat = (parts[1] || '').replace(/^in\s*/, '').replace(/\.$/, '').trim()
  const d = parseDateString(rawDate)
  return {
    uploadDate: d?.toISOString(),
    category: rawCat ? categoryFromRawString(rawCat) : fallbackCategory,
  }
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const infoHash = $('#content > div:nth-child(6) > div:nth-child(1) > div > table > tbody > tr:nth-child(1) > td:nth-child(2)').text().trim().toLowerCase()
  if (!infoHash) return null
  const magnetUri = $('a[href^="magnet:?"]').attr('href') || ''
  if (!magnetUri) return null
  const name = $('#content > h1').text().trim()
  if (!name) return null
  const size = $('#content > div:nth-child(6) > div:nth-child(1) > div > table > tbody > tr:nth-child(3) > td:nth-child(2)').text().trim() || undefined
  const seedersStr = $('#content > span.greenish').text().trim().replace('Seeders : ', '').trim()
  const seeders = seedersStr ? parseInt(seedersStr) || undefined : undefined
  const peersStr = $('#content > span.reddish').text().trim().replace('Leechers : ', '').trim()
  const peers = peersStr ? parseInt(peersStr) || undefined : undefined
  const uploadParts = ($('#content > div:nth-child(6) > div:nth-child(1) > div > table > tbody > tr:nth-child(2) > td:nth-child(2)').text().trim() || '').split('in')
  const rawDate = uploadParts[0]?.trim()
  const rawCat = uploadParts[1]?.replace(/\.$/, '').trim()
  const uploadDate = rawDate ? parseDateString(rawDate)?.toISOString() : undefined
  const category = rawCat ? categoryFromRawString(rawCat) : undefined
  const fileDownloadLink = $('#content > div:nth-child(6) > div:nth-child(1) > div > div:nth-child(7) > div > a').attr('href') || undefined

  return { infoHash, magnetUri, name, size, seeders, peers, uploadDate, category, fileDownloadLink }
}

function categoryFromRawString(raw: string): Category | undefined {
  if (raw === 'TV') return Category.Series
  if (raw === 'Movie') return Category.Movies
  if (raw === 'Music') return Category.Music
  if (raw === 'App') return Category.Apps
  if (raw === 'E-book') return Category.Books
  if (raw === 'Anime') return Category.Anime
  if (raw === 'Games') return Category.Games
  return Category.Other
}
