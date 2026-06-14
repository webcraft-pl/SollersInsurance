import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const TYPE_NAMES: Record<string, string> = { dom: 'Dom jednorodzinny', mieszkanie: 'Mieszkanie', szeregowiec: 'Dom szeregowy', letniskowy: 'Dom letniskowy' }
const MAT_NAMES: Record<string, string> = { mur: 'Mur/beton', drewno: 'Drewno', prefabrykat: 'Prefabrykat' }
const COV_NAMES: Record<string, string> = { mury: 'Mury i elementy stałe', ruchomosci: 'Ruchomości domowe', oc: 'OC w życiu prywatnym', assistance: 'Assistance 24h', szyby: 'Szyby i oszklenia', zalanie: 'Zalanie i powódź', przepięcie: 'Przepięcie elektryczne', kradziez: 'Kradzież z włamaniem', wandalizm: 'Wandalizm' }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { quoteState, annualPremium, apiKey } = req.body as {
    quoteState: { type: string; value: number; material: string; year: number; floodZone: string | null; coverages: string[] }
    annualPremium: number
    apiKey?: string
  }

  const key = process.env.ANTHROPIC_API_KEY || apiKey
  if (!key) {
    return res.json(fallbackPackages(annualPremium, quoteState.coverages, quoteState.type))
  }

  try {
    const client = new Anthropic({ apiKey: key })
    const covNames = quoteState.coverages.map(k => COV_NAMES[k] ?? k).join(', ')
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `Stwórz 3 pakiety ubezpieczenia nieruchomości dla:\nTyp: ${TYPE_NAMES[quoteState.type] ?? quoteState.type}\nWartość: ${quoteState.value} PLN\nMateriał: ${MAT_NAMES[quoteState.material] ?? quoteState.material}\nRok: ${quoteState.year}\nStrefa powodziowa: ${quoteState.floodZone ?? 'nieznana'}\nAktualny zakres: ${covNames}\nSkładka aktualna: ${annualPremium} PLN/rok\n\nOdpowiedz TYLKO JSON (bez markdown):\n[{"name":"Podstawowy","price":NUMBER,"features":["cecha 1","cecha 2","cecha 3"],"reason":"jedno zdanie rekomendacji"},{"name":"Standard","price":NUMBER,...},{"name":"Premium","price":NUMBER,...}]\n\nPodstawowy to ok 70% ceny aktualnej, Standard to aktualna cena, Premium to ok 140%.`,
      }],
    })
    const text = (message.content[0] as { text: string }).text.trim().replace(/```json|```/g, '').trim()
    const packages = JSON.parse(text)
    return res.json(packages)
  } catch (e) {
    console.error('Package generation error:', e)
    return res.json(fallbackPackages(annualPremium, quoteState.coverages, quoteState.type))
  }
}

function fallbackPackages(annual: number, coverages: string[], type: string) {
  return [
    {
      name: 'Podstawowy',
      price: Math.round(annual * 0.75),
      features: ['Mury i elementy stałe', 'Zalanie (standard)', 'Przepięcie elektryczne'],
      reason: 'Minimalna ochrona bez opcji dodatkowych. Dobra dla ograniczonego budżetu.',
    },
    {
      name: 'Standard',
      price: annual,
      features: coverages.map(k => ({ mury: 'Mury i elementy stałe', ruchomosci: 'Ruchomości domowe', oc: 'OC w życiu prywatnym', assistance: 'Assistance 24h', szyby: 'Szyby i oszklenia', zalanie: 'Zalanie i powódź', przepięcie: 'Przepięcie elektryczne', kradziez: 'Kradzież z włamaniem', wandalizm: 'Wandalizm' }[k] ?? k)).slice(0, 4),
      reason: `Rekomendowany dla ${({ dom: 'domu jednorodzinnego', mieszkanie: 'mieszkania', szeregowiec: 'domu szeregowego', letniskowy: 'domu letniskowego' })[type] ?? 'tej nieruchomości'}. Optymalny stosunek ceny do zakresu ochrony.`,
    },
    {
      name: 'Premium',
      price: Math.round(annual * 1.35),
      features: ['Pełny zakres + OC', 'Assistance 24h Premium', 'NNW dla domowników', 'Ubezpieczenie sprzętu'],
      reason: 'Kompleksowa ochrona dla wymagających. Pokrycie również poza nieruchomością.',
    },
  ]
}
