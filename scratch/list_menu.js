const { pool } = require('../frontend/src/app/api/db/db-helper.js');

async function listMenu() {
  try {
    const res = await pool.query('SELECT id, name FROM menu_items LIMIT 5');
    console.log('Menu Items:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
listMenu();
