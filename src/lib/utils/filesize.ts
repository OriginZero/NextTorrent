export function normalizeSize(size: string): string {
  let result = ''
  for (let i = 0; i < size.length; i++) {
    result += size[i]
    if (i < size.length - 1 && /\d/.test(size[i]) && /[a-zA-Z]/.test(size[i + 1])) {
      result += ' '
    }
  }
  return result
}

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
const SI_UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes: number, si = true): string {
  const units = si ? SI_UNITS : UNITS
  const base = si ? 1000 : 1024
  if (bytes < base) return `${bytes} B`
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1)
  const value = bytes / Math.pow(base, exp)
  return `${value.toFixed(2)} ${units[exp]}`
}

export function parseBytes(formattedSize: string): number | null {
  const regex = /^([\d.]+)\s*(B|KiB|MiB|GiB|TiB|kB|MB|GB|TB)?$/i
  const match = regex.exec(formattedSize.trim())
  if (!match) return null
  const value = parseFloat(match[1])
  const unit = (match[2] || 'B').toUpperCase()
  const multipliers: Record<string, number> = {
    'B': 1, 'KB': 1000, 'KIB': 1024, 'MB': 1000000, 'MIB': 1048576,
    'GB': 1000000000, 'GIB': 1073741824, 'TB': 1000000000000, 'TIB': 1099511627776,
  }
  const mult = multipliers[unit]
  return mult ? value * mult : null
}
