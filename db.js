require('dotenv').config();
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,     
  server: "LAPTOP-1U09JDJO",
  database: process.env.DB_NAME,
  // port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false, 
    trustServerCertificate: true
  }
};


async function connectDB() {
  try {
    await sql.connect(config);
    console.log('MSSQL Connected');
  } catch (err) {
    console.error('DB Connection Error:', err);
  }
}

module.exports = { sql, connectDB };