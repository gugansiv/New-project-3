const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://primeworkspace@localhost:5432/system_dashboard'
});

async function clearDb() {
  try {
    console.log('Connecting to db...');
    
    const tables = [
      'stores', 'loyalty_transactions', 'support_tickets', 'menu_items', 
      'staff_rota', 'stock_items', 'stock_orders', 'orders', 'messages', 
      'calendar_events', 'shifts', 'expenses', 'waste_log', 'daily_reports', 
      'audit_logs'
    ];
    
    for (const t of tables) {
      await pool.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
      console.log(`Cleared ${t}`);
    }

    // Remove all users except admins to ensure access isn't lost
    await pool.query(`DELETE FROM users WHERE role != 'admin'`);
    console.log(`Cleared non-admin users`);
    
    // Also truncate the legacy json db if it exists
    await pool.query(`TRUNCATE TABLE crispy_chicken_db CASCADE`).catch(() => {});
    
    console.log('Database cleared successfully!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}

clearDb();
