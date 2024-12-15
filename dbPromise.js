const mysql = require('mysql2/promise');

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost', 
    user: 'root',      
    password: '',
    database: 'dating', 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // debug: true,
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
