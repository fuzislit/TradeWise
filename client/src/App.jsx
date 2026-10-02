
import { useEffect, useState } from 'react'
import Header from './components/Header'
import PortfolioSummary from './components/PortfolioSummary'
import Holdings from './components/Holdings'
import './App.css'

function App() {
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioValue, setPortfolioValue] = useState(null)
  const [pnl, setPnl] = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [error, setError] = useState('')
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState(1)
  const [tradeType, setTradeType] = useState('buy')
  const [tradeMessage, setTradeMessage] = useState('')

  async function handleTrade(event) {
    event.preventDefault()
    setTradeMessage('')
  
    try {
      const response = await fetch(`http://localhost:3000/${tradeType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol: symbol.trim().toUpperCase(),
          shares: Number(shares)
        })
      })
  
      const data = await response.json()
  
      if (!response.ok) {
        throw new Error(data.message || 'Trade failed')
      }
  
      window.location.reload()
    } catch (error) {
      setTradeMessage(error.message)
    }
  }
  

  useEffect(() => {
    fetch('http://localhost:3000/portfolio')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load portfolio')
        }
        return response.json()
      })
      .then(data => setPortfolio(data))
      .catch(error => setError(error.message))

    fetch('http://localhost:3000/portfolio/value')
      .then(response => response.json())
      .then(data => {
        if (data.message) {
          throw new Error(data.message)
        }
        setPortfolioValue(data)
      })
      .catch(error => setError(error.message))


      fetch('http://localhost:3000/portfolio/pnl')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load profit and loss')
        }
        return response.json()
      })
      .then(data => {
        setPnl(data)
      })
      .catch(error => {
        console.error('P/L error:', error)
        setError(error.message)
      })

    fetch('http://localhost:3000/transactions')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to load transactions')
        }
        return response.json()
      })
      .then(data => setTransactions(data))
      .catch(error => setError(error.message))
  }, [])

  if (error) {
    return <p>Could not load dashboard: {error}</p>
  }

  if (!portfolio || !portfolioValue || !pnl || !transactions) {
    return <p>Loading portfolio...</p>
  }

  return (
    <div>
      <Header />

      <PortfolioSummary
        portfolio={portfolio}
        portfolioValue={portfolioValue}
        pnl={pnl}
      />
      <section>
  <h2>Trade Stocks</h2>

  <form onSubmit={handleTrade}>
    <label>
      Action:
      <select
        value={tradeType}
        onChange={(event) => setTradeType(event.target.value)}
      >
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
    </label>

    <label>
      Stock Symbol:
      <input
        type="text"
        value={symbol}
        onChange={(event) => setSymbol(event.target.value)}
        placeholder="e.g. AAPL"
        required
      />
    </label>

    <label>
      Shares:
      <input
        type="number"
        min="1"
        step="1"
        value={shares}
        onChange={(event) => setShares(event.target.value)}
        required
      />
    </label>

    <button type="submit">
      Submit Trade
    </button>
  </form>

  {tradeMessage && <p>{tradeMessage}</p>}
</section>

      <Holdings
        holdings={portfolio.holdings}
        transactions={transactions}
      />
    </div>
  )
}

export default App