const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '164.92.79.133', // e.g., 'db.example.com' or IP address
  user: 'dating',
  password: 'Nopa55word*',
  database: 'dating'
});

connection.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.stack);
    return;
  }
  console.log('Connected to the remote database.');
});

// Query example
connection.query('SELECT * FROM messages', (err, results) => {
  if (err) throw err;
  console.log(results);
});

// Close connection
connection.end();
