require("dotenv").config(); // configuration for the API key 

const express = require("express"); 

const pool = require("./db");

const https = require("https");

function getStockPrice(symbol) {
    return new Promise((resolve, reject) => {

        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

        const url =
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;

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

const app = express(); 

app.use(express.json()); 

const PORT = 3000; 


app.get("/", (req, res)=> {
    res.json({
        message: ("Welcome to TradeWise!"),  //Welcome message to test
        status: ("Backend is running!") // status
    }); 
});


app.post("/buy", async (req, res) => {
    try {
        const { symbol, shares } = req.body;

        if (!symbol || !shares) {
            return res.status(400).json({
                message: "Missing stock information"
            });
        }

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
        //update holdings table
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
        //update transaction Table
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

app.post("/sell", async (req, res) => {
    try {
        const { symbol, shares } = req.body;

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


        const holdings = await pool.query("SELECT * FROM holdings WHERE portfolio_id = $1",[1]);
        
        const transactions = await pool.query("SELECT * FROM transactions WHERE portfolio_id = $1", [1] );

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

pool.query("SELECT NOW()", (error, result) => {
    if (error) {
        console.error("Database connection failed:", error);
    } else {
        console.log("Database connected:", result.rows[0]);
    }
});


app.listen(PORT, () => {
    console.log("Server Running on port: "+ PORT);
});
