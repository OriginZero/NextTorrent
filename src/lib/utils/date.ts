import { parse as dateParse, isValid } from 'date-fns'

const MONTH_MAP: Record<string, string> = {
  'января': 'January', 'февраля': 'February', 'марта': 'March',
  'апреля': 'April', 'мая': 'May', 'июня': 'June',
  'июля': 'July', 'августа': 'August', 'сентября': 'September',
  'октября': 'October', 'ноября': 'November', 'декабря': 'December',
}

const FORMATS = [
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
  'dd MMM yyyy',
  'dd MMMM yyyy',
  'MMM dd yyyy',
  'MMMM dd yyyy',
  'd MMM yyyy',
  'dd-MM-yyyy HH:mm',
  'MM-dd-yyyy HH:mm',
  'dd MMM yy',
  'MMM d yy',
  'MM/dd/yy',
  'dd-MM-yyyy HH:mm:ss',
  'h a MMM d yyyy',
  'yyyy/MM/dd',
]

function replaceRussianMonths(text: string): string {
  let result = text
  for (const [ru, en] of Object.entries(MONTH_MAP)) {
    result = result.replace(new RegExp(ru, 'gi'), en)
  }
  return result
}

export function parseDateString(date: string): Date | null {
  const cleaned = date.trim()
  const normalized = replaceRussianMonths(cleaned)

  // Relative patterns
  const relMatch = normalized.match(/^(\d+)\s+(minute|minutes|min|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago$/i)
  if (relMatch) {
    const n = parseInt(relMatch[1])
    const unit = relMatch[2].toLowerCase()
    const now = Date.now()
    const ms = unit.startsWith('min') ? n * 60000
      : unit.startsWith('hour') ? n * 3600000
      : unit.startsWith('day') ? n * 86400000
      : unit.startsWith('week') ? n * 604800000
      : unit.startsWith('month') ? n * 2592000000
      : n * 31536000000
    return new Date(now - ms)
  }

  const lower = normalized.toLowerCase()
  if (lower === 'today' || lower === 'just now' || lower === 'moments ago') return new Date()
  if (lower === 'yesterday') return new Date(Date.now() - 86400000)
  if (lower === 'last week') return new Date(Date.now() - 604800000)
  if (lower === 'last month') return new Date(Date.now() - 2592000000)
  if (lower === 'last year') return new Date(Date.now() - 31536000000)

  for (const fmt of FORMATS) {
    try {
      const d = dateParse(normalized, fmt, new Date())
      if (isValid(d)) return d
    } catch { }
  }

  return null
}

export function epochSecondToDate(epochSecond: number): Date {
  return new Date(epochSecond * 1000)
}

export function parseISO(date: string): Date | null {
  const d = new Date(date)
  return isNaN(d.getTime()) ? null : d
}
