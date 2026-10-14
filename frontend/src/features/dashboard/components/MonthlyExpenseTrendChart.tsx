import React, { useState, useMemo, useId } from 'react'
import { Link } from 'react-router-dom'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  LabelList,
  Cell,
} from 'recharts'
import type { MonthlySpendTrend, WeeklySpendTrend, CurrencyTotal } from '../../../types'
import { formatCurrency, formatCompactCurrency } from '../../../lib/utils'

export type ChartCalculationMode = 'weekly' | 'monthly' | 'cumulative'

export interface MonthlyExpenseTrendChartProps {
  monthlyTrends?: MonthlySpendTrend[]
  weeklyTrends?: WeeklySpendTrend[]
  currencyTotals?: CurrencyTotal[]
  availableYears?: number[]
  totalTransactionsAllTime?: number
  selectedYear?: number | string
  onYearChange?: (year: number | string) => void
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  monthlyBudget?: number
  className?: string
}

interface TrendDataPoint {
  periodKey: string
  label: string
  fullLabel: string
  actual: number
  budget: number
  count: number
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

const CURRENT_CALENDAR_YEAR = new Date().getFullYear()

function parseYearMonth(str: string): { year: number; month: number } | null {
  if (!str || typeof str !== 'string') return null
  const parts = str.split('-')
  if (parts.length < 2) return null
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null
  return { year, month }
}

export const MonthlyExpenseTrendChart: React.FC<MonthlyExpenseTrendChartProps> = ({
  monthlyTrends = [],
  weeklyTrends = [],
  currencyTotals = [],
  availableYears = [],
  totalTransactionsAllTime,
  selectedYear,
  onYearChange,
  isLoading = false,
  isError = false,
  onRetry,
  monthlyBudget = 5000,
  className = '',
}) => {
  const chartId = useId()
  const gradientId = `trendChartGradient-${chartId.replace(/:/g, '')}`

  // Mode state: 'weekly' | 'monthly' | 'cumulative'
  const [mode, setMode] = useState<ChartCalculationMode>('monthly')
  const [internalYear, setInternalYear] = useState<number | string>(selectedYear || 2019)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('')
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null)

  const effectiveYear = selectedYear !== undefined ? selectedYear : internalYear

  const handleYearChange = (year: number | string) => {
    setInternalYear(year)
    if (onYearChange) {
      onYearChange(year)
    }
  }

  // 1. Multi-currency discovery & strict isolation
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>()
    currencyTotals.forEach((c) => {
      if (c.currency) set.add(c.currency)
    })
    monthlyTrends.forEach((t) => {
      if (t.currency) set.add(t.currency)
    })
    weeklyTrends.forEach((w) => {
      if (w.currency) set.add(w.currency)
    })
    return Array.from(set)
  }, [currencyTotals, monthlyTrends, weeklyTrends])

  const activeCurrency = useMemo(() => {
    if (selectedCurrency && availableCurrencies.includes(selectedCurrency)) {
      return selectedCurrency
    }
    return availableCurrencies[0] || 'MYR'
  }, [selectedCurrency, availableCurrencies])

  // Effective budget targets
  const weeklyBudget = Math.round((monthlyBudget * 12) / 52)

  // 2. Compute series points based on calculation mode (Weekly / Monthly / Cumulative)
  const chartPoints = useMemo<TrendDataPoint[]>(() => {
    const isYearFilter = effectiveYear !== 'all' && effectiveYear !== undefined && effectiveYear !== ''
    const yearStr = String(effectiveYear)

    if (mode === 'weekly') {
      // Filter weekly trends strictly by currency and year
      const filteredWeeks = weeklyTrends.filter((w) => {
        if (w.currency !== activeCurrency) return false
        if (!w.week || typeof w.week !== 'string') return false
        if (isYearFilter && !w.week.startsWith(yearStr)) return false
        const amt = typeof w.total_amount === 'string' ? parseFloat(w.total_amount) : w.total_amount
        return !isNaN(amt) && amt >= 0
      })

      // Sort chronologically
      const sorted = [...filteredWeeks].sort((a, b) => a.week.localeCompare(b.week))

      return sorted.map((w) => {
        const amt = typeof w.total_amount === 'string' ? parseFloat(w.total_amount) : w.total_amount
        return {
          periodKey: w.week,
          label: w.week_label || w.week,
          fullLabel: `Week ${w.week.split('-W')[1] || w.week} (${w.week_start || ''})`,
          actual: Math.round(amt * 100) / 100,
          budget: weeklyBudget,
          count: w.transaction_count || 1,
          currency: activeCurrency,
        }
      })
    }

    // Monthly baseline points
    const filteredMonths = monthlyTrends.filter((m) => {
      if (m.currency !== activeCurrency) return false
      if (!m.month || typeof m.month !== 'string') return false
      if (isYearFilter && !m.month.startsWith(yearStr)) return false
      const amt = typeof m.total_amount === 'string' ? parseFloat(m.total_amount) : m.total_amount
      return !isNaN(amt) && amt >= 0
    })

    const sorted = [...filteredMonths].sort((a, b) => a.month.localeCompare(b.month))

    const monthlyPoints: TrendDataPoint[] = sorted.map((m) => {
      const parsed = parseYearMonth(m.month)
      const amt = typeof m.total_amount === 'string' ? parseFloat(m.total_amount) : m.total_amount
      const label = parsed ? `${MONTH_SHORT[parsed.month - 1]} '${String(parsed.year).slice(-2)}` : m.month
      const fullLabel = parsed ? `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` : m.month

      return {
        periodKey: m.month,
        label,
        fullLabel,
        actual: Math.round(amt * 100) / 100,
        budget: monthlyBudget,
        count: m.transaction_count || 1,
        currency: activeCurrency,
      }
    })

    if (mode === 'monthly') {
      return monthlyPoints
    }

    // Cumulative mode: calculate running total over the selected period
    let runningActual = 0
    return monthlyPoints.map((pt, idx) => {
      runningActual += pt.actual
      return {
        ...pt,
        actual: Math.round(runningActual * 100) / 100,
        budget: (idx + 1) * monthlyBudget,
        fullLabel: `Cumulative to ${pt.fullLabel}`,
      }
    })
  }, [mode, effectiveYear, monthlyTrends, weeklyTrends, activeCurrency, monthlyBudget, weeklyBudget])

  // Target budget for reference line display
  const activeTargetValue = mode === 'weekly' ? weeklyBudget : monthlyBudget
  const targetLabel =
    mode === 'weekly'
      ? `${formatCompactCurrency(weeklyBudget, activeCurrency)} Weekly Target`
      : mode === 'monthly'
      ? `${formatCompactCurrency(monthlyBudget, activeCurrency)} Monthly Target`
      : `${formatCompactCurrency(monthlyBudget, activeCurrency)} Baseline/mo`

  // 3. Derived Year options for selector
  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    set.add(String(CURRENT_CALENDAR_YEAR))
    availableYears.forEach((y) => set.add(String(y)))
    const list = Array.from(set).sort((a, b) => b.localeCompare(a))
    return list
  }, [availableYears])

  // Determine overall database transaction presence
  const hasAnyTransactionsAllTime =
    (totalTransactionsAllTime !== undefined && totalTransactionsAllTime > 0) ||
    availableYears.length > 0 ||
    monthlyTrends.length > 0 ||
    weeklyTrends.length > 0

  // Keyboard navigation for mode tabs
  const handleModeKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentMode: ChartCalculationMode
  ) => {
    const modes: ChartCalculationMode[] = ['weekly', 'monthly', 'cumulative']
    const currentIndex = modes.indexOf(currentMode)
    let nextIndex = currentIndex

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % modes.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (currentIndex - 1 + modes.length) % modes.length
    }

    if (nextIndex !== currentIndex) {
      setMode(modes[nextIndex])
    }
  }

  // --- 1. Loading State ---
  if (isLoading) {
    return (
      <div
        className={`bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md ${className}`}
        role="region"
        aria-label="Monthly Expense Trend Chart"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 animate-pulse">
          <div>
            <div className="h-6 w-52 bg-surface-container rounded" />
            <div className="h-4 w-72 bg-surface-container-low rounded mt-1.5" />
          </div>
          <div className="h-8 w-48 bg-surface-container rounded-lg" />
        </div>
        <div className="h-52 sm:h-64 w-full flex items-end justify-around gap-4 px-6 pt-10 pb-4 border-b border-surface-container animate-pulse">
          <div className="w-12 h-1/4 bg-surface-container-low rounded-t-lg" />
          <div className="w-12 h-3/5 bg-surface-container rounded-t-lg" />
          <div className="w-12 h-2/5 bg-surface-container-low rounded-t-lg" />
          <div className="w-12 h-4/5 bg-surface-container rounded-t-lg" />
        </div>
      </div>
    )
  }

  // --- 2. Error State ---
  if (isError) {
    return (
      <div
        className={`bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md ${className}`}
        role="alert"
        aria-label="Monthly Expense Trend Error"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
            Monthly Expense Trend ({effectiveYear || 'All Time'})
          </h3>
        </div>
        <div className="p-space-lg rounded-xl bg-error-container/40 border border-error/30 text-on-surface flex flex-col items-center justify-center text-center gap-3 my-2">
          <div className="w-10 h-10 rounded-full bg-error-container flex items-center justify-center text-error">
            <span className="material-symbols-outlined text-[22px]">error_outline</span>
          </div>
          <div>
            <p className="font-headline-sm text-sm font-semibold text-on-surface">
              Failed to load expense trend analytics
            </p>
            <p className="font-body-sm text-xs text-on-surface-variant mt-0.5 max-w-md">
              There was a problem querying the transaction records from your local ledger.
            </p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg text-xs font-semibold transition-all shadow-xs"
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
      className={`bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md ${className}`}
      role="region"
      aria-label="Monthly Expense Trend Chart"
    >
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-surface-container/60">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
              Monthly Expense Trend ({effectiveYear || 'All Time'})
            </h2>
            {chartPoints.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container text-primary font-table-numeric">
                {formatCurrency(
                  chartPoints.reduce((acc, p) => (mode === 'cumulative' ? p.actual : acc + p.actual), 0),
                  activeCurrency
                )}
              </span>
            )}
          </div>
          <span className="font-body-sm text-xs text-on-surface-variant">
            Historical trailing local ledger vs {formatCurrency(monthlyBudget, activeCurrency)} baseline budget
          </span>
        </div>

        {/* Action Controls: Year Selector + Multi-Currency + Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Year Selector Dropdown */}
          <div className="relative">
            <select
              aria-label="Select Year"
              value={effectiveYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-xs font-semibold border border-outline-variant/30 focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              {yearOptions.map((y) => {
                const hasRecords = availableYears.includes(Number(y))
                return (
                  <option key={y} value={y}>
                    {y} {hasRecords ? '' : '(No data)'}
                  </option>
                )
              })}
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Multi-Currency Toggle */}
          {availableCurrencies.length > 1 ? (
            <div
              className="flex items-center bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/30 text-xs"
              role="radiogroup"
              aria-label="Select currency"
            >
              {availableCurrencies.map((curr) => (
                <button
                  key={curr}
                  type="button"
                  role="radio"
                  aria-checked={activeCurrency === curr}
                  onClick={() => setSelectedCurrency(curr)}
                  className={`px-2 py-0.5 rounded text-xs font-label-caps transition-colors ${
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
            <span className="px-2 py-0.5 rounded bg-surface-container-low text-on-surface-variant text-[11px] font-label-caps border border-outline-variant/20">
              {activeCurrency}
            </span>
          ) : null}

          {/* Weekly / Monthly / Cumulative Mode Tabs */}
          <div
            className="flex items-center bg-surface-container-low p-0.5 sm:p-1 rounded-lg self-start sm:self-auto border border-outline-variant/20"
            role="tablist"
            aria-label="Calculation Mode"
          >
            {(['weekly', 'monthly', 'cumulative'] as const).map((tabMode) => {
              const label =
                tabMode === 'weekly' ? 'Weekly' : tabMode === 'monthly' ? 'Monthly' : 'Cumulative'
              const isSelected = mode === tabMode
              return (
                <button
                  key={tabMode}
                  type="button"
                  role="tab"
                  id={`trend-tab-${tabMode}`}
                  aria-selected={isSelected}
                  aria-controls="trend-chart-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setMode(tabMode)}
                  onKeyDown={(e) => handleModeKeyDown(e, tabMode)}
                  className={`px-2 sm:px-2.5 py-1 rounded text-xs font-label-caps transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
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
        </div>
      </div>

      {/* Chart Canvas or Informative Empty State */}
      <div
        id="trend-chart-panel"
        role="tabpanel"
        aria-labelledby={`trend-tab-${mode}`}
        className="relative w-full h-56 sm:h-64 md:h-72 select-none"
      >
        {chartPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartPoints}
              margin={{ top: 16, right: 16, left: 0, bottom: 4 }}
              onMouseMove={(state) => {
                if (state && typeof state.activeTooltipIndex === 'number') {
                  setActiveBarIndex(state.activeTooltipIndex)
                }
              }}
              onMouseLeave={() => setActiveBarIndex(null)}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00603c" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                </linearGradient>
                <linearGradient id={`${gradientId}-hover`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#004d30" stopOpacity={1} />
                  <stop offset="100%" stopColor="#007a4d" stopOpacity={0.9} />
                </linearGradient>
              </defs>

              {/* Light horizontal gridlines */}
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e4eade"
                strokeOpacity={0.8}
              />

              {/* Readable period labels */}
              <XAxis
                dataKey="label"
                stroke="#6f7a71"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#bec9c0' }}
                tick={{ fill: '#5c675e' }}
                padding={{ left: 24, right: 24 }}
              />

              {/* Currency-formatted axis ticks */}
              <YAxis
                stroke="#6f7a71"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5c675e' }}
                tickFormatter={(v) => formatCompactCurrency(v, activeCurrency)}
                width={56}
              />

              {/* Interactive Tooltip showing period, actual expenses, and budget target */}
              <Tooltip
                cursor={{ fill: 'rgba(0, 96, 60, 0.05)', radius: 6 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload as TrendDataPoint
                    const diff = data.budget - data.actual
                    const isUnder = diff >= 0
                    return (
                      <div className="bg-[#161d16] text-white p-3 rounded-xl shadow-lg border border-[#2a322a] text-xs space-y-1.5 min-w-[200px]">
                        <div className="flex items-center justify-between border-b border-[#2a322a] pb-1.5 font-semibold text-white/90">
                          <span>{data.fullLabel}</span>
                          <span className="font-table-numeric text-[#84d8a8] text-[11px] font-bold">
                            {data.currency}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-0.5">
                          <span className="text-[#bec9c0] text-[11px]">Actual Expenses:</span>
                          <span className="font-bold text-white font-table-numeric text-sm">
                            {formatCurrency(data.actual, data.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#bec9c0]">
                          <span>Budget Target:</span>
                          <span className="font-table-numeric font-medium text-[#ffdcc3]">
                            {formatCurrency(data.budget, data.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-0.5 border-t border-[#2a322a]">
                          <span>Status:</span>
                          <span
                            className={`font-table-numeric font-semibold ${
                              isUnder ? 'text-[#84d8a8]' : 'text-[#ffb4ab]'
                            }`}
                          >
                            {isUnder
                              ? `Under budget by ${formatCurrency(diff, data.currency)}`
                              : `Over budget by ${formatCurrency(Math.abs(diff), data.currency)}`}
                          </span>
                        </div>
                        {data.count > 0 && (
                          <div className="text-[10px] text-[#bec9c0] pt-0.5">
                            {data.count} transaction{data.count === 1 ? '' : 's'} recorded
                          </div>
                        )}
                      </div>
                    )
                  }
                  return null
                }}
              />

              {/* In Monthly/Weekly mode: horizontal dashed ReferenceLine */}
              {mode !== 'cumulative' && (
                <ReferenceLine
                  y={activeTargetValue}
                  stroke="#a45800"
                  strokeDasharray="4 4"
                  label={{
                    value: targetLabel,
                    position: 'top',
                    fill: '#814400',
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                />
              )}

              {/* In Cumulative mode: cumulative target line */}
              {mode === 'cumulative' && (
                <Line
                  type="monotone"
                  dataKey="budget"
                  stroke="#a45800"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={{ r: 3, fill: '#a45800' }}
                  name="Cumulative Target"
                />
              )}

              {/* Rounded vertical bars */}
              <Bar
                dataKey="actual"
                fill={`url(#${gradientId})`}
                radius={[6, 6, 2, 2]}
                maxBarSize={44}
                name="Actual Spend"
              >
                {chartPoints.map((_entry, index) => (
                  <Cell
                    key={`trend-cell-${index}`}
                    fill={
                      activeBarIndex === index
                        ? `url(#${gradientId}-hover)`
                        : `url(#${gradientId})`
                    }
                    stroke={activeBarIndex === index ? '#00603c' : 'none'}
                    strokeWidth={activeBarIndex === index ? 1.5 : 0}
                  />
                ))}
                <LabelList
                  dataKey="actual"
                  position="top"
                  formatter={(val: any) => formatCompactCurrency(val, activeCurrency)}
                  style={{
                    fill: '#3f4942',
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: 'Inter',
                  }}
                />
              </Bar>

              {/* Overlay green trend line connecting periods */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#00603c"
                strokeWidth={2.5}
                dot={{ r: 4.5, fill: '#00603c' }}
                activeDot={{ r: 6.5, fill: '#00603c', stroke: '#f3fcef', strokeWidth: 2 }}
                name="Actual Trajectory"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          /* Informative Empty State */
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 bg-surface-container-low/40 rounded-xl p-6 text-center border border-dashed border-outline-variant/40">
            {hasAnyTransactionsAllTime && availableYears.length > 0 ? (
              // Case: Selected year has no data, but transactions exist in other years
              <div className="max-w-md flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline mb-1.5">
                  <span className="material-symbols-outlined text-[22px]">calendar_today</span>
                </div>
                <p className="font-headline-sm text-sm font-semibold text-on-surface">
                  No expenses recorded for {effectiveYear || 'selected period'}
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 leading-relaxed">
                  There are no transactions recorded in {effectiveYear}. Recorded transactions exist in{' '}
                  <span className="font-semibold text-primary">{availableYears.join(', ')}</span>.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleYearChange(availableYears[0])}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg text-xs font-semibold transition-all shadow-xs active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[16px]">history</span>
                    <span>View {availableYears[0]} Records</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleYearChange('all')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg text-xs font-semibold transition-all shadow-xs"
                  >
                    <span>View All Time</span>
                  </button>
                </div>
              </div>
            ) : (
              // Case: Genuinely empty database
              <div className="max-w-xs flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-outline mb-1.5">
                  <span className="material-symbols-outlined text-[22px]">show_chart</span>
                </div>
                <p className="font-headline-sm text-sm font-semibold text-on-surface">
                  No transactions recorded yet
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Upload receipts to populate monthly trend trajectory and spending velocity.
                </p>
                <Link
                  to="/upload"
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-lg text-xs font-semibold transition-all shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Upload receipt</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-on-surface-variant font-label-caps text-[10px] sm:text-label-caps border-t border-surface-container-low">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-1.5 rounded-xs bg-primary" /> Actual Expenses
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-tertiary-container border-b border-dashed border-tertiary-container" />{' '}
            Target ({formatCurrency(activeTargetValue, activeCurrency)})
          </span>
        </div>
        <div className="text-outline text-[11px]">
          {mode === 'monthly'
            ? 'Monthly baseline target'
            : mode === 'weekly'
            ? 'Weekly pro-rated baseline'
            : 'Cumulative running target'}
        </div>
      </div>

      {/* Screen-reader accessible data table for accessibility compliance */}
      <div className="sr-only">
        <table>
          <caption>Expense Trend ({effectiveYear || 'All Time'})</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Actual Spend</th>
              <th scope="col">Budget Target</th>
              <th scope="col">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {chartPoints.map((pt) => (
              <tr key={pt.periodKey}>
                <td>{pt.label} ({pt.fullLabel})</td>
                <td>{formatCurrency(pt.actual, pt.currency)}</td>
                <td>{formatCurrency(pt.budget, pt.currency)}</td>
                <td>{pt.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
