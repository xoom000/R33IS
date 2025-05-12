import sqlite3
import os
import time

# Base directory
BASE_DIR = '/home/xoom000/mission_api'

# Path to old databases
ITEMS_DB = os.path.join(BASE_DIR, 'items.db')
ROUTES_DB = os.path.join(BASE_DIR, 'routes.db')
MISSION_DATA_DB = os.path.join(BASE_DIR, 'MissionData.db')
PRODUCTS_DB = os.path.join(BASE_DIR, 'products.db')

# Path to new database
MASTER_DB = os.path.join(BASE_DIR, 'database/master.db')

print("Starting database migration...")

# Connect to all databases
items_conn = sqlite3.connect(ITEMS_DB)
routes_conn = sqlite3.connect(ROUTES_DB)
mission_conn = sqlite3.connect(MISSION_DATA_DB)
products_conn = sqlite3.connect(PRODUCTS_DB)
master_conn = sqlite3.connect(MASTER_DB)

# Enable foreign keys
master_conn.execute("PRAGMA foreign_keys = OFF")

# Create cursor objects
items_cur = items_conn.cursor()
routes_cur = routes_conn.cursor()
mission_cur = mission_conn.cursor()
products_cur = products_conn.cursor()
master_cur = master_conn.cursor()

try:
    # Start transaction
    master_conn.execute('BEGIN TRANSACTION')
    
    # First, reset the database by emptying all tables
    print("\nCleaning existing tables...")
    tables = [
        "customers", "routes", "drivers", "categories", "direct_sales", 
        "rental_items_catalog", "customer_rental_items", "route_load_summary",
        "customer_product_list", "order_requests", "order_items", "sales", 
        "customer_par_levels", "transactions", "delivery_status",
        "route_stop_order", "customer_notes"
    ]
    
    for table in tables:
        try:
            master_cur.execute(f"DELETE FROM {table}")
            print(f"  Cleaned {table}")
        except sqlite3.OperationalError as e:
            print(f"  Warning: {e}")
    
    # Reset any sqlite_sequence
    master_cur.execute("DELETE FROM sqlite_sequence")
    
    # 1. Migrate categories from products.db to master.db
    print("\nMigrating categories from products.db...")
    products_cur.execute("SELECT id, name, description FROM categories")
    categories = products_cur.fetchall()
    
    master_cur.executemany(
        "INSERT INTO categories (id, name, description) VALUES (?, ?, ?)",
        categories
    )
    print(f"Migrated {len(categories)} categories")
    
    # 2. Migrate products from products.db to direct_sales in master.db
    print("\nMigrating products to direct_sales...")
    products_cur.execute("""
        SELECT sku, name, description, base_price, category_id, vendor, is_active
        FROM products
    """)
    products = products_cur.fetchall()
    
    # Add stock_quantity and image_url columns (default to 0 and NULL)
    products_with_defaults = [(p[0], p[1], p[2], p[3], p[4], p[5], p[6], 0, None) for p in products]
    
    master_cur.executemany(
        """
        INSERT INTO direct_sales 
        (sku, name, description, base_price, category_id, vendor, is_active, stock_quantity, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        products_with_defaults
    )
    print(f"Migrated {len(products)} products to direct_sales")
    
    # 3. Migrate customers from routes.db to master.db
    print("\nMigrating customers...")
    routes_cur.execute("""
        SELECT CustomerNumber, AccountName, Address, City, State, ZipCode, 
               RouteNumber, ServiceFrequency, ServiceDays
        FROM routes
    """)
    customers = routes_cur.fetchall()
    
    # Add email, phone, and CreatedAt columns (default to NULL, NULL, and current timestamp)
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    customers_with_defaults = [(c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], None, None, now) for c in customers]
    
    # Track successful inserts
    successful_customers = 0
    for customer in customers_with_defaults:
        try:
            master_cur.execute(
                """
                INSERT INTO customers 
                (CustomerNumber, AccountName, Address, City, State, ZipCode, 
                 RouteNumber, ServiceFrequency, ServiceDays, Email, Phone, CreatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                customer
            )
            successful_customers += 1
        except sqlite3.IntegrityError:
            print(f"  Warning: Customer {customer[0]} already exists. Skipping.")
    
    print(f"Migrated {successful_customers} customers")
    
    # 4. Extract unique item descriptions and create rental_items_catalog
    print("\nCreating rental items catalog...")
    items_cur.execute("""
        SELECT DISTINCT item_id, description
        FROM items
        ORDER BY item_id
    """)
    unique_items = items_cur.fetchall()
    
    # Track successful inserts
    successful_catalog_items = 0
    failed_catalog_items = 0
    
    for item in unique_items:
        item_id, description = item
        try:
            master_cur.execute(
                """
                INSERT INTO rental_items_catalog 
                (item_id, description, category, is_active)
                VALUES (?, ?, ?, ?)
                """,
                (item_id, description, 'General', 1)
            )
            successful_catalog_items += 1
        except sqlite3.IntegrityError as e:
            print(f"  Error adding catalog item {item_id}: {e}")
            failed_catalog_items += 1
    
    print(f"Created {successful_catalog_items} catalog items ({failed_catalog_items} failed)")
    
    # 5. Migrate customer-specific rental items
    print("\nMigrating customer rental items...")
    items_cur.execute("""
        SELECT item_id, description, customer_num, quantity_used, route
        FROM items
    """)
    items = items_cur.fetchall()
    
    # Track successful inserts
    successful_items = 0
    failed_items = 0
    
    for item in items:
        item_id, description, customer_num, quantity_used, route = item
        
        # Calculate delivery day from route
        delivery_day = (route % 5) + 1 if route else 1
        
        try:
            master_cur.execute(
                """
                INSERT INTO customer_rental_items 
                (CustomerNumber, item_id, description, quantity_used, 
                 delivery_frequency, delivery_day, billing_frequency)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (customer_num, item_id, description, quantity_used, 
                 'Weekly', delivery_day, 'Monthly')
            )
            successful_items += 1
        except sqlite3.IntegrityError as e:
            if "FOREIGN KEY constraint failed" in str(e):
                print(f"  Foreign key error for item with customer_num {customer_num}: {e}")
            else:
                print(f"  Error inserting customer rental item {item_id} for customer {customer_num}: {e}")
            failed_items += 1
    
    print(f"Migrated {successful_items} customer rental items ({failed_items} failed)")
    
    # 6. Extract unique routes and create route records
    print("\nCreating route records...")
    routes_cur.execute("SELECT DISTINCT RouteNumber FROM routes ORDER BY RouteNumber")
    unique_routes = routes_cur.fetchall()
    
    # Map days of the week
    day_map = {
        'M': 'Monday',
        'T': 'Tuesday',
        'W': 'Wednesday',
        'Th': 'Thursday',
        'F': 'Friday'
    }
    
    # Track successful inserts
    successful_routes = 0
    
    for route in unique_routes:
        route_number = route[0]
        try:
            # Get service days for this route
            routes_cur.execute("SELECT ServiceDays FROM routes WHERE RouteNumber = ? LIMIT 1", (route_number,))
            result = routes_cur.fetchone()
            service_day = 'Monday'  # Default
            
            if result and result[0]:
                # Extract first day from ServiceDays (often formatted like "M, W, F")
                first_day = result[0].split(',')[0].strip()
                service_day = day_map.get(first_day, 'Monday')
            
            # Extract route integer from route number if it's in format like "2502-33"
            if isinstance(route_number, str) and '-' in route_number:
                parts = route_number.split('-')
                if len(parts) == 2:
                    plant_number, route_int = parts
                    master_cur.execute(
                        """
                        INSERT INTO routes (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (route_number, int(route_int), f"Driver for Route {route_int}", int(plant_number), service_day)
                    )
                    successful_routes += 1
                else:
                    # Handle unusual format
                    master_cur.execute(
                        """
                        INSERT INTO routes (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (str(route_number), None, f"Driver for Route {route_number}", None, service_day)
                    )
                    successful_routes += 1
            else:
                # If it's just a number, use it directly
                if isinstance(route_number, int) or (isinstance(route_number, str) and route_number.isdigit()):
                    route_int = int(route_number)
                    master_cur.execute(
                        """
                        INSERT INTO routes (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (str(route_number), route_int, f"Driver for Route {route_number}", None, service_day)
                    )
                    successful_routes += 1
                else:
                    # Handle non-numeric
                    master_cur.execute(
                        """
                        INSERT INTO routes (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (str(route_number), None, f"Driver for Route {route_number}", None, service_day)
                    )
                    successful_routes += 1
        except Exception as e:
            print(f"  Error creating route record for {route_number}: {e}")
    
    print(f"Created {successful_routes} route records")
    
    # 7. Calculate route load summary based on customer rental items
    print("\nCalculating route load summaries...")
    master_cur.execute("""
        INSERT INTO route_load_summary (RouteNumber, ServiceDay, item_id, description, total_quantity)
        SELECT 
            c.RouteNumber,
            r.ServiceDay,
            cri.item_id,
            cri.description,
            SUM(cri.quantity_used) as total_quantity
        FROM 
            customer_rental_items cri
        JOIN 
            customers c ON cri.CustomerNumber = c.CustomerNumber
        JOIN 
            routes r ON c.RouteNumber = r.RouteNumber
        GROUP BY 
            c.RouteNumber, r.ServiceDay, cri.item_id
    """)
    
    # Check how many records were created
    master_cur.execute("SELECT COUNT(*) FROM route_load_summary")
    load_summary_count = master_cur.fetchone()[0]
    print(f"Created {load_summary_count} route load summary records")
    
    # 8. Create a default SuperAdmin driver account
    print("\nCreating default SuperAdmin account...")
    # Sample bcrypt hash for password 'admin123'
    admin_password_hash = '$2b$10$XH0yWAP7WZYCQiEVJ7Cy5u1j.JbPl0kJqN75YDz.O4vszTyFdPJUm'
    
    master_cur.execute(
        """
        INSERT INTO drivers (name, email, password_hash, route_number, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        ("Admin User", "admin@example.com", admin_password_hash, "33", "SuperAdmin", now)
    )
    print("Created SuperAdmin user (email: admin@example.com, password: admin123)")
    
    # 9. Update the customers_fts full-text search index
    print("\nUpdating full-text search index...")
    master_cur.execute("INSERT INTO customers_fts(rowid, AccountName) SELECT CustomerNumber, AccountName FROM customers")
    print("Updated full-text search index for customers")
    
    # 10. Calculate and update standardization_score for rental items
    print("\nCalculating standardization scores...")
    master_cur.execute("""
        UPDATE rental_items_catalog
        SET standardization_score = (
            SELECT COUNT(DISTINCT CustomerNumber)
            FROM customer_rental_items AS r
            WHERE r.description = rental_items_catalog.description
        )
    """)
    print("Updated standardization scores for rental items")
    
    # Commit transaction
    master_conn.commit()
    print("\nMigration completed successfully!")
    
    # Print record counts
    master_cur.execute("SELECT COUNT(*) FROM customers")
    customer_count = master_cur.fetchone()[0]
    
    master_cur.execute("SELECT COUNT(*) FROM rental_items_catalog")
    catalog_count = master_cur.fetchone()[0]
    
    master_cur.execute("SELECT COUNT(*) FROM customer_rental_items")
    customer_item_count = master_cur.fetchone()[0]
    
    master_cur.execute("SELECT COUNT(*) FROM direct_sales")
    product_count = master_cur.fetchone()[0]
    
    master_cur.execute("SELECT COUNT(*) FROM routes")
    route_count = master_cur.fetchone()[0]
    
    master_cur.execute("SELECT COUNT(*) FROM route_load_summary")
    load_summary_count = master_cur.fetchone()[0]
    
    print("\nFinal record counts:")
    print(f"Customers: {customer_count}")
    print(f"Rental Items Catalog: {catalog_count}")
    print(f"Customer Rental Items: {customer_item_count}")
    print(f"Direct Sales Products: {product_count}")
    print(f"Routes: {route_count}")
    print(f"Route Load Summaries: {load_summary_count}")
    
except Exception as e:
    master_conn.rollback()
    print(f"Error during migration: {e}")
    import traceback
    traceback.print_exc()
    
finally:
    # Close all connections
    items_conn.close()
    routes_conn.close()
    mission_conn.close()
    products_conn.close()
    master_conn.close()
