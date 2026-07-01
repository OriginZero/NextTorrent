const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.trackerfix.com:85/announce',
  'udp://9.rarbg.me:2970/announce',
  'udp://9.rarbg.to:2970/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://tracker.internetwarriors.net:1337/announce',
  'udp://tracker.zer0day.to:1337/announce',
  'udp://tracker.bitsearch.xyz:1337/announce',
  'udp://opentor.net:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.stealth.si:80/announce',
  'udp://bt.kaist.ac.kr:80/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://ipv4.tracker.harry.lu:80/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
]

export function getInfoHashFromMagnetUri(magnetUri: string): string {
  const btihPrefix = 'urn:btih:'
  const startIndex = magnetUri.indexOf(btihPrefix)
  if (startIndex === -1) return magnetUri
  const hashStart = startIndex + btihPrefix.length
  const hashEnd = magnetUri.indexOf('&', hashStart)
  return hashEnd === -1
    ? magnetUri.substring(hashStart).toLowerCase()
    : magnetUri.substring(hashStart, hashEnd).toLowerCase()
}

export function createMagnetUri(infoHash: string): string {
  const params = new URLSearchParams()
  params.set('xt', `urn:btih:${infoHash}`)
  for (const t of TRACKERS) params.append('tr', t)
  return `magnet:?${params.toString()}`
}
