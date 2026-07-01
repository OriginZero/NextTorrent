import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { httpClient } from '../http-client'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri, createMagnetUri } from '../utils/torrent'

export class Nyaa extends BaseProvider {
  id = 'nyaasi'
  name = 'Nyaa'
  url = 'https://nyaa.si'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Music, Category.Series]
  enabledByDefault = true

  private categoryMap: Record<string, string> = {
    All: '0_0', Anime: '1_0', Apps: '6_1', Books: '3_0',
    Games: '6_2', Music: '2_0', Series: '4_0',
  }

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const cat = this.categoryMap[ctx.category] ?? this.categoryMap['All']
    const html = await ctx.httpClient.get(`${this.url}/?f=0&c=${cat}&q=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const cat = this.categoryMap[category] ?? this.categoryMap['All']
    const html = await httpClient.get(`${this.url}?c=${cat}`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const cat = this.categoryMap[category] ?? this.categoryMap['All']
    const html = await httpClient.get(`${this.url}?s=seeders&o=desc&c=${cat}`)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.torrent-list > tbody > tr').each((_, el) => {
    const $el = $(el)
    const name = $el.find('td:nth-child(2) > a:not(.comments)').text().trim()
    if (!name) return
    const magnetHref = $el.find('td:nth-child(3) > a:nth-child(2)').attr('href') || ''
    const infoHash = getInfoHashFromMagnetUri(magnetHref)
    if (!infoHash) return
    const size = $el.find('td:nth-child(4)').text().trim() || undefined
    const ts = $el.find('td:nth-child(5)').attr('data-timestamp')
    const uploadDate = ts ? new Date(parseInt(ts) * 1000).toISOString() : undefined
    const seeders = parseInt($el.find('td:nth-child(6)').text().trim()) || undefined
    const peers = parseInt($el.find('td:nth-child(7)').text().trim()) || undefined
    const catHref = $el.find('td:nth-child(1) > a').attr('href') || ''
    const category = categoryFromId(catHref.replace('/?c=', ''))
    const detailsUrl = $el.find('td:nth-child(2) > a:not(.comments)').attr('abs:href') || undefined
    const fileLink = $el.find('td:nth-child(3) > a:nth-child(1)').attr('abs:href') || undefined

    results.push({
      infoHash, name, size, seeders, peers,
      providerName, uploadDate, category,
      magnetUri: magnetHref || undefined,
      descriptionPageUrl: detailsUrl,
      fileDownloadLink: fileLink,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('.container > div:nth-child(1) > div.panel-heading > h3').text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:"]`).attr('href') || ''
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const panelBody = '.container > div:nth-child(1) > div.panel-body'
  const size = $(`${panelBody} > div:nth-child(4) > div:nth-child(2)`).text().trim() || undefined
  const seeders = parseInt($(`${panelBody} > div:nth-child(2) > div:nth-child(4)`).text().trim()) || undefined
  const peers = parseInt($(`${panelBody} > div:nth-child(3) > div:nth-child(4)`).text().trim()) || undefined
  const ts = $(`${panelBody} > div:nth-child(1) > div:nth-child(4)`).attr('data-timestamp')
  const uploadDate = ts ? new Date(parseInt(ts) * 1000).toISOString() : undefined
  const uploader = $(`${panelBody} > div:nth-child(2) > div:nth-child(2)`).text().trim() || undefined
  const description = $('#torrent-description').html() || undefined
  const fileLink = $(`a[href^="/download"]`).attr('abs:href') || undefined

  return { infoHash, name, size, seeders, peers, uploadDate, uploader, magnetUri, fileDownloadLink: fileLink, description }
}

function categoryFromId(id: string): Category | undefined {
  if (/^1_\d$/.test(id)) return Category.Anime
  if (/^2_\d$/.test(id)) return Category.Music
  if (/^3_\d$/.test(id)) return Category.Books
  if (/^4_\d$/.test(id)) return Category.Series
  if (id === '6_2') return Category.Games
  if (/^6_\d$/.test(id)) return Category.Apps
  if (/^5_\d$/.test(id)) return Category.Other
  return Category.Other
}
