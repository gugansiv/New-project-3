const { pool } = require('../frontend/src/app/api/db/db-helper.js');

async function listStores() {
  try {
    const res = await pool.query('SELECT id, name FROM stores');
    console.log('Stores in DB:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
listStores();
