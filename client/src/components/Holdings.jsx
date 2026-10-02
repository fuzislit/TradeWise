
function Holdings({ holdings, transactions }) {
    return (
      <section>
        <h2>My Holdings</h2>
  
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Shares</th>
              <th>Average Cost</th>
            </tr>
          </thead>
  
          <tbody>
            {holdings.map((holding) => {
              // 1. Get this stock's transactions
              const stockTransactions = transactions.filter(
                (transaction) => transaction.symbol === holding.symbol
              )
  
              // 2. Reconstruct the remaining shares' cost basis
              let totalCost = 0
              let totalShares = 0
  
              for (const transaction of stockTransactions) {
                if (transaction.type === 'BUY') {
                  totalCost += Number(transaction.shares) * Number(transaction.price)
                  totalShares += Number(transaction.shares)
                } else if (transaction.type === 'SELL' && totalShares > 0) {
                  const averageCost = totalCost / totalShares
                  totalCost -= averageCost * Number(transaction.shares)
                  totalShares -= Number(transaction.shares)
                }
              }
  
              // 3. Calculate average purchase cost
              const averageCost =
                totalShares > 0 ? totalCost / totalShares : 0
  
              // 4. Return one row for this holding
              return (
                <tr key={holding.symbol}>
                  <td>{holding.symbol}</td>
                  <td>{holding.shares}</td>
                  <td>${averageCost.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    )
  }
  
  export default Holdings