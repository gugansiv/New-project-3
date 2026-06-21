const { pool } = require('../frontend/src/app/api/db/db-helper.js');
const crypto = require('crypto');

async function createTestCustomer() {
  const email = 'customer@test.com';
  const password = 'password123';
  const phone = '9876543210';
  
  // Hash the password
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

  try {
    // Check if exists
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (name, email, password_hash, salt, role, phone, loyalty_points) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['Test Customer', email, hash, salt, 'customer', phone, 500]
      );
      console.log('Created test customer:');
      console.log('Email:', email);
      console.log('Phone:', phone);
      console.log('Password:', password);
      console.log('Loyalty Points: 500');
    } else {
      // Update password and points to ensure it works
      await pool.query(
        `UPDATE users SET password_hash = $1, salt = $2, phone = $3, loyalty_points = 500 WHERE email = $4`,
        [hash, salt, phone, email]
      );
      console.log('Updated test customer:');
      console.log('Email:', email);
      console.log('Phone:', phone);
      console.log('Password:', password);
      console.log('Loyalty Points: 500');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

createTestCustomer();
