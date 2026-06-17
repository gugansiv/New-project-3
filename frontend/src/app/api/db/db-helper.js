import fs from 'fs';
import path from 'path';

let inMemoryDb = null;
const DB_FILE = path.join(process.cwd(), 'src/app/api/db/db.json');

const INITIAL_USERS = [
  {
    id: "usr-admin",
    name: "Global Admin",
    email: "admin@crispy.com",
    password: "admin123",
    role: "admin",
    storeId: null
  },
  {
    id: "usr-customer",
    name: "John Doe",
    email: "customer@crispy.com",
    password: "customer123",
    role: "customer",
    storeId: null
  }
];

const INITIAL_STORES = [
  {
    id: "st1",
    name: "Downtown Flagship",
    address: "742 Broadway, New York, NY",
    manager: "Marcus Vance",
    status: "Open",
    rent: 250000,
    staffCount: 18,
    dailyTarget: 120000,
    historicalRevenue: 4245000,
    historicalOrders: 4150
  },
  {
    id: "st2",
    name: "Westside Drive-Thru",
    address: "1450 10th Ave, New York, NY",
    manager: "Sarah Jenkins",
    status: "Open",
    rent: 180000,
    staffCount: 14,
    dailyTarget: 95000,
    historicalRevenue: 3345000,
    historicalOrders: 3270
  },
  {
    id: "st3",
    name: "Eastside Express",
    address: "330 E 23rd St, New York, NY",
    manager: "Li Wei Chen",
    status: "Open",
    rent: 120000,
    staffCount: 8,
    dailyTarget: 60000,
    historicalRevenue: 1925000,
    historicalOrders: 1880
  },
  {
    id: "st4",
    name: "Uptown Mall Court",
    address: "2200 Grand Concourse, Bronx, NY",
    manager: "Elena Rostova",
    status: "Closed",
    rent: 150000,
    staffCount: 10,
    dailyTarget: 75000,
    historicalRevenue: 2425000,
    historicalOrders: 2370
  }
];

const HISTORICAL_ORDERS = [
  {
    id: "ord-9941",
    storeId: "st1",
    storeName: "Downtown Flagship",
    items: [
      { id: "b1", name: "10 Pcs Crispy Chicken Bucket", quantity: 1, price: 899.00 },
      { id: "d1", name: "Pepsi Cola", quantity: 2, price: 69.00 }
    ],
    subtotal: 1037.00,
    tax: 82.96,
    total: 1119.96,
    status: "Completed",
    timestamp: "2026-06-16T18:30:00Z",
    paymentMethod: "Card",
    customerName: "John Doe"
  },
  {
    id: "ord-9942",
    storeId: "st2",
    storeName: "Westside Drive-Thru",
    items: [
      { id: "bg1", name: "Mega Crunch Burger", quantity: 2, price: 279.00 },
      { id: "s1", name: "Crispy Crinkle Fries", quantity: 2, price: 119.00 }
    ],
    subtotal: 796.00,
    tax: 63.68,
    total: 859.68,
    status: "Completed",
    timestamp: "2026-06-16T19:15:00Z",
    paymentMethod: "Apple Pay",
    customerName: "Sarah Connor"
  },
  {
    id: "ord-9943",
    storeId: "st1",
    storeName: "Downtown Flagship",
    items: [
      { id: "b2", name: "6 Pcs Variety Bucket", quantity: 1, price: 599.00 },
      { id: "s2", name: "Creamy Coleslaw", quantity: 1, price: 99.00 }
    ],
    subtotal: 698.00,
    tax: 55.84,
    total: 753.84,
    status: "Completed",
    timestamp: "2026-06-16T19:40:00Z",
    paymentMethod: "Cash",
    customerName: "Mike Myers"
  },
  {
    id: "ord-9944",
    storeId: "st3",
    storeName: "Eastside Express",
    items: [
      { id: "bg3", name: "Spicy Crispy Wrap", quantity: 1, price: 219.00 },
      { id: "d3", name: "Iced Lemon Tea", quantity: 1, price: 89.00 }
    ],
    subtotal: 308.00,
    tax: 24.64,
    total: 332.64,
    status: "Completed",
    timestamp: "2026-06-16T20:05:00Z",
    paymentMethod: "Card",
    customerName: "Emma Watson"
  },
  {
    id: "ord-9945",
    storeId: "st2",
    storeName: "Westside Drive-Thru",
    items: [
      { id: "b1", name: "10 Pcs Crispy Chicken Bucket", quantity: 2, price: 899.00 },
      { id: "s3", name: "Hot Spicy Wings (6 Pcs)", quantity: 1, price: 239.00 }
    ],
    subtotal: 2037.00,
    tax: 162.96,
    total: 2199.96,
    status: "Completed",
    timestamp: "2026-06-16T20:55:00Z",
    paymentMethod: "Card",
    customerName: "David Beckham"
  }
];

const DEFAULT_DB = {
  users: INITIAL_USERS,
  stores: INITIAL_STORES,
  menu_items: null,
  active_orders: [],
  completed_orders: HISTORICAL_ORDERS
};

export function getDb() {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      inMemoryDb = JSON.parse(content);
      return inMemoryDb;
    }
  } catch (err) {
    console.error('Error reading db file:', err);
  }

  inMemoryDb = { ...DEFAULT_DB };
  saveDb(inMemoryDb);
  return inMemoryDb;
}

export function saveDb(data) {
  inMemoryDb = data;
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('DB file write failed (expected on serverless):', err.message);
  }
}
