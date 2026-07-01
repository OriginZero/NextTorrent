import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { httpClient } from '../http-client'
import { getInfoHashFromMagnetUri } from '../utils/torrent'

export class XXXClub extends BaseProvider {
  id = 'xxxclub'
  name = 'XXXClub'
  url = 'https://xxxclub.to'
  supportedCategories = [Category.Porn]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const html = await ctx.httpClient.get(`${this.url}/torrents/search/all/${query}`)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/torrents/browse/all`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/torrents/top100`)
    return parseResults(html, this.name)
  }
}

async function parseResults(html: string, providerName: string): Promise<Torrent[]> {
  const $ = cheerio.load(html)
  const container = $('div.browsetableinside, div.divtableinside').first()
  const items = container.find('ul > li').toArray()
  const results = await Promise.all(items.map(el => parseListItem($(el), providerName)))
  return results.filter(Boolean) as Torrent[]
}

async function parseListItem($el: cheerio.Cheerio<any>, providerName: string): Promise<Torrent | null> {
  const detailsUrl = $el.find('span:nth-child(2) > a[href^="/torrents/details"]').attr('abs:href')
  if (!detailsUrl) return null
  const detailsHtml = await httpClient.get(detailsUrl)
  const details = parseDetails(detailsHtml, detailsUrl)
  if (!details) return null
  const name = $el.find('span:nth-child(2) > a[href^="/torrents/details"]').text().trim() || details.name
  const size = $el.find('span.siz').text().trim() || details.size
  const seeders = parseInt($el.find('span.see').text().trim()) || details.seeders
  const peers = parseInt($el.find('span.lee').text().trim()) || details.peers
  const dateText = $el.find('span.adde').text().trim()
  const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : details.uploadDate
  return { infoHash: details.infoHash, name, size: size || undefined, seeders: seeders || undefined, peers: peers || undefined, providerName, uploadDate: uploadDate || undefined, category: Category.Porn, descriptionPageUrl: detailsUrl, magnetUri: details.magnetUri, fileDownloadLink: details.fileDownloadLink }
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('body > div > div.middle > div.main-content > div > h1').text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)
  const size = $('div.detailsdescr > ul > li:nth-child(2) > span:nth-child(3)').text().trim() || undefined
  const seedersText = $('div.detailsdescr font.see').text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peersText = $('div.detailsdescr font.lee').text().trim()
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const dateText = $('div.detailsdescr > ul > li:nth-child(3) > span:nth-child(3)').text().trim()
  const uploadDate = dateText ? parseDateString(dateText)?.toISOString() : undefined
  const uploader = $('div.detailsdescr > ul > li:nth-child(6) > span:nth-child(3)').text().trim() || undefined
  const lastCheckedText = $('div.detailsdescr > ul > li:nth-child(5) > span:nth-child(3)').text().trim()
  const lastChecked = lastCheckedText ? parseDateString(lastCheckedText)?.toISOString() : undefined
  const fileDownloadLink = $('div.detailsdescr > ul > li.downloadboxlist > span:nth-child(1) > a').attr('abs:href')
  const description = $('div.description').html() || undefined
  const posterUrl = $('img.detailsposter').attr('src')
  return { infoHash, name, size, seeders, peers, uploadDate, category: Category.Porn, uploader, lastChecked, magnetUri, fileDownloadLink, description, posterUrl }
}
