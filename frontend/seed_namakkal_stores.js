const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://primeworkspace@localhost:5432/system_dashboard'
});

const NAMAKKAL_STORES = [
  {
    id: "st1",
    name: "Namakkal Central Outlet",
    address: "Trichy Road, Near Bus Stand, Namakkal, TN",
    city: "Namakkal",
    pincode: "637001",
    lat: 11.2189,
    lng: 78.1678,
    manager: "Naresh",
    status: "Open",
    rent: 25000,
    staffCount: 12,
    dailyTarget: 45000,
    historicalRevenue: 1245000,
    historicalOrders: 2150
  },
  {
    id: "st2",
    name: "Salem Highway Drive-Thru",
    address: "NH-44 Bypass, Namakkal, TN",
    city: "Namakkal",
    pincode: "637003",
    lat: 11.2300,
    lng: 78.1600,
    manager: "Ramesh Kumar",
    status: "Open",
    rent: 18000,
    staffCount: 10,
    dailyTarget: 35000,
    historicalRevenue: 9345000,
    historicalOrders: 1270
  },
  {
    id: "st3",
    name: "Tiruchengode Express",
    address: "Velur Road, Tiruchengode, Namakkal, TN",
    city: "Tiruchengode",
    pincode: "637211",
    lat: 11.3796,
    lng: 77.8967,
    manager: "Karthik Raj",
    status: "Open",
    rent: 15000,
    staffCount: 8,
    dailyTarget: 25000,
    historicalRevenue: 825000,
    historicalOrders: 1180
  }
];

async function updateDb() {
  try {
    console.log('Connecting to db...');
    
    // Clear old stores
    await pool.query('DELETE FROM stores');
    
    console.log('Inserting Namakkal stores...');
    for (const store of NAMAKKAL_STORES) {
      await pool.query(
        `INSERT INTO stores (id, name, address, city, pincode, lat, lng, manager, status, "staffCount") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [store.id, store.name, store.address, store.city, store.pincode, store.lat, store.lng, store.manager, store.status, store.staffCount]
      );
    }
    console.log('Database updated successfully!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}

updateDb();
