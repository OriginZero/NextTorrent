import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class Sukebei extends BaseProvider {
  id = 'sukebeinyaa'
  name = 'Sukebei'
  url = 'https://sukebei.nyaa.si'
  supportedCategories = [Category.Porn]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const url = `${this.url}/?f=0&c=0_0&q=${query}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetails(html, detailsPageUrl)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(this.url)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const url = `${this.url}/?s=seeders&o=desc`
    const html = await httpClient.get(url)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  const results: Torrent[] = []
  $('table.torrent-list > tbody > tr').each((_, el) => {
    const $el = $(el)
    const name = $el.find('td:nth-child(2) > a:not(.comments)').first().text().trim()
    if (!name) return
    const magnetUri = $el.find('td:nth-child(3) > a:nth-child(2)').attr('href')
    if (!magnetUri) return
    const fileDownloadLink = $el.find('td:nth-child(3) > a:nth-child(1)').attr('abs:href')
    const infoHash = getInfoHashFromMagnetUri(magnetUri)
    const size = $el.find('td:nth-child(4)').first().text().trim() || undefined
    const ts = $el.find('td:nth-child(5)').attr('data-timestamp')
    const uploadDate = ts ? new Date(parseInt(ts) * 1000).toISOString() : undefined
    const seedersText = $el.find('td:nth-child(6)').text().trim()
    const peersText = $el.find('td:nth-child(7)').text().trim()
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const detailsPageUrl = $el.find('td:nth-child(2) > a:not(.comments)').attr('abs:href')

    results.push({
      infoHash, name, size, seeders, peers,
      providerName, uploadDate,
      category: Category.Porn,
      descriptionPageUrl: detailsPageUrl,
      magnetUri, fileDownloadLink,
    })
  })
  return results
}

function parseDetails(html: string, pageUrl: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const name = $('div.container > div.panel > div.panel-heading > h3').first().text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:"]`).attr('href')
  if (!magnetUri) return null
  const panelBody = 'div.container > div.panel > div.panel-body'
  const size = $(`${panelBody} > div:nth-child(4) > div:nth-child(2)`).text().trim() || undefined
  const seedersText = $(`${panelBody} > div:nth-child(2) > div:nth-child(4)`).text().trim()
  const peersText = $(`${panelBody} > div:nth-child(3) > div:nth-child(4)`).text().trim()
  const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
  const peers = peersText ? parseInt(peersText) || undefined : undefined
  const ts = $(`${panelBody} > div:nth-child(1) > div:nth-child(4)`).attr('data-timestamp')
  const uploadDate = ts ? new Date(parseInt(ts) * 1000).toISOString() : undefined
  const uploader = $(`${panelBody} > div:nth-child(2) > div:nth-child(2)`).text().trim() || undefined
  const fileDownloadLink = $(`a[href^="/download"]`).attr('abs:href')
  const description = $('#torrent-description').html() || undefined

  return {
    infoHash: getInfoHashFromMagnetUri(magnetUri),
    name, size, seeders, peers, uploadDate,
    category: Category.Porn, uploader, magnetUri,
    fileDownloadLink, description,
  }
}
