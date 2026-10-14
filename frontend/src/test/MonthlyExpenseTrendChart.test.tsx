import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MonthlyExpenseTrendChart } from '../features/dashboard/components/MonthlyExpenseTrendChart'
import type { MonthlySpendTrend, WeeklySpendTrend, CurrencyTotal } from '../types'

describe('MonthlyExpenseTrendChart', () => {
  const sampleMonthlyTrends: MonthlySpendTrend[] = [
    {
      month: '2019-01',
      currency: 'MYR',
      total_amount: '363.00',
      transaction_count: 2,
    },
    {
      month: '2019-02',
      currency: 'MYR',
      total_amount: '120.00',
      transaction_count: 1,
    },
  ]

  const sampleWeeklyTrends: WeeklySpendTrend[] = [
    {
      week: '2019-W01',
      week_start: '2018-12-31',
      week_label: 'W01 (Dec 31)',
      currency: 'MYR',
      total_amount: '170.00',
      transaction_count: 1,
    },
    {
      week: '2019-W03',
      week_start: '2019-01-14',
      week_label: 'W03 (Jan 14)',
      currency: 'MYR',
      total_amount: '193.00',
      transaction_count: 1,
    },
  ]

  const sampleCurrencyTotals: CurrencyTotal[] = [
    {
      currency: 'MYR',
      total_amount: '483.00',
      transaction_count: 3,
      average_amount: '161.00',
    },
  ]

  // Test 1: Transactions dated January 2019 appear when 2019 is selected.
  it('1. displays transactions dated January 2019 when 2019 is selected', () => {
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2019}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends}
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
          monthlyBudget={5000}
        />
      </MemoryRouter>
    )

    // Chart header reflects selected year
    expect(screen.getByText('Monthly Expense Trend (2019)')).toBeInTheDocument()

    // Total spend reflects 2019 data (363.00 + 120.00 = 483.00 MYR)
    expect(screen.getAllByText(/MYR\s*483\.00|RM\s*483\.00/i).length).toBeGreaterThan(0)

    // X-axis and data points contain Jan '19
    expect(screen.getAllByText(/Jan\s*'19/i).length).toBeGreaterThan(0)
  })

  // Test 2: The 2026 view accurately reports whether data exists.
  it('2. accurately reports when no data exists in 2026 and offers years with records', () => {
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2026}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends} // has 2019, none in 2026
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
          monthlyBudget={5000}
        />
      </MemoryRouter>
    )

    // Clear informative message for 2026
    expect(screen.getByText('No expenses recorded for 2026')).toBeInTheDocument()
    expect(screen.getByText(/Recorded transactions exist in/i)).toBeInTheDocument()
    expect(screen.getAllByText('2019').length).toBeGreaterThan(0)

    // Action button to view 2019 records
    expect(screen.getByRole('button', { name: /View 2019 Records/i })).toBeInTheDocument()
  })

  // Test 3: Changing the year updates the chart.
  it('3. updates the chart when the year is changed', () => {
    const handleYearChange = vi.fn()
    const { rerender } = render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2026}
          onYearChange={handleYearChange}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends}
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
        />
      </MemoryRouter>
    )

    // In 2026: empty message with switch button
    const switchBtn = screen.getByRole('button', { name: /View 2019 Records/i })
    fireEvent.click(switchBtn)
    expect(handleYearChange).toHaveBeenCalledWith(2019)

    // Rerender with 2019
    rerender(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2019}
          onYearChange={handleYearChange}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends}
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
        />
      </MemoryRouter>
    )

    // Now renders 2019 title and data
    expect(screen.getByText('Monthly Expense Trend (2019)')).toBeInTheDocument()
    expect(screen.getAllByText(/Jan\s*'19/i).length).toBeGreaterThan(0)
  })

  // Test 4: Weekly, monthly, and cumulative modes calculate correctly.
  it('4. calculates weekly, monthly, and cumulative modes distinctly and correctly', () => {
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2019}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends}
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
          monthlyBudget={5000}
        />
      </MemoryRouter>
    )

    const weeklyTab = screen.getByRole('tab', { name: 'Weekly' })
    const monthlyTab = screen.getByRole('tab', { name: 'Monthly' })
    const cumulativeTab = screen.getByRole('tab', { name: 'Cumulative' })

    // Default is Monthly
    expect(monthlyTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Monthly baseline target/i)).toBeInTheDocument()

    // 1. Switch to Weekly Mode
    fireEvent.click(weeklyTab)
    expect(weeklyTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Weekly pro-rated baseline/i)).toBeInTheDocument()
    // Weekly labels W01 and W03 are rendered
    expect(screen.getAllByText(/W01/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/W03/i).length).toBeGreaterThan(0)

    // 2. Switch to Cumulative Mode
    fireEvent.click(cumulativeTab)
    expect(cumulativeTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Cumulative running target/i)).toBeInTheDocument()
  })

  // Test 5: Mixed currencies are not added together.
  it('5. isolates mixed currencies and does not add them into a single total', () => {
    const multiCurrencyTrends: MonthlySpendTrend[] = [
      {
        month: '2019-01',
        currency: 'MYR',
        total_amount: '363.00',
        transaction_count: 2,
      },
      {
        month: '2019-01',
        currency: 'USD',
        total_amount: '50.00',
        transaction_count: 1,
      },
    ]

    const multiCurrencyTotals: CurrencyTotal[] = [
      {
        currency: 'MYR',
        total_amount: '363.00',
        transaction_count: 2,
        average_amount: '181.50',
      },
      {
        currency: 'USD',
        total_amount: '50.00',
        transaction_count: 1,
        average_amount: '50.00',
      },
    ]

    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2019}
          availableYears={[2019]}
          monthlyTrends={multiCurrencyTrends}
          weeklyTrends={[]}
          currencyTotals={multiCurrencyTotals}
          totalTransactionsAllTime={3}
        />
      </MemoryRouter>
    )

    // Currency radio options exist
    const myrRadio = screen.getByRole('radio', { name: 'MYR' })
    const usdRadio = screen.getByRole('radio', { name: 'USD' })
    expect(myrRadio).toBeInTheDocument()
    expect(usdRadio).toBeInTheDocument()

    // In MYR mode (default), total is 363.00 (NOT 413.00!)
    expect(screen.getAllByText(/MYR\s*363\.00|RM\s*363\.00/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/413\.00/i)).not.toBeInTheDocument()

    // Switch to USD
    fireEvent.click(usdRadio)
    expect(usdRadio).toHaveAttribute('aria-checked', 'true')
    expect(screen.getAllByText(/\$50\.00|USD\s*50\.00/i).length).toBeGreaterThan(0)
  })

  // Test 6: A genuinely empty database displays the empty state.
  it('6. displays empty state when the database is genuinely empty', () => {
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2026}
          availableYears={[]}
          monthlyTrends={[]}
          weeklyTrends={[]}
          currencyTotals={[]}
          totalTransactionsAllTime={0}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('No transactions recorded yet')).toBeInTheDocument()
    expect(
      screen.getByText(/Upload receipts to populate monthly trend trajectory/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Upload receipt/i })).toBeInTheDocument()
    // Should NOT mention "Recorded transactions exist in"
    expect(screen.queryByText(/Recorded transactions exist in/i)).not.toBeInTheDocument()
  })

  // Test 7: API failures display an error rather than a false empty state.
  it('7. displays error state with retry button on API failures', () => {
    const handleRetry = vi.fn()
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2026}
          isError={true}
          onRetry={handleRetry}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText('Failed to load expense trend analytics')
    ).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)

    // Should NOT show false empty state message
    expect(screen.queryByText('No transactions recorded yet')).not.toBeInTheDocument()
  })

  // Test 8: The chart renders individual values and the budget target correctly.
  it('8. renders individual values and budget target correctly', () => {
    render(
      <MemoryRouter>
        <MonthlyExpenseTrendChart
          selectedYear={2019}
          availableYears={[2019]}
          monthlyTrends={sampleMonthlyTrends}
          weeklyTrends={sampleWeeklyTrends}
          currencyTotals={sampleCurrencyTotals}
          totalTransactionsAllTime={3}
          monthlyBudget={5000}
        />
      </MemoryRouter>
    )

    // Renders budget target in subtitle and legend
    expect(
      screen.getByText(/vs\s*MYR\s*5,000\.00\s*baseline budget|vs\s*RM\s*5,000\.00\s*baseline budget/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/Target \(MYR\s*5,000\.00\)|Target \(RM\s*5,000\.00\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Actual Expenses/i)).toBeInTheDocument()
  })
})
