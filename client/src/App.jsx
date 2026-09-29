import { useEffect, useState } from 'react'
import Header from './components/Header'
import PortfolioSummary from './components/PortfolioSummary'

function App() {
  const [portfolio, setPortfolio] = useState(null)
  const [portfolioValue, setPortfolioValue] = useState(null)
  const [pnl, setPnl] = useState(null)

  useEffect(() => {
    fetch('http://localhost:3000/portfolio')
      .then(response => response.json())
      .then(data => setPortfolio(data))

    fetch('http://localhost:3000/portfolio/value')
      .then(response => response.json())
      .then(data => setPortfolioValue(data))

    fetch('http://localhost:3000/portfolio/pnl')
      .then(response => response.json())
      .then(data => setPnl(data))
  }, [])

  if (!portfolio || !portfolioValue || !pnl) {
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
    </div>
  )
}

export default App