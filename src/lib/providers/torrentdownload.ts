import * as cheerio from 'cheerio'
import { Torrent, TorrentDetails, Category, SearchContext } from '../types'
import { BaseProvider } from './base'
import { parseDateString } from '../utils/date'
import { getInfoHashFromMagnetUri } from '../utils/torrent'
import { httpClient } from '../http-client'

export class TorrentDownload extends BaseProvider {
  id = 'torrentdownloadinfo'
  name = 'TorrentDownload'
  url = 'https://torrentdownload.info'
  supportedCategories = [Category.Anime, Category.Apps, Category.Books, Category.Games, Category.Movies, Category.Music, Category.Porn, Category.Series, Category.Other]
  enabledByDefault = false

  async search(query: string, ctx: SearchContext): Promise<Torrent[]> {
    const url = `${this.url}/search?q=${query}`
    const html = await ctx.httpClient.get(url)
    return parseResults(html, this.name)
  }

  async getDetails(detailsPageUrl: string): Promise<TorrentDetails | null> {
    const html = await httpClient.get(detailsPageUrl)
    return parseDetailsPage(html)
  }

  async getLatestTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/latest`)
    return parseResults(html, this.name)
  }

  async getTopTorrents(category: Category): Promise<Torrent[]> {
    const html = await httpClient.get(`${this.url}/top`)
    return parseResults(html, this.name)
  }
}

function parseResults(html: string, providerName: string): Torrent[] {
  const $ = cheerio.load(html)
  if ($('h2').first().text().trim() === 'No Results Found') return []

  const results: Torrent[] = []
  $('div.wrapper > table.table2:last-of-type > tbody > tr').each((_, el) => {
    const $el = $(el)
    const name = $el.find('td:nth-child(1) > div.tt-name > a').first().text().trim()
    if (!name) return
    const detailsPageUrl = $el.find('td:nth-child(1) > div.tt-name > a').attr('abs:href')
    if (!detailsPageUrl) return
    const parts = detailsPageUrl.replace(/\/+$/, '').split('/')
    const infoHash = parts[parts.length - 2]?.toLowerCase()
    if (!infoHash) return
    const size = $el.find('td:nth-child(3)').first().text().trim() || undefined
    const seedersText = ($el.find('td:nth-child(4)').first().text().trim() || '').replace(/,/g, '')
    const peersText = ($el.find('td:nth-child(5)').first().text().trim() || '').replace(/,/g, '')
    const seeders = seedersText ? parseInt(seedersText) || undefined : undefined
    const peers = peersText ? parseInt(peersText) || undefined : undefined
    const dateRaw = $el.find('td:nth-child(2)').first().text().trim()
    const uploadDate = dateRaw ? parseDateString(dateRaw)?.toISOString() : undefined
    const catText = $el.find('td:nth-child(1) > div.tt-name > span').first().text().trim()
    const category = catText ? categoryFromRawString(catText) : undefined

    results.push({
      infoHash, name, size, seeders, peers,
      uploadDate, category, providerName,
      descriptionPageUrl: detailsPageUrl,
    })
  })
  return results
}

function parseDetailsPage(html: string): TorrentDetails | null {
  const $ = cheerio.load(html)
  const tbody = 'table.torrentinfo > tbody'
  const name = $(`${tbody} > tr:nth-child(1) > td:nth-child(2)`).first().text().trim()
  if (!name) return null
  const magnetUri = $(`a[href^="magnet:?"]`).attr('href')
  if (!magnetUri) return null
  const infoHash = getInfoHashFromMagnetUri(magnetUri)

  const size = $(`${tbody} > tr:nth-child(6) > td:nth-child(2)`).first().text().trim() || undefined

  const seedsPeersText = $(`${tbody} > tr:nth-child(5) > td:nth-child(2)`).first().text().trim()
  let seeders: number | undefined
  let peers: number | undefined
  if (seedsPeersText) {
    const seedsMatch = seedsPeersText.match(/Seeds:\s*(\d[\d,]*)/)
    const peersMatch = seedsPeersText.match(/Leechers:\s*(\d[\d,]*)/)
    seeders = seedsMatch ? parseInt(seedsMatch[1].replace(/,/g, '')) || undefined : undefined
    peers = peersMatch ? parseInt(peersMatch[1].replace(/,/g, '')) || undefined : undefined
  }

  const dateRaw = $(`${tbody} > tr:nth-child(8) > td:nth-child(2)`).first().text().trim()
  const uploadDate = dateRaw ? parseDateString(dateRaw)?.toISOString() : undefined

  const catText = $(`${tbody} > tr:nth-child(4) > td:nth-child(2)`).first().text().trim()
  const category = catText ? categoryFromRawString(catText) : undefined

  const fileDownloadLink = $(`a[href^="https://itorrent.net/"]`).attr('href')

  return {
    infoHash, name, size, seeders, peers,
    uploadDate, category, magnetUri, fileDownloadLink,
  }
}

function categoryFromRawString(raw: string): Category | undefined {
  const cleaned = raw.replace(/[^A-Za-z]+/g, '')
  if (['XXX', 'XXXVideo', 'XXXHDVideo', 'XXXPictures', 'Adult', 'AdultPornHDVideo', 'AdultPornPictures', 'AdultPornVideo'].includes(cleaned)) return Category.Porn
  if (['Anime', 'AnimeEnglishtranslated', 'AnimeAnimeOther'].includes(cleaned)) return Category.Anime
  if (['Applications', 'ApplicationsAndroid', 'ApplicationsWindows', 'Software'].includes(cleaned)) return Category.Apps
  if (['BooksAcademic', 'BooksComics', 'BooksEbooks', 'BooksEducational', 'BooksMagazines', 'BooksFiction', 'BooksNonfiction', 'BooksTextbooks', 'Ebooks', 'OtherEbooks', 'OtherComics', 'AudioBooks', 'AudioAudiobooks'].includes(cleaned)) return Category.Books
  if (['Games', 'GamesWindows'].includes(cleaned)) return Category.Games
  if (['Movies', 'MoviesAction', 'MoviesConcerts', 'MoviesCrime', 'MoviesDocumentary', 'MoviesDubbedMovies', 'MoviesHighresMovies', 'MoviesMusicvideos', 'MoviesThriller', 'VideoMovies'].includes(cleaned)) return Category.Movies
  if (['Music', 'MusicHardrock', 'MusicMp', 'MusicFLAC', 'MusicLossless', 'MusicRB', 'MusicTranceHouseDance', 'VideoMusic', 'AudioMusic'].includes(cleaned)) return Category.Music
  if (['TV', 'TVBBC', 'TVshows', 'Television'].includes(cleaned)) return Category.Series
  return Category.Other
}
