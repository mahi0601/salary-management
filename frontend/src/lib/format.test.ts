import { formatMoney, formatUsd, formatUsdCompact } from './format'

describe('format', () => {
  it('formats whole-unit amounts in their own currency', () => {
    expect(formatMoney(2400000, 'INR')).toContain('2,400,000')
    expect(formatMoney(150000, 'EUR')).toBe('€150,000')
  })

  it('formats USD without decimals', () => {
    expect(formatUsd(93956)).toBe('$93,956')
  })

  it('compacts large amounts for chart axes', () => {
    expect(formatUsdCompact(125000)).toBe('$125K')
    expect(formatUsdCompact(940000000)).toBe('$940M')
  })
})
