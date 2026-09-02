require("dotenv").config(); // configuration for the API key

const express = require("express");
const pool = require("./db");
const https = require("https");

function getStockPrice(symbol) {
    return new Promise((resolve, reject) => {

        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

        https.get(url, (response) => {
            let data = "";
            response.on("data", (chunk) => {
                data += chunk;
            });

            response.on("end", () => {
                try {
                    const stockData = JSON.parse(data);

                    if (!stockData["Global Quote"]) {
                        reject(new Error(
                            stockData["Information"] || "Stock price unavailable"
                        ));
                        return;
                    }
                    const price = stockData["Global Quote"]["05. price"];

                    if (!price) {
                        reject(new Error("Stock price not found"));
                        return;
                    }
                    resolve(Number(price));
                } catch (error) {
                    reject(error);
                }
            });

        }).on("error", (error) => {
            reject(error);
        });
    });
}

function calculateRealizedPnL(transactions) {

    let realizedPnL = 0;
    const holdings = {};

    for (const transaction of transactions) {

        const { symbol, type, shares, price } = transaction;

        if (!holdings[symbol]) {
            holdings[symbol] = {
                shares: 0,
                totalCost: 0
            };
        }

        if (type === "BUY") {

            holdings[symbol].shares += Number(shares);
            holdings[symbol].totalCost += Number(shares) * Number(price);

        } else if (type === "SELL") {

            if (holdings[symbol].shares === 0) {
                continue;
            }

            const averageCost =holdings[symbol].totalCost / holdings[symbol].shares;
            const costOfSharesSold = averageCost * Number(shares);
            const saleRevenue = Number(price) * Number(shares);

            realizedPnL += saleRevenue - costOfSharesSold;
            holdings[symbol].shares -= Number(shares);
            holdings[symbol].totalCost -= costOfSharesSold;
        }
    }
    return Number(realizedPnL.toFixed(2));
}

async function calculateUnrealizedPnL(transactions, holdings) {

    let unrealizedPnL = 0;

    for (const holding of holdings) {

        const symbol = holding.symbol;
        const shares = Number(holding.shares);

        let totalCost = 0;
        let totalShares = 0;

        for (const transaction of transactions) {

            if (transaction.symbol !== symbol) {
                continue;
            }

            if (transaction.type === "BUY") {

                totalCost +=
                    Number(transaction.shares) *
                    Number(transaction.price);

                totalShares += Number(transaction.shares);

            } else if (transaction.type === "SELL") {

                if (totalShares === 0) {
                    continue;
                }

                const averageCost = totalCost / totalShares;
                totalCost -= averageCost * Number(transaction.shares);
                totalShares -= Number(transaction.shares);
            }
        }

        const averageCost = totalCost / totalShares;
        const currentPrice = await getStockPrice(symbol);
        await new Promise(resolve => setTimeout(resolve, 1000)); // API REQUEST LIMIT

        unrealizedPnL += (currentPrice - averageCost) * shares;
    }

    return Number(unrealizedPnL.toFixed(2));
}

const app = express();

app.use(express.json());

const PORT = 3000;


// Home
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to TradeWise!",
        status: "Backend is running!"
    });
});


// BUY
app.post("/buy", async (req, res) => {
    try {

        let { symbol, shares } = req.body;

        if (!symbol || !shares || shares <= 0) {
            return res.status(400).json({
                message: "Symbol and shares must be valid"
            });
        }

        symbol = symbol.toUpperCase().trim();

        const price = await getStockPrice(symbol);
        const total = price * shares;

        const portfolioResult = await pool.query(
            "SELECT * FROM portfolio WHERE id = $1",
            [1]
        );

        const portfolio = portfolioResult.rows[0];

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        if (Number(portfolio.cash) < total) {
            return res.status(400).json({
                message: "Insufficient funds"
            });
        }

        const newCash = Number(portfolio.cash) - total;
        await pool.query(
            "UPDATE portfolio SET cash = $1 WHERE id = $2",
            [newCash, 1]
        );

        const holdingResult = await pool.query(
            "SELECT * FROM holdings WHERE portfolio_id = $1 AND symbol = $2",
            [1, symbol]
        );

        const existingHolding = holdingResult.rows[0];

        // Update holdings table
        if (existingHolding) {
            await pool.query(
                "UPDATE holdings SET shares = shares + $1 WHERE id = $2",
                [shares, existingHolding.id]
            );
        } else {
            await pool.query(
                "INSERT INTO holdings (portfolio_id, symbol, shares) VALUES ($1, $2, $3)",
                [1, symbol, shares]
            );
        }

        // Update transactions table
        await pool.query(
            `INSERT INTO transactions
            (portfolio_id, symbol, type, shares, price, total)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [1, symbol, "BUY", shares, price, total]
        );

        res.json({
            symbol,
            shares,
            price,
            total,
            remainingCash: Number(newCash.toFixed(2))
        });

    } catch (error) {

        console.error(error);
        res.status(500).json({
            message: "Could not process stock purchase"
        });
    }
});

// SELL
app.post("/sell", async (req, res) => {
    try {

        let { symbol, shares } = req.body;

        if (!symbol || !shares || shares <= 0) {
            return res.status(400).json({
                message: "Symbol and shares must be valid"
            });
        }

        symbol = symbol.toUpperCase().trim();

        const holdingResult = await pool.query(
            "SELECT * FROM holdings WHERE portfolio_id = $1 AND symbol = $2",
            [1, symbol]
        );
        const existingHolding = holdingResult.rows[0];

        if (!existingHolding) {
            return res.status(404).json({
                message: "Holding not found"
            });
        }

        if (existingHolding.shares < shares) {
            return res.status(400).json({
                message: "Not enough shares to sell"
            });
        }

        const price = await getStockPrice(symbol);
        const total = price * shares;
        const remainingShares = existingHolding.shares - shares;

        const portfolioResult = await pool.query(
            "SELECT * FROM portfolio WHERE id = $1",
            [1]
        );

        const portfolio = portfolioResult.rows[0];
        const newCash = Number(portfolio.cash) + total;

        await pool.query(
            "UPDATE portfolio SET cash = $1 WHERE id = $2",
            [newCash, 1]
        );

        if (remainingShares === 0) {
            await pool.query(
                "DELETE FROM holdings WHERE id = $1",
                [existingHolding.id]
            );
        } else {
            await pool.query(
                "UPDATE holdings SET shares = $1 WHERE id = $2",
                [remainingShares, existingHolding.id]
            );
        }

        await pool.query(
            `INSERT INTO transactions
            (portfolio_id, symbol, type, shares, price, total)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [1, symbol, "SELL", shares, price, total]
        );

        res.json({
            symbol,
            shares,
            price,
            total,
            remainingCash: Number(newCash.toFixed(2)),
            message: "Stock sold successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not process stock sale"
        });
    }
});

// HOLDINGS
app.get("/holdings", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM holdings"
        );

        res.json(result.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Database error"
        });
    }
});

// PORTFOLIO
app.get("/portfolio", async (req, res) => {
    try {
        const portfolio = await pool.query(
            `SELECT users.name, portfolio.cash, holdings.symbol, holdings.shares
            FROM users
            JOIN portfolio
            ON users.id = portfolio.user_id
            LEFT JOIN holdings
            ON portfolio.id = holdings.portfolio_id`
        );

        const formattedHoldings = portfolio.rows.map(row => ({
            symbol: row.symbol,
            shares: row.shares
        }));

        const transactions = await pool.query(
            "SELECT * FROM transactions WHERE portfolio_id = $1",
            [1]
        );

        res.json({
            portfolio: {
                name: portfolio.rows[0].name,
                cash: portfolio.rows[0].cash
            },

            holdings: formattedHoldings,
            transactions: transactions.rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not load portfolio"
        });
    }
});


// PORTFOLIO VALUE
app.get("/portfolio/value", async (req, res) => {
    try {

        const portfolioResult = await pool.query(
            "SELECT cash FROM portfolio WHERE id = $1",
            [1]
        );
        const portfolio = portfolioResult.rows[0];

        if (!portfolio) {
            return res.status(404).json({
                message: "Portfolio not found"
            });
        }

        const holdingsResult = await pool.query(
            "SELECT symbol, shares FROM holdings WHERE portfolio_id = $1",
            [1]
        );

        let holdingsValue = 0;

        for (const holding of holdingsResult.rows) {

            const price = await getStockPrice(holding.symbol);
            const value = price * holding.shares;
            holdingsValue += value;

            // Alpha Vantage free API rate limit
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const totalValue = Number(portfolio.cash) + holdingsValue;

        res.json({
            cash: Number(portfolio.cash),
            holdingsValue: Number(holdingsValue.toFixed(2)),
            totalValue: Number(totalValue.toFixed(2))
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Could not calculate portfolio value"
        });
    }
});


// TRANSACTIONS
app.get("/transactions", async (req, res) => {
    try {

        const result = await pool.query(
            `SELECT id, symbol, type, shares, price, total, created_at
            FROM transactions
            ORDER BY created_at DESC`
        );
        res.json(result.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database error"
        });
    }
});

// PROFIT & LOSS
app.get("/portfolio/pnl", async (req, res) => {
    try {

        const transactionsResult = await pool.query(
            `SELECT *
            FROM transactions
            WHERE portfolio_id = $1
            ORDER BY created_at ASC`,
            [1]
        );

        const holdingsResult = await pool.query(
            `SELECT *
            FROM holdings
            WHERE portfolio_id = $1`,
            [1]
        );

        const realizedPnL = calculateRealizedPnL(transactionsResult.rows);


        const unrealizedPnL = await calculateUnrealizedPnL(transactionsResult.rows,holdingsResult.rows);
        const totalPnL = realizedPnL + unrealizedPnL;

        res.json({
            realizedPnL,
            unrealizedPnL,
            totalPnL
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not calculate profit and loss"
        });
    }
});

// Database connection test
pool.query("SELECT NOW()", (error, result) => {

    if (error) {
        console.error("Database connection failed:", error);
    } else {
        console.log("Database connected:", result.rows[0]);
    }
});


// Start server
app.listen(PORT, () => {
    console.log("Server Running on port: " + PORT);
});