/** Gamma public API — https://developers.gamma.app/docs */

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0'

export type GammaFormat = 'presentation' | 'document' | 'webpage' | 'social'
export type GammaTextMode = 'generate' | 'condense' | 'preserve'

export type GammaCreateInput = {
  inputText: string
  format?: GammaFormat
  numCards?: number
  textMode?: GammaTextMode
  exportAs?: 'pdf' | 'pptx' | 'png'
}

export async function gammaCreateGeneration(input: GammaCreateInput): Promise<{ generationId: string }> {
  const key = process.env.GAMMA_API_KEY
  if (!key?.trim()) {
    throw new Error('GAMMA_API_KEY is niet ingesteld. Voeg een sleutel toe in de omgevingsvariabelen.')
  }

  const res = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': key,
    },
    body: JSON.stringify({
      inputText: input.inputText,
      format: input.format ?? 'presentation',
      numCards: Math.min(75, Math.max(1, input.numCards ?? 12)),
      textMode: input.textMode ?? 'preserve',
      ...(input.exportAs ? { exportAs: input.exportAs } : {}),
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`Gamma API (${res.status}): ${raw.slice(0, 500)}`)
  }
  const data = JSON.parse(raw) as { generationId?: string }
  if (!data.generationId) throw new Error('Gamma API: geen generationId in antwoord')
  return { generationId: data.generationId }
}

export type GammaGenerationStatus = {
  generationId: string
  status: string
  gammaUrl?: string
  exportUrl?: string
}

export async function gammaGetGeneration(generationId: string): Promise<GammaGenerationStatus> {
  const key = process.env.GAMMA_API_KEY
  if (!key?.trim()) {
    throw new Error('GAMMA_API_KEY is niet ingesteld.')
  }

  const res = await fetch(`${GAMMA_API_BASE}/generations/${encodeURIComponent(generationId)}`, {
    method: 'GET',
    headers: { 'X-API-KEY': key },
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(`Gamma API (${res.status}): ${raw.slice(0, 500)}`)
  }
  return JSON.parse(raw) as GammaGenerationStatus
}
