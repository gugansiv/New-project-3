import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Falling back to local development database.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://primeworkspace@localhost:5432/system_dashboard'
});

export { pool };

const DB_FILE = path.join(process.cwd(), 'src/app/api/db/db.json');

const DDL = [
  `CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rent NUMERIC DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Closed',
    address TEXT,
    manager VARCHAR(100),
    "staffCount" INT DEFAULT 0,
    "dailyTarget" NUMERIC DEFAULT 0,
    "historicalRevenue" NUMERIC DEFAULT 0,
    "historicalOrders" INT DEFAULT 0,
    city VARCHAR(100),
    pincode VARCHAR(20),
    lat NUMERIC,
    lng NUMERIC
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    "storeId" VARCHAR(50),
    loyalty_points NUMERIC DEFAULT 0,
    phone VARCHAR(50),
    saved_addresses JSONB,
    notification_preferences JSONB
  )`,
  `CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id VARCHAR(50) PRIMARY KEY,
    "userId" VARCHAR(50),
    amount NUMERIC DEFAULT 0,
    type VARCHAR(20),
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(50) PRIMARY KEY,
    "userId" VARCHAR(50),
    subject VARCHAR(200),
    message TEXT,
    status VARCHAR(20) DEFAULT 'Open',
    priority VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(10) NOT NULL,
    image TEXT,
    price NUMERIC DEFAULT 0,
    calories INT DEFAULT 0,
    category VARCHAR(50),
    description TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS staff_rota (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50),
    phone VARCHAR(30),
    "storeId" VARCHAR(50),
    schedule JSONB,
    "hourlyRate" NUMERIC DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS stock_items (
    id VARCHAR(50) PRIMARY KEY,
    unit VARCHAR(20),
    "minQty" NUMERIC DEFAULT 0,
    "storeId" VARCHAR(50),
    "itemName" VARCHAR(100) NOT NULL,
    "currentQty" NUMERIC DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS stock_orders (
    id VARCHAR(50) PRIMARY KEY,
    items JSONB,
    status VARCHAR(20) DEFAULT 'Pending',
    "storeId" VARCHAR(50),
    "storeName" VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" VARCHAR(100)
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    "storeId" VARCHAR(50),
    "storeName" VARCHAR(100),
    items JSONB,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    status VARCHAR(20) DEFAULT 'Pending',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" VARCHAR(50),
    "paymentId" VARCHAR(100),
    "customerName" VARCHAR(100),
    "customerEmail" VARCHAR(100),
    "customerPhone" VARCHAR(50),
    "collectionTime" VARCHAR(50),
    "isActive" BOOLEAN DEFAULT TRUE
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(50) PRIMARY KEY,
    text TEXT NOT NULL,
    sender VARCHAR(100) NOT NULL,
    "storeId" VARCHAR(50),
    "storeName" VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "senderRole" VARCHAR(20)
  )`,
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    start TIMESTAMP WITH TIME ZONE,
    "end" TIMESTAMP WITH TIME ZONE,
    "storeId" VARCHAR(50),
    type VARCHAR(50),
    color VARCHAR(20),
    description TEXT,
    "allDay" BOOLEAN DEFAULT FALSE,
    date VARCHAR(50),
    time VARCHAR(50)
  )`,
  `CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(50) PRIMARY KEY,
    "storeId" VARCHAR(50),
    "staffName" VARCHAR(100),
    "clockIn" TIMESTAMP WITH TIME ZONE,
    "clockOut" TIMESTAMP WITH TIME ZONE,
    date DATE
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(50) PRIMARY KEY,
    "storeId" VARCHAR(50),
    amount NUMERIC DEFAULT 0,
    category VARCHAR(50),
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    "recordedBy" VARCHAR(100)
  )`,
  `CREATE TABLE IF NOT EXISTS waste_log (
    id VARCHAR(50) PRIMARY KEY,
    "storeId" VARCHAR(50),
    "itemName" VARCHAR(100),
    quantity NUMERIC DEFAULT 0,
    reason VARCHAR(100),
    cost NUMERIC DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE TABLE IF NOT EXISTS daily_reports (
    id VARCHAR(50) PRIMARY KEY,
    "storeId" VARCHAR(50),
    "storeName" VARCHAR(100),
    date DATE,
    "totalSales" NUMERIC DEFAULT 0,
    "totalExpenses" NUMERIC DEFAULT 0,
    "totalWaste" NUMERIC DEFAULT 0,
    "activeShiftsCount" INT DEFAULT 0,
    "stockAlertsCount" INT DEFAULT 0,
    "submittedAt" TIMESTAMP WITH TIME ZONE,
    "submittedBy" VARCHAR(100),
    status VARCHAR(20) DEFAULT 'Pending'
  )`
];

// Promise-based singleton: all concurrent callers share the same init promise,
// preventing duplicate DDL execution under parallel cold-start requests.
let _initPromise = null;

export function initDbTables() {
  if (!_initPromise) {
    _initPromise = _runInitDbTables();
  }
  return _initPromise;
}

async function _runInitDbTables() {
  try {
    // Run DDL queries
    for (const query of DDL) {
      await pool.query(query);
    }
    
    // Add date/time columns dynamically if they don't exist
    await pool.query('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS date VARCHAR(50)');
    await pool.query('ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS time VARCHAR(50)');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS city VARCHAR(100)');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS pincode VARCHAR(20)');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS lat NUMERIC');
    await pool.query('ALTER TABLE stores ADD COLUMN IF NOT EXISTS lng NUMERIC');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points NUMERIC DEFAULT 0');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_addresses JSONB');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB');

    // Create Audit Logs setup
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          table_name VARCHAR(100),
          action VARCHAR(20),
          old_data JSONB,
          new_data JSONB,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Audit Trigger Function
    await pool.query(`
      CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$
      BEGIN
          IF (TG_OP = 'DELETE') THEN
              INSERT INTO audit_logs (table_name, action, old_data)
              VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD));
              RETURN OLD;
          ELSIF (TG_OP = 'UPDATE') THEN
              INSERT INTO audit_logs (table_name, action, old_data, new_data)
              VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD), row_to_json(NEW));
              RETURN NEW;
          ELSIF (TG_OP = 'INSERT') THEN
              INSERT INTO audit_logs (table_name, action, new_data)
              VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW));
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Attach trigger to sensitive tables
    const sensitiveTables = ['menu_items', 'staff_rota', 'expenses', 'stores', 'users'];
    for (const table of sensitiveTables) {
      await pool.query(`DROP TRIGGER IF EXISTS audit_${table} ON ${table}`);
      await pool.query(`
        CREATE TRIGGER audit_${table}
        AFTER INSERT OR UPDATE OR DELETE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
      `);
    }

    
    // Check if users table is empty
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count, 10) === 0) {
      console.log('PostgreSQL relational tables empty. Migrating existing data...');
      
      // Load existing data from db.json or crispy_chicken_db
      let dbData = null;
      try {
        const legacyRes = await pool.query("SELECT data FROM crispy_chicken_db LIMIT 1");
        if (legacyRes.rows.length > 0) {
          const d = legacyRes.rows[0].data;
          dbData = typeof d === 'string' ? JSON.parse(d) : d;
        }
      } catch (e) {
        console.warn('Could not read from crispy_chicken_db table:', e.message);
      }
      
      if (!dbData && fs.existsSync(DB_FILE)) {
        try {
          dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) {
          console.warn('Could not read local db.json:', e.message);
        }
      }
      
      if (dbData) {
        // 1. Migrate stores
        if (dbData.stores) {
          for (const s of dbData.stores) {
            try {
              await pool.query(
                `INSERT INTO stores (id, name, rent, status, address, manager, "staffCount", "dailyTarget", "historicalRevenue", "historicalOrders", city, pincode, lat, lng)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 ON CONFLICT (id) DO NOTHING`,
                [s.id, s.name, s.rent || 0, s.status || 'Closed', s.address, s.manager, s.staffCount || 0, s.dailyTarget || 0, s.historicalRevenue || 0, s.historicalOrders || 0, s.city || null, s.pincode || null, s.lat !== undefined && s.lat !== null ? parseFloat(s.lat) : null, s.lng !== undefined && s.lng !== null ? parseFloat(s.lng) : null]
              );
            } catch (err) {
              console.warn(`Migration failed for store ${s.id}:`, err.message);
            }
          }
        }
        
        // 2. Migrate users
        if (dbData.users) {
          for (const u of dbData.users) {
            try {
              await pool.query(
                `INSERT INTO users (id, name, email, password, role, "storeId")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [u.id, u.name, u.email, u.password, u.role, u.storeId]
              );
            } catch (err) {
              console.warn(`Migration failed for user ${u.id}:`, err.message);
            }
          }
        }
        
        // 3. Migrate menu_items
        const menu = dbData.menu_items;
        if (menu) {
          for (const m of menu) {
            try {
              await pool.query(
                `INSERT INTO menu_items (id, name, type, image, price, calories, category, description)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (id) DO NOTHING`,
                [m.id, m.name, m.type, m.image, m.price || 0, m.calories || 0, m.category, m.description]
              );
            } catch (err) {
              console.warn(`Migration failed for menu item ${m.id}:`, err.message);
            }
          }
        }
        
        // 4. Migrate staff_rota
        if (dbData.staff_rota) {
          for (const r of dbData.staff_rota) {
            try {
              await pool.query(
                `INSERT INTO staff_rota (id, name, role, phone, "storeId", schedule, "hourlyRate")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [r.id, r.name, r.role, r.phone, r.storeId, JSON.stringify(r.schedule), r.hourlyRate || 0]
              );
            } catch (err) {
              console.warn(`Migration failed for staff rota ${r.id}:`, err.message);
            }
          }
        }
        
        // 5. Migrate stock_items
        if (dbData.stock_items) {
          for (const s of dbData.stock_items) {
            try {
              await pool.query(
                `INSERT INTO stock_items (id, unit, "minQty", "storeId", "itemName", "currentQty")
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [s.id, s.unit, s.minQty || 0, s.storeId, s.itemName, s.currentQty || 0]
              );
            } catch (err) {
              console.warn(`Migration failed for stock item ${s.id}:`, err.message);
            }
          }
        }
        
        // 6. Migrate stock_orders
        if (dbData.stock_orders) {
          for (const o of dbData.stock_orders) {
            try {
              await pool.query(
                `INSERT INTO stock_orders (id, items, status, "storeId", "storeName", timestamp, "requestedBy")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [o.id, JSON.stringify(o.items), o.status || 'Pending', o.storeId, o.storeName, o.timestamp, o.requestedBy]
              );
            } catch (err) {
              console.warn(`Migration failed for stock order ${o.id}:`, err.message);
            }
          }
        }
        
        // 7. Migrate orders (both active and completed)
        const active = dbData.active_orders || [];
        const completed = dbData.completed_orders || [];
        for (const o of active) {
          try {
            await pool.query(
              `INSERT INTO orders (id, "storeId", "storeName", items, subtotal, tax, total, status, timestamp, "paymentMethod", "paymentId", "customerName", "customerEmail", "customerPhone", "collectionTime", "isActive")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE)
               ON CONFLICT (id) DO NOTHING`,
              [o.id, o.storeId, o.storeName, JSON.stringify(o.items), o.subtotal || 0, o.tax || 0, o.total || 0, o.status || 'Pending', o.timestamp, o.paymentMethod, o.paymentId, o.customerName, o.customerEmail, o.customerPhone, o.collectionTime]
            );
          } catch (err) {
            console.warn(`Migration failed for active order ${o.id}:`, err.message);
          }
        }
        for (const o of completed) {
          try {
            await pool.query(
              `INSERT INTO orders (id, "storeId", "storeName", items, subtotal, tax, total, status, timestamp, "paymentMethod", "paymentId", "customerName", "customerEmail", "customerPhone", "collectionTime", "isActive")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, FALSE)
               ON CONFLICT (id) DO NOTHING`,
              [o.id, o.storeId, o.storeName, JSON.stringify(o.items), o.subtotal || 0, o.tax || 0, o.total || 0, o.status || 'Completed', o.timestamp, o.paymentMethod, o.paymentId, o.customerName, o.customerEmail, o.customerPhone, o.collectionTime]
            );
          } catch (err) {
            console.warn(`Migration failed for completed order ${o.id}:`, err.message);
          }
        }
        
        // 8. Migrate messages
        if (dbData.messages) {
          for (const m of dbData.messages) {
            try {
              await pool.query(
                `INSERT INTO messages (id, text, sender, "storeId", "storeName", timestamp, "senderRole")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [m.id, m.text, m.sender, m.storeId, m.storeName, m.timestamp, m.senderRole]
              );
            } catch (err) {
              console.warn(`Migration failed for message ${m.id}:`, err.message);
            }
          }
        }
        
        // 9. Migrate calendar_events
        if (dbData.calendar_events) {
          for (const e of dbData.calendar_events) {
            try {
              await pool.query(
                `INSERT INTO calendar_events (id, title, start, "end", "storeId", type, color, description, "allDay", date, time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 ON CONFLICT (id) DO NOTHING`,
                [e.id, e.title, e.start, e.end, e.storeId, e.type, e.color, e.description, e.allDay || false, e.date || null, e.time || null]
              );
            } catch (err) {
              console.warn(`Migration failed for calendar event ${e.id}:`, err.message);
            }
          }
        }
        
        // 10. Migrate system_settings
        try {
          const seq = dbData.lastCashCardSequence || 'B40';
          await pool.query(
            `INSERT INTO system_settings (key, value) VALUES ('lastCashCardSequence', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [seq]
          );
        } catch (err) {
          console.warn('Migration failed for lastCashCardSequence:', err.message);
        }
        
        // 11. Shifts
        if (dbData.shifts) {
          for (const s of dbData.shifts) {
            try {
              await pool.query(
                `INSERT INTO shifts (id, "storeId", "staffName", "clockIn", "clockOut", date)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO NOTHING`,
                [s.id, s.storeId, s.staffName, s.clockIn, s.clockOut, s.date]
              );
            } catch (err) {
              console.warn(`Migration failed for shift ${s.id}:`, err.message);
            }
          }
        }
        
        // 12. Expenses
        if (dbData.expenses) {
          for (const e of dbData.expenses) {
            try {
              await pool.query(
                `INSERT INTO expenses (id, "storeId", amount, category, description, timestamp, "recordedBy")
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [e.id, e.storeId, e.amount, e.category, e.description, e.timestamp, e.recordedBy]
              );
            } catch (err) {
              console.warn(`Migration failed for expense ${e.id}:`, err.message);
            }
          }
        }
        
        // 13. Waste log
        if (dbData.waste_log) {
          for (const w of dbData.waste_log) {
            try {
              await pool.query(
                `INSERT INTO waste_log (id, "storeId", "itemName", quantity, reason, cost, timestamp)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (id) DO NOTHING`,
                [w.id, w.storeId, w.itemName, w.quantity, w.reason, w.cost, w.timestamp]
              );
            } catch (err) {
              console.warn(`Migration failed for waste log ${w.id}:`, err.message);
            }
          }
        }
        
        // 14. Daily reports
        if (dbData.daily_reports) {
          for (const r of dbData.daily_reports) {
            try {
              await pool.query(
                `INSERT INTO daily_reports (id, "storeId", "storeName", date, "totalSales", "totalExpenses", "totalWaste", "activeShiftsCount", "stockAlertsCount", "submittedAt", "submittedBy", status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (id) DO NOTHING`,
                [r.id, r.storeId, r.storeName, r.date, r.totalSales, r.totalExpenses, r.totalWaste, r.activeShiftsCount, r.stockAlertsCount, r.submittedAt, r.submittedBy, r.status]
              );
            } catch (err) {
              console.warn(`Migration failed for daily report ${r.id}:`, err.message);
            }
          }
        }
        
        console.log('Migration to PostgreSQL relational tables completed successfully!');
      }
    }
  } catch (err) {
    console.error('Failed to initialize PostgreSQL relational tables:', err.message);
  }
}

export async function getDb() {
  await initDbTables();
  
  try {
    const users = await pool.query('SELECT * FROM users');
    const stores = await pool.query('SELECT * FROM stores');
    const menu_items = await pool.query('SELECT * FROM menu_items');
    const staff_rota = await pool.query('SELECT * FROM staff_rota');
    const stock_items = await pool.query('SELECT * FROM stock_items');
    const stock_orders = await pool.query('SELECT * FROM stock_orders');
    const active_orders = await pool.query('SELECT * FROM orders WHERE "isActive" = TRUE');
    const completed_orders = await pool.query('SELECT * FROM orders WHERE "isActive" = FALSE');
    const messages = await pool.query('SELECT * FROM messages');
    const calendar_events = await pool.query('SELECT * FROM calendar_events');
    const shifts = await pool.query('SELECT * FROM shifts');
    const expenses = await pool.query('SELECT * FROM expenses');
    const waste_log = await pool.query('SELECT * FROM waste_log');
    const daily_reports = await pool.query('SELECT * FROM daily_reports');
    const seqRes = await pool.query("SELECT value FROM system_settings WHERE key = 'lastCashCardSequence'");
    
    return {
      users: users.rows,
      stores: stores.rows.map(s => ({
        ...s,
        rent: parseFloat(s.rent || 0),
        dailyTarget: parseFloat(s.dailyTarget || 0),
        historicalRevenue: parseFloat(s.historicalRevenue || 0),
        lat: s.lat !== null && s.lat !== undefined ? parseFloat(s.lat) : null,
        lng: s.lng !== null && s.lng !== undefined ? parseFloat(s.lng) : null
      })),
      menu_items: menu_items.rows.map(m => ({
        ...m,
        price: parseFloat(m.price || 0)
      })),
      staff_rota: staff_rota.rows.map(r => ({
        ...r,
        hourlyRate: parseFloat(r.hourlyRate || 0)
      })),
      stock_items: stock_items.rows.map(s => ({
        ...s,
        minQty: parseFloat(s.minQty || 0),
        currentQty: parseFloat(s.currentQty || 0)
      })),
      stock_orders: stock_orders.rows,
      active_orders: active_orders.rows.map(o => ({
        ...o,
        subtotal: parseFloat(o.subtotal || 0),
        tax: parseFloat(o.tax || 0),
        total: parseFloat(o.total || 0)
      })),
      completed_orders: completed_orders.rows.map(o => ({
        ...o,
        subtotal: parseFloat(o.subtotal || 0),
        tax: parseFloat(o.tax || 0),
        total: parseFloat(o.total || 0)
      })),
      messages: messages.rows,
      calendar_events: calendar_events.rows,
      shifts: shifts.rows,
      expenses: expenses.rows.map(e => ({
        ...e,
        amount: parseFloat(e.amount || 0)
      })),
      waste_log: waste_log.rows.map(w => ({
        ...w,
        quantity: parseFloat(w.quantity || 0),
        cost: parseFloat(w.cost || 0)
      })),
      daily_reports: daily_reports.rows.map(r => ({
        ...r,
        totalSales: parseFloat(r.totalSales || 0),
        totalExpenses: parseFloat(r.totalExpenses || 0),
        totalWaste: parseFloat(r.totalWaste || 0)
      })),
      lastCashCardSequence: seqRes.rows[0]?.value || 'B40'
    };
  } catch (err) {
    console.error('Error fetching data from PostgreSQL tables in getDb():', err.message);
    return {
      users: [],
      stores: [],
      menu_items: [],
      staff_rota: [],
      stock_items: [],
      stock_orders: [],
      active_orders: [],
      completed_orders: [],
      messages: [],
      calendar_events: [],
      shifts: [],
      expenses: [],
      waste_log: [],
      daily_reports: [],
      lastCashCardSequence: 'B40'
    };
  }
}

export async function saveDb(data) {
  console.warn('saveDb() is deprecated and is now a no-op.');
}
