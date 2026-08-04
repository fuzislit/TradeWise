const { Pool } = require("pg");

const pool = new Pool({
    user: "fuzailali",
    host: "localhost",
    database: "tradewise",
    port: 5432
});

module.exports = pool;