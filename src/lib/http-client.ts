const REQUEST_TIMEOUT_MS = 20000
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'

export class CloudflareChallengeError extends Error {
  constructor(public url: string) {
    super(`Cloudflare challenge encountered [url=${url}]`)
  }
}

export const httpClient = {
  async get(url: string, headers: Record<string, string> = {}): Promise<string> {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, ...headers } })
    checkChallenge(res)
    return res.text()
  },

  async getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT, ...headers } })
    checkChallenge(res)
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return null }
  },

  async postJson(url: string, payload: any): Promise<any> {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!text) return null
    try { return JSON.parse(text) } catch { return null }
  },

  async submitForm(url: string, formData: Record<string, string>): Promise<string | null> {
    const params = new URLSearchParams(formData)
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    return res.text()
  },
}

function checkChallenge(res: Response) {
  if (res.headers.get('cf-mitigated') === 'challenge' || res.status === 403 || res.status === 503) {
    throw new CloudflareChallengeError(res.url)
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}
