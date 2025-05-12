import sqlite3
import os
import time
import sys

# Base directory
BASE_DIR = '/home/xoom000/mission_api'

# Path to old databases
ITEMS_DB = os.path.join(BASE_DIR, 'items.db')
ROUTES_DB = os.path.join(BASE_DIR, 'routes.db')
MISSION_DATA_DB = os.path.join(BASE_DIR, 'MissionData.db')
PRODUCTS_DB = os.path.join(BASE_DIR, 'products.db')

# Path to new database
MASTER_DB = os.path.join(BASE_DIR, 'database/master.db')

print("Starting step-by-step migration...")

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

def migrate_categories():
    """Migrate categories from products.db to master.db"""
    try:
        print("\n1. Migrating categories...")
        products_cur.execute("SELECT id, name, description FROM categories")
        categories = products_cur.fetchall()
        
        for category in categories:
            try:
                master_cur.execute(
                    "INSERT INTO categories (id, name, description) VALUES (?, ?, ?)",
                    category
                )
                master_conn.commit()
            except sqlite3.IntegrityError as e:
                print(f"  Error inserting category {category[0]}: {e}")
                continue
        
        master_cur.execute("SELECT COUNT(*) FROM categories")
        count = master_cur.fetchone()[0]
        print(f"Migrated {count} categories")
        return True
    except Exception as e:
        print(f"Error migrating categories: {e}")
        return False

def migrate_products():
    """Migrate products from products.db to direct_sales in master.db"""
    try:
        print("\n2. Migrating products...")
        products_cur.execute("""
            SELECT sku, name, description, base_price, category_id, vendor, is_active
            FROM products
        """)
        products = products_cur.fetchall()
        
        migrated = 0
        for product in products:
            try:
                # Add stock_quantity and image_url columns (default to 0 and NULL)
                product_with_defaults = product + (0, None)
                
                master_cur.execute(
                    """
                    INSERT INTO direct_sales 
                    (sku, name, description, base_price, category_id, vendor, is_active, stock_quantity, image_url)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    product_with_defaults
                )
                master_conn.commit()
                migrated += 1
            except sqlite3.IntegrityError as e:
                print(f"  Error inserting product {product[0]}: {e}")
                continue
        
        print(f"Migrated {migrated} products")
        return True
    except Exception as e:
        print(f"Error migrating products: {e}")
        return False

def migrate_customers():
    """Migrate customers from routes.db to master.db"""
    try:
        print("\n3. Migrating customers...")
        routes_cur.execute("""
            SELECT CustomerNumber, AccountName, Address, City, State, ZipCode, 
                   RouteNumber, ServiceFrequency, ServiceDays
            FROM routes
        """)
        customers = routes_cur.fetchall()
        
        now = time.strftime('%Y-%m-%d %H:%M:%S')
        migrated = 0
        
        for customer in customers:
            try:
                # Add email, phone, and CreatedAt columns
                customer_with_defaults = customer + (None, None, now)
                
                master_cur.execute(
                    """
                    INSERT INTO customers 
                    (CustomerNumber, AccountName, Address, City, State, ZipCode, 
                     RouteNumber, ServiceFrequency, ServiceDays, Email, Phone, CreatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    customer_with_defaults
                )
                master_conn.commit()
                migrated += 1
            except sqlite3.IntegrityError as e:
                print(f"  Error inserting customer {customer[0]}: {e}")
                continue
        
        print(f"Migrated {migrated} customers")
        return True
    except Exception as e:
        print(f"Error migrating customers: {e}")
        return False

def migrate_rental_catalog():
    """Create rental_items_catalog from items.db"""
    try:
        print("\n4. Creating rental items catalog...")
        items_cur.execute("""
            SELECT DISTINCT item_id, description
            FROM items
            ORDER BY item_id
        """)
        unique_items = items_cur.fetchall()
        
        migrated = 0
        for item in unique_items:
            try:
                item_id, description = item
                
                master_cur.execute(
                    """
                    INSERT INTO rental_items_catalog 
                    (item_id, description, category, is_active, standardization_score)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (item_id, description, 'General', 1, 0)
                )
                master_conn.commit()
                migrated += 1
            except sqlite3.IntegrityError as e:
                print(f"  Error inserting catalog item {item[0]}: {e}")
                continue
        
        print(f"Created {migrated} catalog items")
        return True
    except Exception as e:
        print(f"Error creating rental items catalog: {e}")
        return False

def migrate_customer_rental_items():
    """Migrate customer-specific rental items"""
    try:
        print("\n5. Migrating customer rental items...")
        items_cur.execute("""
            SELECT item_id, description, customer_num, quantity_used, route
            FROM items
        """)
        items = items_cur.fetchall()
        
        migrated = 0
        for item in items:
            try:
                item_id, description, customer_num, quantity_used, route = item
                
                # Calculate delivery day from route
                delivery_day = (route % 5) + 1 if route else 1
                
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
                master_conn.commit()
                migrated += 1
            except sqlite3.IntegrityError as e:
                print(f"  Error inserting customer rental item: {e}")
                continue
        
        print(f"Migrated {migrated} customer rental items")
        return True
    except Exception as e:
        print(f"Error migrating customer rental items: {e}")
        return False

def migrate_routes():
    """Extract unique routes and create route records"""
    try:
        print("\n6. Creating route records...")
        routes_cur.execute("SELECT DISTINCT RouteNumber FROM routes ORDER BY RouteNumber")
        unique_routes = routes_cur.fetchall()
        
        day_map = {
            'M': 'Monday',
            'T': 'Tuesday',
            'W': 'Wednesday',
            'Th': 'Thursday',
            'F': 'Friday'
        }
        
        migrated = 0
        for route in unique_routes:
            try:
                route_number = route[0]
                
                # Get service days for this route
                routes_cur.execute("SELECT ServiceDays FROM routes WHERE RouteNumber = ? LIMIT 1", (route_number,))
                result = routes_cur.fetchone()
                service_day = 'Monday'  # Default
                
                if result and result[0]:
                    # Extract first day from ServiceDays (often formatted like "M, W, F")
                    first_day = result[0].split(',')[0].strip()
                    service_day = day_map.get(first_day, 'Monday')
                
                # Process route number
                if isinstance(route_number, str) and '-' in route_number:
                    parts = route_number.split('-')
                    if len(parts) == 2:
                        plant_number, route_int = parts
                        master_cur.execute(
                            """
                            INSERT INTO routes 
                            (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (route_number, int(route_int), f"Driver for Route {route_int}", 
                             int(plant_number), service_day)
                        )
                    else:
                        master_cur.execute(
                            """
                            INSERT INTO routes 
                            (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (str(route_number), None, f"Driver for Route {route_number}", 
                             None, service_day)
                        )
                else:
                    # Handle numeric or other formats
                    try:
                        route_int = int(route_number)
                        master_cur.execute(
                            """
                            INSERT INTO routes 
                            (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (str(route_number), route_int, f"Driver for Route {route_number}", 
                             None, service_day)
                        )
                    except (ValueError, TypeError):
                        master_cur.execute(
                            """
                            INSERT INTO routes 
                            (RouteNumber, RouteInt, DriverName, PlantNumber, ServiceDay)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (str(route_number), None, f"Driver for Route {route_number}", 
                             None, service_day)
                        )
                
                master_conn.commit()
                migrated += 1
            except Exception as e:
                print(f"  Error creating route record for {route[0]}: {e}")
                continue
        
        print(f"Created {migrated} route records")
        return True
    except Exception as e:
        print(f"Error creating route records: {e}")
        return False

def calculate_route_loads():
    """Calculate route load summaries based on customer rental items"""
    try:
        print("\n7. Calculating route load summaries...")
        # First check if we have the necessary tables populated
        master_cur.execute("SELECT COUNT(*) FROM customer_rental_items")
        customer_item_count = master_cur.fetchone()[0]
        
        master_cur.execute("SELECT COUNT(*) FROM customers")
        customer_count = master_cur.fetchone()[0]
        
        master_cur.execute("SELECT COUNT(*) FROM routes")
        route_count = master_cur.fetchone()[0]
        
        if customer_item_count == 0 or customer_count == 0 or route_count == 0:
            print("Warning: Cannot calculate route loads - missing prerequisite data")
            return False
        
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
        master_conn.commit()
        
        master_cur.execute("SELECT COUNT(*) FROM route_load_summary")
        load_summary_count = master_cur.fetchone()[0]
        print(f"Created {load_summary_count} route load summary records")
        return True
    except Exception as e:
        print(f"Error calculating route load summaries: {e}")
        return False

def create_admin_account():
    """Create a default SuperAdmin driver account"""
    try:
        print("\n8. Creating default SuperAdmin account...")
        now = time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Check for existing routes to assign to the admin
        master_cur.execute("SELECT RouteNumber FROM routes LIMIT 1")
        result = master_cur.fetchone()
        route_number = "33"
        if result:
            route_number = result[0]
            
        # Sample bcrypt hash for password 'admin123'
        admin_password_hash = '$2b$10$XH0yWAP7WZYCQiEVJ7Cy5u1j.JbPl0kJqN75YDz.O4vszTyFdPJUm'
        
        master_cur.execute(
            """
            INSERT INTO drivers (name, email, password_hash, route_number, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("Admin User", "admin@example.com", admin_password_hash, route_number, "SuperAdmin", now)
        )
        master_conn.commit()
        
        print("Created SuperAdmin user (email: admin@example.com, password: admin123)")
        return True
    except Exception as e:
        print(f"Error creating admin account: {e}")
        return False

def update_fts_index():
    """Update the customers_fts full-text search index"""
    try:
        print("\n9. Updating full-text search index...")
        master_cur.execute("DELETE FROM customers_fts")
        master_cur.execute("INSERT INTO customers_fts(rowid, AccountName) SELECT CustomerNumber, AccountName FROM customers")
        master_conn.commit()
        
        print("Updated full-text search index for customers")
        return True
    except Exception as e:
        print(f"Error updating full-text search index: {e}")
        return False

def update_standardization_scores():
    """Calculate and update standardization_score for rental items"""
    try:
        print("\n10. Calculating standardization scores...")
        master_cur.execute("""
            UPDATE rental_items_catalog
            SET standardization_score = (
                SELECT COUNT(DISTINCT CustomerNumber)
                FROM customer_rental_items AS r
                WHERE r.item_id = rental_items_catalog.item_id
            )
        """)
        master_conn.commit()
        
        print("Updated standardization scores for rental items")
        return True
    except Exception as e:
        print(f"Error calculating standardization scores: {e}")
        return False

def print_status():
    """Print current database status"""
    try:
        print("\nCurrent Database Status:")
        
        tables = [
            "customers", "rental_items_catalog", "customer_rental_items", 
            "direct_sales", "routes", "route_load_summary", "drivers"
        ]
        
        for table in tables:
            master_cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = master_cur.fetchone()[0]
            print(f"{table}: {count} records")
        
        return True
    except Exception as e:
        print(f"Error printing status: {e}")
        return False

if __name__ == "__main__":
    try:
        # Clean existing tables
        print("\nCleaning existing tables (optional step)...")
        choice = input("Do you want to delete existing data before migration? (y/n): ").lower()
        
        if choice == 'y':
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
                    master_conn.commit()
                    print(f"  Cleaned {table}")
                except sqlite3.OperationalError as e:
                    print(f"  Warning: {e}")
            
            master_cur.execute("DELETE FROM sqlite_sequence")
            master_conn.commit()
        
        # Run each migration step separately
        steps = [
            ("Categories", migrate_categories),
            ("Products", migrate_products),
            ("Customers", migrate_customers),
            ("Rental Items Catalog", migrate_rental_catalog),
            ("Customer Rental Items", migrate_customer_rental_items),
            ("Routes", migrate_routes),
            ("Route Load Summaries", calculate_route_loads),
            ("Admin Account", create_admin_account),
            ("Full-Text Search Index", update_fts_index),
            ("Standardization Scores", update_standardization_scores)
        ]
        
        for i, (name, func) in enumerate(steps, 1):
            print(f"\nStep {i}/{len(steps)}: Migrating {name}")
            choice = input(f"Run this step? (y/n): ").lower()
            
            if choice == 'y':
                success = func()
                if success:
                    print(f"✓ Step {i} completed successfully")
                else:
                    print(f"✗ Step {i} failed")
                    
                # Print current status
                print_status()
            else:
                print(f"Skipped step {i}")
        
        print("\nMigration process complete!")
        
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Close all connections
        items_conn.close()
        routes_conn.close()
        mission_conn.close()
        products_conn.close()
        master_conn.close()
