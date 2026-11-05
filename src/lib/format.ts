const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-US')

export const fmtUsd = (n: number): string => usd.format(n)
export const fmtUsdCents = (n: number): string => usdCents.format(n)
export const fmtHours = (n: number): string => `${num.format(Math.round(n * 100) / 100)} hr`
export const fmtNumber = (n: number): string => num.format(n)

/** "1 employee", "2 employees". Pass `pluralForm` for irregular words. */
export const pluralize = (n: number, singular: string, pluralForm = `${singular}s`): string =>
  `${num.format(n)} ${n === 1 ? singular : pluralForm}`
