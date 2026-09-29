function PortfolioSummary({ portfolio, portfolioValue, pnl }) {
    console.log("PNL VALUE:", pnl.totalPnL)
    console.log("PORTFOLIO VALUE:", portfolioValue.totalValue)
    return (
      <section>
        <h2>Portfolio Summary</h2>
  
        <div>
          <h3>Cash</h3>
          <p>${Number(portfolio.portfolio.cash).toFixed(2)}</p>
        </div>
  
        <div>
          <h3>Portfolio Value</h3>
          <p>${Number(portfolioValue.totalValue).toFixed(2)}</p>
        </div>
  
        <div>
          <h3>Total P/L</h3>
          <p>${Number(pnl.totalPnL).toFixed(2)}</p>
        </div>
      </section>
    )
  }
  
  export default PortfolioSummary