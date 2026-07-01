import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

const LIST_ITEM = 'div.one_result > div'
const TORRENT_NAME = 'div.torrent_name > a'
const SIZE = 'span.torrent_size'
const UPLOAD_DATE = 'span.torrent_age'
const MAGNET_URI = 'div.torrent_magnet > div.fa-magnet > a'
const DETAILS_PAGE_URL = TORRENT_NAME

export class BTDigg extends BaseProvider {
  id = 'btdigg'
  name = 'BTDigg'
  url = 'https://btdig.com'
  supportedCategories = [Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`https://btdig.com/search?q=${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html)
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
    const size = $el.find(SIZE).first().text().trim() || undefined
    const ageText = $el.find(UPLOAD_DATE).first().text().trim().replace(/^found /, '')
    const uploadDate = parseDateString(ageText)?.toISOString()
    const detailsPageUrl = $el.find(DETAILS_PAGE_URL).first().attr('abs:href') || undefined

    results.push({ infoHash, name: torrentName, size, uploadDate, descriptionPageUrl: detailsPageUrl, providerName })
  })
  return results
}

function parseDetails(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const nameTd = $('td').filter((_, td) => $(td).text().trim() === 'Name:').first()
  const torrentName = nameTd.next('td').text().trim()
  if (!torrentName) return null

  const magnetUri = $('a[href^="magnet:?xt="]').first().attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const sizeTd = $('td').filter((_, td) => $(td).text().trim() === 'Size:').first()
  const size = sizeTd.next('td').text().trim() || undefined

  const ageTd = $('td').filter((_, td) => $(td).text().trim() === 'Age:').first()
  const ageText = ageTd.next('td').text().trim()
  const uploadDate = ageText ? parseDateString(`${ageText} ago`)?.toISOString() : undefined

  return { infoHash, name: torrentName, size, uploadDate, magnetUri }
}
