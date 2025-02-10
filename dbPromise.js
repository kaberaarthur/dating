require('dotenv').config();
const mysql = require('mysql2/promise');

// Create a connection pool
/*const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10),
});*/

const pool = mysql.createPool({
    host: '164.92.79.133',
    user: 'dating',
    password: 'Nopa55word*',
    database: 'dating',
    waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS === 'true',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10),
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10),
    // charset: 'utf8mb4'
});

// Test the database connection
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log('Database connected successfully!');
        conn.release();
    } catch (err) {
        console.error('Database connection failed:', err.message);
    }
})();

module.exports = pool;
