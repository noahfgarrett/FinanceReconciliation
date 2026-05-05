const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-US')

export const fmtUsd = (n: number): string => usd.format(n)
export const fmtUsdCents = (n: number): string => usdCents.format(n)
export const fmtHours = (n: number): string => `${num.format(Math.round(n * 100) / 100)} hr`
export const fmtNumber = (n: number): string => num.format(n)
