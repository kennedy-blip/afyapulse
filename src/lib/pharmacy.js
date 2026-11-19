import { daysUntil } from './dates'

export const CATEGORY_LABEL = {
  medicine: 'Essential medicine',
  vaccine: 'Vaccine',
  consumable: 'Consumable',
}

export const COLD_CHAIN_LABEL = {
  ambient: 'Ambient 15–25 °C',
  cold: 'Cold chain 2–8 °C',
  frozen: 'Frozen −20 °C',
}

export const STOCK_UNITS = ['tabs', 'caps', 'vials', 'doses', 'sachets', 'bottles', 'tubes', 'pcs']

export function stockStatus(med) {
  const qty = Number(med?.quantity) || 0
  const reorder = Number(med?.reorderLevel) || 0
  if (qty <= 0) return { id: 'out', label: 'Stock-out', tone: 'danger', ratio: 0 }
  if (qty <= reorder) return { id: 'low', label: 'Low stock', tone: 'warn', ratio: Math.min(1, qty / Math.max(reorder * 2, 1)) }
  return {
    id: 'ok',
    label: 'In stock',
    tone: 'ok',
    ratio: Math.min(1, qty / Math.max(reorder * 3, qty, 1)),
  }
}

export function expiryStatus(med) {
  const days = daysUntil(med?.expiryDate)
  if (Number.isNaN(days)) return { id: 'unknown', label: 'No expiry', tone: 'muted', days: null }
  if (days < 0) return { id: 'expired', label: 'Expired', tone: 'danger', days }
  if (days <= 30) return { id: 'critical', label: `${days}d to expiry`, tone: 'danger', days }
  if (days <= 90) return { id: 'warning', label: `${days}d to expiry`, tone: 'warn', days }
  return { id: 'ok', label: `${Math.round(days / 30)} mo shelf life`, tone: 'ok', days }
}

export function stockPercent(med) {
  const qty = Number(med?.quantity) || 0
  const baseline = Number(med?.baselineStock) || Number(med?.reorderLevel) * 4 || 1
  return Math.max(0, Math.min(100, Math.round((qty / Math.max(baseline, 1)) * 100)))
}

export function needsAttention(med) {
  const stock = stockStatus(med)
  const expiry = expiryStatus(med)
  return ['low', 'out'].includes(stock.id) || ['critical', 'expired'].includes(expiry.id)
}

export function sortInventory(meds = []) {
  const weight = (med) => {
    const stock = stockStatus(med)
    const expiry = expiryStatus(med)
    let score = 0
    if (stock.id === 'out') score += 100
    if (stock.id === 'low') score += 60
    if (expiry.id === 'expired') score += 80
    if (expiry.id === 'critical') score += 40
    if (expiry.id === 'warning') score += 20
    return -score
  }
  return [...meds].sort((a, b) => weight(a) - weight(b) || String(a.name).localeCompare(String(b.name)))
}

export const DEFAULT_FORMULARY = [
  { name: 'Amoxicillin 250 mg DT', category: 'medicine', unit: 'tabs', reorderLevel: 120, baselineStock: 600, coldChain: 'ambient' },
  { name: 'Artemether-Lumefantrine 20/120', category: 'medicine', unit: 'tabs', reorderLevel: 60, baselineStock: 288, coldChain: 'ambient' },
  { name: 'Paracetamol 500 mg', category: 'medicine', unit: 'tabs', reorderLevel: 200, baselineStock: 1000, coldChain: 'ambient' },
  { name: 'Oral Rehydration Salts', category: 'medicine', unit: 'sachets', reorderLevel: 80, baselineStock: 400, coldChain: 'ambient' },
  { name: 'Ferrous Sulphate + Folic Acid', category: 'medicine', unit: 'tabs', reorderLevel: 150, baselineStock: 900, coldChain: 'ambient' },
  { name: 'Oxytocin 10 IU', category: 'medicine', unit: 'vials', reorderLevel: 10, baselineStock: 40, coldChain: 'cold' },
  { name: 'Measles-Rubella vaccine', category: 'vaccine', unit: 'doses', reorderLevel: 20, baselineStock: 100, coldChain: 'cold' },
  { name: 'BCG vaccine', category: 'vaccine', unit: 'doses', reorderLevel: 15, baselineStock: 60, coldChain: 'cold' },
  { name: 'Penta vaccine (DTP-HepB-Hib)', category: 'vaccine', unit: 'doses', reorderLevel: 20, baselineStock: 120, coldChain: 'cold' },
  { name: 'OPV vaccine', category: 'vaccine', unit: 'doses', reorderLevel: 20, baselineStock: 120, coldChain: 'cold' },
  { name: 'Tetanus Toxoid vaccine', category: 'vaccine', unit: 'doses', reorderLevel: 15, baselineStock: 80, coldChain: 'cold' },
  { name: 'Examination gloves', category: 'consumable', unit: 'pcs', reorderLevel: 100, baselineStock: 500, coldChain: 'ambient' },
]
