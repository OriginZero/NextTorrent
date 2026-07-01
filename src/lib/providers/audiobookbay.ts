import * as cheerio from 'cheerio'
import { parse as dateParse, isValid } from 'date-fns'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { createMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const LIST_ITEM = 'div.post'
const TORRENT_NAME = 'div.postTitle > h2 > a'
const TORRENT_INFO = 'div.postContent > p:nth-child(3)'
const DETAILS_PAGE_URL = TORRENT_NAME

export class AudioBookBay extends BaseProvider {
  id = 'audiobookbay'
  name = 'AudioBookBay'
  url = 'https://audiobookbay.lu'
  supportedCategories = [Category.Books]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/?s=${query}`)
    return parseResults(html, this.name)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(this.url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const items = $(LIST_ITEM).toArray()
  const results = await Promise.all(
    items.map(async (el) => {
      const $el = $(el)
      const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href')
      if (!detailsPageUrl) return null
      const infoHash = await getInfoHash(detailsPageUrl)
      if (!infoHash) return null

      const torrentName = $el.find(TORRENT_NAME).first().text().trim()
      if (!torrentName) return null

      const torrentInfo = $el.find(TORRENT_INFO).first().text().split('\n')

      const sizeLine = torrentInfo.find(l => l.startsWith('File Size: '))
      const size = sizeLine
        ?.substring('File Size: '.length)
        .trim()
        .replace(/s$/, '') || undefined

      const postedLine = torrentInfo.find(l => l.startsWith('Posted: '))
      const postedText = postedLine?.substring('Posted: '.length).trim()
      let uploadDate: string | undefined
      if (postedText) {
        const d = dateParse(postedText, 'd MMM yyyy', new Date())
        if (isValid(d)) uploadDate = d.toISOString()
      }

      return {
        infoHash, name: torrentName, size, uploadDate,
        category: Category.Books, providerName,
        descriptionPageUrl: detailsPageUrl,
      } as Torrent
    })
  )
  return results.filter(Boolean) as Torrent[]
}

async function getInfoHash(detailsPageUrl: string): Promise<string | null> {
  const html = await httpClient.get(detailsPageUrl)
  const $ = cheerio.load(html)
  const el = $('td').filter((_, td) => $(td).text().trim() === 'Info Hash:').first()
  return el.next('td').text().trim() || null
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const torrentName = $('div.postTitle > h1').first().text().trim()
  if (!torrentName) return null

  const infoHashTd = $('td').filter((_, td) => $(td).text().trim() === 'Info Hash:').first()
  const infoHash = infoHashTd.next('td').text().trim()
  if (!infoHash) return null

  const sizeTd = $('td').filter((_, td) => $(td).text().trim() === 'File Size:' || $(td).text().trim() === 'Combined File Size:').first()
  const size = sizeTd.next('td').text().trim().replace(/s$/, '') || undefined

  const dateTd = $('td').filter((_, td) => $(td).text().trim() === 'Creation Date:').first()
  const dateText = dateTd.next('td').text().trim()
  let uploadDate: string | undefined
  if (dateText) {
    const d = new Date(dateText)
    if (!isNaN(d.getTime())) uploadDate = d.toISOString()
  }

  const uploader = $('div.postContent > div:nth-child(1) > p:nth-child(1) > a').first().text().trim() || undefined
  const description = $('div.desc').first().html() || undefined
  const posterUrl = $('img[itemprop="image"]').first().attr('src') || undefined

  return {
    infoHash, name: torrentName, size, uploadDate,
    category: Category.Books, uploader,
    magnetUri: createMagnetUri(infoHash),
    description, posterUrl,
  }
}
