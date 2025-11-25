
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        console.log("--- COLUMNS IN Productos ---");
        const [columns] = await connection.query("SHOW COLUMNS FROM Productos");
        console.log(columns.map(c => c.Field).join(', '));

        console.log("\n--- CATEGORIES ---");
        const [categories] = await connection.query("SELECT * FROM Categorias");
        console.log(categories);

        await connection.end();
    } catch (error) {
        console.error(error);
    }
}

checkSchema();
