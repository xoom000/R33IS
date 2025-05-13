-- Customers Table
CREATE TABLE customers (
    CustomerNumber INTEGER PRIMARY KEY,
    AccountName TEXT NOT NULL,
    Address TEXT,
    City TEXT,
    State TEXT,
    ZipCode TEXT,
    RouteNumber TEXT NOT NULL,  -- Links to routes table
    ServiceFrequency TEXT,
    ServiceDays TEXT,
    Email TEXT,
    Phone TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Routes Table
CREATE TABLE routes (
    RouteNumber TEXT PRIMARY KEY,  -- Format like "2502-33"
    RouteInt INTEGER,              -- Integer version for API lookups
    DriverName TEXT NOT NULL,
    PlantNumber INTEGER,
    ServiceDay TEXT                -- Day of week for this route (M, T, W, Th, F)
);

-- Rental Items Master Table (catalog of all available items)
CREATE TABLE rental_items_catalog (
    item_id INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    category TEXT,                 -- Category for grouping
    is_active BOOLEAN DEFAULT 1
);

-- Customer Rental Items (what each customer gets)
CREATE TABLE customer_rental_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerNumber INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity_used INTEGER NOT NULL,
    delivery_frequency TEXT DEFAULT 'Weekly',
    delivery_day INTEGER CHECK (delivery_day BETWEEN 1 AND 5),
    billing_type TEXT,
    billing_frequency TEXT DEFAULT 'Monthly',
    customer_price DECIMAL(10,2),
    unit_price DECIMAL(10,2),
    billing_percentage TEXT,
    auto_soil_count INTEGER,
    last_delivery_date DATE,
    FOREIGN KEY (CustomerNumber) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (item_id) REFERENCES rental_items_catalog(item_id)
);

-- Route Load Summary (calculated from customer_rental_items)
CREATE TABLE route_load_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    RouteNumber TEXT NOT NULL,
    ServiceDay TEXT NOT NULL,     -- Day of week (M, T, W, Th, F)
    item_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    total_quantity INTEGER NOT NULL,  -- Sum of all quantities for this item on this route/day
    FOREIGN KEY (RouteNumber) REFERENCES routes(RouteNumber),
    FOREIGN KEY (item_id) REFERENCES rental_items_catalog(item_id)
);

-- Categories Table
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
);

-- Direct Sales Products Table (formerly products)
CREATE TABLE direct_sales (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    category_id INTEGER,
    vendor TEXT,
    is_active BOOLEAN DEFAULT 1,
    stock_quantity INTEGER DEFAULT 0,
    image_url TEXT,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Customer Product List Table (curated direct sales for each customer)
CREATE TABLE customer_product_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number INTEGER NOT NULL,
    sku TEXT NOT NULL,
    is_featured BOOLEAN DEFAULT 0,  -- Highlight products you want to promote
    notes TEXT,  -- Custom notes for this customer/product
    date_added DATE DEFAULT CURRENT_DATE,
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (sku) REFERENCES direct_sales(sku),
    UNIQUE(customer_number, sku)
);

-- Order Requests Table
CREATE TABLE order_requests (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number INTEGER NOT NULL,
    status TEXT CHECK (status IN ('Pending', 'Approved', 'Declined')) DEFAULT 'Pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    declined_reason TEXT,
    driver_id INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    note TEXT,
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

-- Order Items Table (details for each order)
CREATE TABLE order_items (
    item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_order DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES order_requests(order_id),
    FOREIGN KEY (sku) REFERENCES direct_sales(sku)
);

-- Sales Table (for completed sales/commissions)
CREATE TABLE sales (
    sale_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    customer_number INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES order_requests(order_id),
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

-- Customer Par Levels (for direct sale items)
CREATE TABLE customer_par_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number INTEGER NOT NULL,
    sku TEXT NOT NULL,
    par_level INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (sku) REFERENCES direct_sales(sku),
    UNIQUE(customer_number, sku)
);

-- Transactions Table (tracks rental adjustments)
CREATE TABLE transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    CustomerNumber INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    transaction_code TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    FOREIGN KEY (CustomerNumber) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (item_id) REFERENCES rental_items_catalog(item_id)
);

-- Drivers Table
CREATE TABLE drivers (
    driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    route_number TEXT NOT NULL,
    role TEXT CHECK (role IN ('Driver', 'SuperAdmin')) DEFAULT 'Driver',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_number) REFERENCES routes(RouteNumber)
);

-- Trip status tracking
CREATE TABLE delivery_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number INTEGER NOT NULL,
    route_number TEXT NOT NULL,
    delivery_date DATE NOT NULL,
    status TEXT CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Issue')) DEFAULT 'Not Started',
    completion_time DATETIME,
    issues_notes TEXT,
    driver_id INTEGER NOT NULL,
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (route_number) REFERENCES routes(RouteNumber),
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id)
);

-- Route optimization (stop order)
CREATE TABLE route_stop_order (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_number TEXT NOT NULL,
    customer_number INTEGER NOT NULL,
    stop_order INTEGER NOT NULL,  -- Sequence number for this stop
    estimated_time INTEGER,       -- Minutes at this stop
    FOREIGN KEY (route_number) REFERENCES routes(RouteNumber),
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    UNIQUE(route_number, stop_order)
);

-- Customer notes/special instructions
CREATE TABLE customer_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number INTEGER NOT NULL,
    note_type TEXT CHECK (note_type IN ('Delivery', 'Product', 'Account', 'General')),
    note_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,  -- driver_id
    FOREIGN KEY (customer_number) REFERENCES customers(CustomerNumber),
    FOREIGN KEY (created_by) REFERENCES drivers(driver_id)
);

-- Create indexes for faster queries
CREATE INDEX idx_customers_route ON customers(RouteNumber);
CREATE INDEX idx_customer_rental_items_customer ON customer_rental_items(CustomerNumber);
CREATE INDEX idx_customer_rental_items_item ON customer_rental_items(item_id);
CREATE INDEX idx_route_load_summary_route ON route_load_summary(RouteNumber, ServiceDay);
CREATE INDEX idx_customer_product_list_customer ON customer_product_list(customer_number);
CREATE INDEX idx_order_requests_customer ON order_requests(customer_number);
CREATE INDEX idx_order_requests_driver ON order_requests(driver_id);
CREATE INDEX idx_order_requests_status ON order_requests(status);
CREATE INDEX idx_direct_sales_category ON direct_sales(category_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_transactions_customer ON transactions(CustomerNumber);
CREATE INDEX idx_delivery_status_route_date ON delivery_status(route_number, delivery_date);
CREATE INDEX idx_route_stop_order_route ON route_stop_order(route_number);
CREATE INDEX idx_customer_notes_customer ON customer_notes(customer_number);

-- Create virtual table for full-text search of customers
CREATE VIRTUAL TABLE customers_fts USING fts5(AccountName);
