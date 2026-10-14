import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { MonthlyExpenditureChart } from '../features/reports/components/MonthlyExpenditureChart'
import type { MonthlySpendTrend, CurrencyTotal } from '../types'

describe('MonthlyExpenditureChart', () => {
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
      total_amount: '120.50',
      transaction_count: 1,
    },
    {
      month: '2019-01',
      currency: 'USD',
      total_amount: '50.00',
      transaction_count: 1,
    },
  ]

  const sampleCurrencyTotals: CurrencyTotal[] = [
    {
      currency: 'MYR',
      total_amount: '483.50',
      transaction_count: 3,
      average_amount: '161.17',
    },
    {
      currency: 'USD',
      total_amount: '50.00',
      transaction_count: 1,
      average_amount: '50.00',
    },
  ]

  it('renders chart title, subtitle, and primary currency badge', () => {
    render(
      <MonthlyExpenditureChart
        monthlyTrends={sampleMonthlyTrends}
        currencyTotals={sampleCurrencyTotals}
      />
    )

    expect(screen.getByText('Monthly Expenditure Volume')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Aggregated expenditure patterns computed directly from local transaction ledger'
      )
    ).toBeInTheDocument()

    // Default primary currency is MYR (first in currencyTotals)
    // Total for MYR = 363.00 + 120.50 = 483.50
    expect(screen.getAllByText(/MYR\s*483\.50|RM\s*483\.50/i).length).toBeGreaterThan(0)
  })

  it('isolates currencies and provides accessible currency selection', () => {
    render(
      <MonthlyExpenditureChart
        monthlyTrends={sampleMonthlyTrends}
        currencyTotals={sampleCurrencyTotals}
      />
    )

    // Currency radio buttons should be present because both MYR and USD exist
    const myrButton = screen.getByRole('radio', { name: 'MYR' })
    const usdButton = screen.getByRole('radio', { name: 'USD' })

    expect(myrButton).toBeInTheDocument()
    expect(usdButton).toBeInTheDocument()
    expect(myrButton).toHaveAttribute('aria-checked', 'true')
    expect(usdButton).toHaveAttribute('aria-checked', 'false')

    // Switch to USD
    fireEvent.click(usdButton)
    expect(usdButton).toHaveAttribute('aria-checked', 'true')
    expect(myrButton).toHaveAttribute('aria-checked', 'false')

    // In USD, total is $50.00
    expect(screen.getAllByText(/\$50\.00|USD\s*50\.00/i).length).toBeGreaterThan(0)
  })

  it('supports Monthly, Quarterly, and Yearly aggregation periods', () => {
    render(
      <MonthlyExpenditureChart
        monthlyTrends={sampleMonthlyTrends}
        currencyTotals={sampleCurrencyTotals}
      />
    )

    const monthlyTab = screen.getByRole('tab', { name: 'Monthly' })
    const quarterlyTab = screen.getByRole('tab', { name: 'Quarterly' })
    const yearlyTab = screen.getByRole('tab', { name: 'Yearly' })

    expect(monthlyTab).toHaveAttribute('aria-selected', 'true')
    expect(quarterlyTab).toHaveAttribute('aria-selected', 'false')
    expect(yearlyTab).toHaveAttribute('aria-selected', 'false')

    // Switch to Quarterly
    fireEvent.click(quarterlyTab)
    expect(quarterlyTab).toHaveAttribute('aria-selected', 'true')
    expect(monthlyTab).toHaveAttribute('aria-selected', 'false')

    // Check summary strip updates
    expect(screen.getByText(/Quarterly Spend/i)).toBeInTheDocument()

    // Switch to Yearly
    fireEvent.click(yearlyTab)
    expect(yearlyTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/Annual Spend/i)).toBeInTheDocument()
  })

  it('does not fabricate zero-spending months (preserves only real data points)', () => {
    // Only one month in 2019
    const singleMonthTrends: MonthlySpendTrend[] = [
      {
        month: '2019-01',
        currency: 'MYR',
        total_amount: '363.00',
        transaction_count: 2,
      },
    ]

    render(
      <MonthlyExpenditureChart
        monthlyTrends={singleMonthTrends}
        currencyTotals={[{ currency: 'MYR', total_amount: '363.00', transaction_count: 2, average_amount: '181.50' }]}
      />
    )

    // Summary strip should report exactly 1 month recorded
    expect(screen.getByText(/2 transactions in 1 month/i)).toBeInTheDocument()
  })

  it('renders empty state when monthly trends are empty', () => {
    render(<MonthlyExpenditureChart monthlyTrends={[]} currencyTotals={[]} />)

    expect(screen.getByText('No transactions recorded')).toBeInTheDocument()
    expect(
      screen.getByText(/No spending data points found for currency/i)
    ).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true', () => {
    render(<MonthlyExpenditureChart isLoading={true} />)

    const container = screen.getByLabelText(/Monthly Expenditure Volume/i, { selector: 'div' })
    expect(container).toHaveAttribute('aria-busy', 'true')
  })

  it('renders error state and retry button when isError is true', () => {
    const handleRetry = vi.fn()
    render(<MonthlyExpenditureChart isError={true} onRetry={handleRetry} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Unable to load expenditure volume')).toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })

  it('allows toggling value labels above bars', () => {
    render(
      <MonthlyExpenditureChart
        monthlyTrends={sampleMonthlyTrends}
        currencyTotals={sampleCurrencyTotals}
      />
    )

    const toggleBtn = screen.getByLabelText(/Hide values above bars/i)
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-pressed', 'false')
  })
})
