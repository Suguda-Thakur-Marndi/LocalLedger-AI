import React, { useState, useMemo, useId } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
  Cell,
} from 'recharts'
import type { MonthlySpendTrend, CurrencyTotal } from '../../../types'
import { formatCurrency, formatCompactCurrency } from '../../../lib/utils'

export type PeriodAggregation = 'monthly' | 'quarterly' | 'yearly'

export interface MonthlyExpenditureChartProps {
  monthlyTrends?: MonthlySpendTrend[]
  currencyTotals?: CurrencyTotal[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  className?: string
}

interface AggregatedBarPoint {
  key: string
  periodLabel: string
  fullLabel: string
  total_amount: number
  transaction_count: number
  currency: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function parseYearMonth(str: string): { year: number; month: number } | null {
  if (!str || typeof str !== 'string') return null
  const parts = str.split('-')
  if (parts.length < 2) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null
  return { year, month }
}

export const MonthlyExpenditureChart: React.FC<MonthlyExpenditureChartProps> = ({
  monthlyTrends = [],
  currencyTotals = [],
  isLoading = false,
  isError = false,
  onRetry,
  className = '',
}) => {
  const chartId = useId()
  const gradientId = `expenditureBarGradient-${chartId.replace(/:/g, '')}`

  // 1. Multi-currency discovery and isolation
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>()
    // Prefer currency order from currencyTotals
    currencyTotals.forEach((c) => {
      if (c.currency) set.add(c.currency)
    })
    monthlyTrends.forEach((t) => {
      if (t.currency) set.add(t.currency)
    })
    return Array.from(set)
  }, [monthlyTrends, currencyTotals])

  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [periodFilter, setPeriodFilter] = useState<PeriodAggregation>('monthly')
  const [showValuesAboveBars, setShowValuesAboveBars] = useState<boolean>(true)
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null)

  // Resolve active currency (defaulting to first available currency or 'MYR'/'USD')
  const activeCurrency = useMemo(() => {
    if (selectedCurrency && availableCurrencies.includes(selectedCurrency)) {
      return selectedCurrency
    }
    return availableCurrencies[0] || 'MYR'
  }, [selectedCurrency, availableCurrencies])

  // 2. Data aggregation & sanitization (NO fabricated zero months)
  const chartData = useMemo<AggregatedBarPoint[]>(() => {
    if (!monthlyTrends || monthlyTrends.length === 0) return []

    // Filter strictly by active currency and validate values
    const currencyItems = monthlyTrends.filter((t) => {
      if (t.currency !== activeCurrency) return false
      if (!t.month || typeof t.month !== 'string') return false
      const amount = typeof t.total_amount === 'string' ? parseFloat(t.total_amount) : t.total_amount
      return !isNaN(amount) && amount >= 0
    })

    if (currencyItems.length === 0) return []

    if (periodFilter === 'monthly') {
      const points: AggregatedBarPoint[] = []
      // Deduplicate/merge in case multiple records for same month exist
      const map = new Map<string, { total: number; count: number }>()

      for (const item of currencyItems) {
        const parsed = parseYearMonth(item.month)
        if (!parsed) continue
        const key = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
        const amount = typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount
        const count = item.transaction_count || 1

        const prev = map.get(key) || { total: 0, count: 0 }
        map.set(key, { total: prev.total + amount, count: prev.count + count })
      }

      // Sort strictly chronologically
      const sortedKeys = Array.from(map.keys()).sort()
      for (const key of sortedKeys) {
        const parsed = parseYearMonth(key)!
        const val = map.get(key)!
        points.push({
          key,
          periodLabel: `${MONTH_SHORT[parsed.month - 1]} '${String(parsed.year).slice(-2)}`,
          fullLabel: `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`,
          total_amount: Math.round(val.total * 100) / 100,
          transaction_count: val.count,
          currency: activeCurrency,
        })
      }
      return points
    }

    if (periodFilter === 'quarterly') {
      const map = new Map<string, { total: number; count: number; year: number; quarter: number }>()

      for (const item of currencyItems) {
        const parsed = parseYearMonth(item.month)
        if (!parsed) continue
        const quarter = Math.ceil(parsed.month / 3)
        const key = `${parsed.year}-Q${quarter}`
        const amount = typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount
        const count = item.transaction_count || 1

        const prev = map.get(key) || { total: 0, count: 0, year: parsed.year, quarter }
        map.set(key, {
          total: prev.total + amount,
          count: prev.count + count,
          year: parsed.year,
          quarter,
        })
      }

      const sortedKeys = Array.from(map.keys()).sort()
      return sortedKeys.map((key) => {
        const val = map.get(key)!
        return {
          key,
          periodLabel: `Q${val.quarter} '${String(val.year).slice(-2)}`,
          fullLabel: `Q${val.quarter} ${val.year}`,
          total_amount: Math.round(val.total * 100) / 100,
          transaction_count: val.count,
          currency: activeCurrency,
        }
      })
    }

    // Yearly
    const map = new Map<string, { total: number; count: number; year: number }>()
    for (const item of currencyItems) {
      const parsed = parseYearMonth(item.month)
      if (!parsed) continue
      const key = String(parsed.year)
      const amount = typeof item.total_amount === 'string' ? parseFloat(item.total_amount) : item.total_amount
      const count = item.transaction_count || 1

      const prev = map.get(key) || { total: 0, count: 0, year: parsed.year }
      map.set(key, {
        total: prev.total + amount,
        count: prev.count + count,
        year: parsed.year,
      })
    }

    const sortedKeys = Array.from(map.keys()).sort()
    return sortedKeys.map((key) => {
      const val = map.get(key)!
      return {
        key,
        periodLabel: String(val.year),
        fullLabel: `Fiscal Year ${val.year}`,
        total_amount: Math.round(val.total * 100) / 100,
        transaction_count: val.count,
        currency: activeCurrency,
      }
    })
  }, [monthlyTrends, activeCurrency, periodFilter])

  // Summary statistics for current view
  const summaryStats = useMemo(() => {
    const totalSpend = chartData.reduce((acc, curr) => acc + curr.total_amount, 0)
    const totalTransactions = chartData.reduce((acc, curr) => acc + curr.transaction_count, 0)
    const avgSpend = chartData.length > 0 ? totalSpend / chartData.length : 0
    return {
      totalSpend,
      totalTransactions,
      avgSpend,
      periodCount: chartData.length,
    }
  }, [chartData])

  // Keyboard navigation for period tabs
  const handlePeriodKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentPeriod: PeriodAggregation
  ) => {
    const periods: PeriodAggregation[] = ['monthly', 'quarterly', 'yearly']
    const currentIndex = periods.indexOf(currentPeriod)
    let nextIndex = currentIndex

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % periods.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + periods.length) % periods.length
    }

    if (nextIndex !== currentIndex) {
      setPeriodFilter(periods[nextIndex])
    }
  }

  // --- 1. Loading State ---
  if (isLoading) {
    return (
      <div
        className={`bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-xs border border-outline-variant/30 flex flex-col gap-space-md ${className}`}
        role="region"
        aria-label="Monthly Expenditure Volume Chart"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
          <div>
            <div className="h-6 w-48 bg-surface-container rounded" />
            <div className="h-4 w-64 bg-surface-container-low rounded mt-1.5" />
          </div>
          <div className="h-9 w-44 bg-surface-container rounded-lg" />
        </div>

        <div className="h-64 sm:h-72 w-full flex items-end justify-around gap-4 px-6 pt-10 pb-4 border-b border-surface-container animate-pulse">
          <div className="w-10 h-1/3 bg-surface-container-low rounded-t-lg" />
          <div className="w-10 h-2/3 bg-surface-container rounded-t-lg" />
          <div className="w-10 h-1/2 bg-surface-container-low rounded-t-lg" />
          <div className="w-10 h-3/4 bg-surface-container rounded-t-lg" />
        </div>
      </div>
    )
  }

  // --- 2. Error State ---
  if (isError) {
    return (
      <div
        className={`bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-xs border border-outline-variant/30 flex flex-col gap-space-md ${className}`}
        role="alert"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
              Monthly Expenditure Volume
            </h2>
            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
              Aggregated spending volume by calendar period
            </p>
          </div>
        </div>

        <div className="p-space-lg rounded-xl bg-error-container/40 border border-error/30 text-on-surface flex flex-col items-center justify-center text-center gap-3 my-4">
          <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[24px]">error_outline</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm sm:text-headline-sm font-semibold text-on-surface">
              Unable to load expenditure volume
            </h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1 max-w-md">
              There was a problem querying the local transaction aggregates. Please ensure the local database engine is running.
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-xs border border-outline-variant/30 flex flex-col gap-space-md ${className}`}
      role="region"
      aria-label="Monthly Expenditure Volume Chart"
    >
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-1 border-b border-surface-container/60">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold tracking-tight">
              Monthly Expenditure Volume
            </h2>
            {summaryStats.periodCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container text-primary font-table-numeric">
                {formatCurrency(summaryStats.totalSpend, activeCurrency)}
              </span>
            )}
          </div>
          <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant mt-0.5">
            Aggregated expenditure patterns computed directly from local transaction ledger
          </p>
        </div>

        {/* Action Controls: Currency Pill + Aggregation Tabs + Show Values Toggle */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Multi-Currency Selector (Visible if multiple currencies exist, or display single active currency tag) */}
          {availableCurrencies.length > 1 ? (
            <div
              className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 text-xs"
              role="radiogroup"
              aria-label="Filter chart by currency"
            >
              {availableCurrencies.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  role="radio"
                  aria-checked={activeCurrency === curr}
                  onClick={() => setSelectedCurrency(curr)}
                  className={`px-2.5 py-1 rounded text-xs font-label-caps transition-all ${
                    activeCurrency === curr
                      ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {curr}
                </button>
              ))}
            </div>
          ) : availableCurrencies.length === 1 ? (
            <div className="px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant text-[11px] font-label-caps border border-outline-variant/20">
              <span className="font-semibold text-primary">{activeCurrency}</span> ledger
            </div>
          ) : null}

          {/* Period Filter (Monthly / Quarterly / Yearly) */}
          <div
            className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant/30 text-xs"
            role="tablist"
            aria-label="Aggregation period"
          >
            {(['monthly', 'quarterly', 'yearly'] as const).map((period) => {
              const label =
                period === 'monthly' ? 'Monthly' : period === 'quarterly' ? 'Quarterly' : 'Yearly'
              const isSelected = periodFilter === period
              return (
                <button
                  key={period}
                  role="tab"
                  id={`tab-${period}`}
                  aria-selected={isSelected}
                  aria-controls="expenditure-chart-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setPeriodFilter(period)}
                  onKeyDown={(e) => handlePeriodKeyDown(e, period)}
                  className={`px-2.5 py-1 rounded text-xs font-label-caps capitalize transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Toggle Values Above Bars Button */}
          {chartData.length > 0 && (
            <button
              type="button"
              onClick={() => setShowValuesAboveBars((prev) => !prev)}
              title={showValuesAboveBars ? 'Hide values above bars' : 'Show values above bars'}
              aria-label={showValuesAboveBars ? 'Hide values above bars' : 'Show values above bars'}
              aria-pressed={showValuesAboveBars}
              className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center justify-center ${
                showValuesAboveBars
                  ? 'bg-surface-container text-primary border-outline-variant/40'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">numbers</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Strip */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-1 text-xs">
          <div className="bg-surface-container-low/60 rounded-lg p-2.5 flex flex-col border border-outline-variant/20">
            <span className="text-on-surface-variant font-label-caps text-[10px] uppercase">
              Total {periodFilter === 'monthly' ? 'Monthly' : periodFilter === 'quarterly' ? 'Quarterly' : 'Annual'} Spend
            </span>
            <span className="font-headline-sm text-sm sm:text-base font-bold font-table-numeric text-on-surface mt-0.5">
              {formatCurrency(summaryStats.totalSpend, activeCurrency)}
            </span>
          </div>

          <div className="bg-surface-container-low/60 rounded-lg p-2.5 flex flex-col border border-outline-variant/20">
            <span className="text-on-surface-variant font-label-caps text-[10px] uppercase">
              Average per {periodFilter === 'monthly' ? 'Month' : periodFilter === 'quarterly' ? 'Quarter' : 'Year'}
            </span>
            <span className="font-headline-sm text-sm sm:text-base font-bold font-table-numeric text-on-surface mt-0.5">
              {formatCurrency(summaryStats.avgSpend, activeCurrency)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-surface-container-low/60 rounded-lg p-2.5 flex flex-col border border-outline-variant/20">
            <span className="text-on-surface-variant font-label-caps text-[10px] uppercase">
              Period Records
            </span>
            <span className="font-headline-sm text-sm sm:text-base font-bold font-table-numeric text-on-surface mt-0.5">
              {summaryStats.totalTransactions} transactions in {summaryStats.periodCount} {periodFilter === 'monthly' ? 'month' : periodFilter === 'quarterly' ? 'quarter' : 'year'}{summaryStats.periodCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas or Empty State */}
      <div
        id="expenditure-chart-panel"
        role="tabpanel"
        aria-labelledby={`tab-${periodFilter}`}
        className="h-64 sm:h-72 md:h-80 w-full relative select-none"
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: showValuesAboveBars ? 24 : 12, right: 16, left: 0, bottom: 4 }}
              onMouseMove={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  setActiveBarIndex(state.activeTooltipIndex)
                }
              }}
              onMouseLeave={() => setActiveBarIndex(null)}
            >
              <defs>
                {/* Forest to emerald vertical gradient */}
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00603c" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.82} />
                </linearGradient>

                {/* Active bar hover gradient */}
                <linearGradient id={`${gradientId}-hover`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#004d30" stopOpacity={1} />
                  <stop offset="100%" stopColor="#007a4d" stopOpacity={0.95} />
                </linearGradient>
              </defs>

              {/* Subtle horizontal gridlines */}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e4eade"
                strokeOpacity={0.8}
              />

              {/* Accessible, styled XAxis */}
              <XAxis
                dataKey="periodLabel"
                stroke="#5c675e"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#bec9c0' }}
                tick={{ fill: '#5c675e' }}
                padding={{ left: 24, right: 24 }}
              />

              {/* Multi-currency safe YAxis with compact notation */}
              <YAxis
                stroke="#5c675e"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5c675e' }}
                tickFormatter={(val) => formatCompactCurrency(val, activeCurrency)}
                width={56}
              />

              {/* Premium dark floating tooltip */}
              <Tooltip
                cursor={{ fill: 'rgba(0, 96, 60, 0.05)', radius: 6 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload as AggregatedBarPoint
                    const avgPerTx =
                      data.transaction_count > 0 ? data.total_amount / data.transaction_count : 0
                    return (
                      <div className="bg-[#161d16] text-white p-3 rounded-xl shadow-lg border border-[#2a322a] text-xs space-y-1.5 min-w-[180px]">
                        <div className="flex items-center justify-between border-b border-[#2a322a] pb-1.5 font-semibold text-white/90">
                          <span>{data.fullLabel}</span>
                          <span className="font-table-numeric text-[#84d8a8] text-[11px] font-bold">
                            {data.currency}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-[#bec9c0] text-[11px]">Total Expenditure:</span>
                          <span className="font-bold text-white font-table-numeric text-sm">
                            {formatCurrency(data.total_amount, data.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#bec9c0]">
                          <span>Volume:</span>
                          <span className="font-table-numeric font-medium text-white/90">
                            {data.transaction_count} transaction{data.transaction_count === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#bec9c0]">
                          <span>Average:</span>
                          <span className="font-table-numeric font-medium text-white/90">
                            {formatCurrency(avgPerTx, data.currency)} / tx
                          </span>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />

              {/* Rounded vertical bars with restrained max width */}
              <Bar
                dataKey="total_amount"
                fill={`url(#${gradientId})`}
                radius={[6, 6, 2, 2]}
                maxBarSize={44}
                minPointSize={2}
              >
                {/* Visual hover highlight */}
                {chartData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      activeBarIndex === index
                        ? `url(#${gradientId}-hover)`
                        : `url(#${gradientId})`
                    }
                    stroke={activeBarIndex === index ? '#00603c' : 'none'}
                    strokeWidth={activeBarIndex === index ? 1.5 : 0}
                  />
                ))}

                {/* Optional currency-formatted values above bars */}
                {showValuesAboveBars && (
                  <LabelList
                    dataKey="total_amount"
                    position="top"
                    formatter={(val: any) => formatCompactCurrency(val, activeCurrency)}
                    style={{
                      fill: '#3f4942',
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'Inter',
                    }}
                  />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 bg-surface-container-low/40 rounded-xl p-6 text-center border border-dashed border-outline-variant/40">
            <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[22px]">bar_chart</span>
            </div>
            <div className="max-w-xs">
              <p className="font-headline-sm text-xs sm:text-headline-sm font-semibold text-on-surface">
                No transactions recorded
              </p>
              <p className="font-body-sm text-[11px] sm:text-xs text-on-surface-variant mt-0.5">
                No spending data points found for currency <span className="font-semibold text-primary">{activeCurrency}</span>. Upload receipts to populate this chart.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Screen-reader accessible data table for compliance */}
      <div className="sr-only">
        <table>
          <caption>Monthly Expenditure Volume ({activeCurrency})</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Total Spend</th>
              <th scope="col">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.key}>
                <td>{row.fullLabel}</td>
                <td>{formatCurrency(row.total_amount, row.currency)}</td>
                <td>{row.transaction_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
