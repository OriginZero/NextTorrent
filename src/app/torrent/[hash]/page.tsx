import DetailsClient from './DetailsClient'

export function generateStaticParams() {
  return [{ hash: 'example' }]
}

export default function TorrentDetailsPage() {
  return <DetailsClient />
}
