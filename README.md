# TradeWise

TradeWise is a stock portfolio management application that simulates buying and tracking investments. The project was built to practice backend development, database design, API integration, and building a real-world application workflow.

## Purpose

The goal of TradeWise is to create a platform where users can manage a stock portfolio, retrieve real-time stock prices, track holdings, and record transaction history.

## Features

- Retrieve real-time stock prices using Alpha Vantage API
- Buy stocks and update portfolio balance
- Track owned stocks and shares
- Store transaction history
- Manage portfolio data using PostgreSQL

## Technologies Used

- JavaScript
- Node.js
- Express.js
- PostgreSQL
- Alpha Vantage API
- Git/GitHub

## Running Locally

Clone the repository:

```bash
git clone https://github.com/fuzislit/TradeWise.git
```

Navigate to the server directory:

```bash
cd server
```

Install dependencies:

```bash
npm install
```

Create a `.env` file and add your API key:

```env
ALPHA_VANTAGE_API_KEY=your_api_key_here
```

Start the backend server:

```bash
node index.js
```

The server will run on:

```
http://localhost:3000
```

## Future Improvements

- Add user authentication
- Implement stock selling
- Build a frontend dashboard
- Add portfolio performance tracking