#!/usr/bin/env python3
"""
Complete Route Stops Extractor

This script extracts ALL stops for a specific route and day from the SQLite database,
including stops that may not have rental items associated with them.
"""

import sqlite3
import csv
import os
import sys
import argparse
from datetime import datetime

def create_connection(db_file):
    """Create a database connection to the SQLite database"""
    conn = None
    try:
        conn = sqlite3.connect(db_file)
        print(f"Connected to database: {db_file}")
        return conn
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}")
        return None

def execute_query(conn, query, params=(), verbose=False):
    """Execute a query with parameters and return the results"""
    try:
        cur = conn.cursor()
        if verbose:
            print(f"Executing query: {query}")
            print(f"With parameters: {params}")
        cur.execute(query, params)
        rows = cur.fetchall()
        if verbose:
            print(f"Query returned {len(rows)} rows")
        return rows
    except sqlite3.Error as e:
        print(f"Error executing query: {e}")
        print(f"Query was: {query}")
        print(f"Parameters were: {params}")
        return []

def extract_all_route_stops(conn, route_number, day, output_file=None, verbose=False):
    """Extract ALL stops for a specific route and day, regardless of rental items"""
    try:
        # Determine day code
        day_code = day[0].upper()  # Get first letter (M for Monday, etc.)
        
        # First, get ALL customers on this route with this service day
        # This includes customers with direct F day and those with MWF service
        customers_query = """
        SELECT DISTINCT c.CustomerNumber, c.AccountName, c.Address, c.City, c.State, c.ZipCode, 
               c.RouteNumber, r.ServiceDay, c.ServiceDays
        FROM customers c
        JOIN routes r ON c.RouteNumber = r.RouteNumber
        WHERE (c.RouteNumber LIKE ? OR r.RouteInt = ?)
        AND (r.ServiceDay = ? 
             OR c.ServiceDays LIKE ? 
             OR c.ServiceDays = 'MWF'
             OR c.ServiceDays LIKE '%F%')
        ORDER BY c.AccountName
        """
        
        customers = execute_query(
            conn, 
            customers_query, 
            (f"%{route_number}%", route_number, day_code, f"%{day_code}%"), 
            verbose
        )
        
        if not customers:
            print(f"\nNo customers found for route {route_number} on {day} (code: {day_code}).")
            return False
        
        print(f"\nFound {len(customers)} customers for route {route_number} on {day}:")
        for i, customer in enumerate(customers[:5], 1):
            print(f"  {i}. {customer[1]} (#{customer[0]}) - Address: {customer[2]}")
        
        if len(customers) > 5:
            print(f"  ... and {len(customers) - 5} more")
        
        # Now get rental items for these customers (if any)
        customer_numbers = [customer[0] for customer in customers]
        placeholders = ','.join(['?' for _ in customer_numbers])
        
        items_query = f"""
        SELECT 
            c.CustomerNumber,
            c.AccountName,
            cri.item_id,
            cri.description,
            cri.quantity_used,
            cri.delivery_frequency,
            cri.delivery_day,
            cri.customer_price,
            c.RouteNumber,
            c.Address
        FROM 
            customers c
        LEFT JOIN 
            customer_rental_items cri ON c.CustomerNumber = cri.CustomerNumber
        WHERE 
            c.CustomerNumber IN ({placeholders})
        ORDER BY 
            c.AccountName, cri.description
        """
        
        items = execute_query(conn, items_query, tuple(customer_numbers), verbose)
        
        # Create a map of customers to their items
        customer_items = {}
        for item in items:
            customer_number = item[0]
            if customer_number not in customer_items:
                customer_items[customer_number] = []
            
            # Only add non-null items
            if item[2] is not None:  # If item_id is not null
                customer_items[customer_number].append({
                    'item_id': item[2],
                    'description': item[3],
                    'quantity': item[4],
                    'delivery_frequency': item[5],
                    'delivery_day': item[6],
                    'price': item[7]
                })
        
        # Prepare output data including ALL customers, even those without items
        output_data = []
        for customer in customers:
            customer_number = customer[0]
            customer_name = customer[1]
            address = customer[2]
            
            # If customer has items, add each item
            if customer_number in customer_items and customer_items[customer_number]:
                for item in customer_items[customer_number]:
                    output_data.append({
                        'CustomerNumber': customer_number,
                        'AccountName': customer_name,
                        'Address': address,
                        'ItemID': item['item_id'],
                        'Description': item['description'],
                        'Quantity': item['quantity'],
                        'DeliveryFrequency': item['delivery_frequency'],
                        'DeliveryDay': item['delivery_day'],
                        'Price': item['price'],
                        'RouteNumber': customer[6]
                    })
            else:
                # Add a row with just customer info and nulls for item data
                output_data.append({
                    'CustomerNumber': customer_number,
                    'AccountName': customer_name,
                    'Address': address,
                    'ItemID': None,
                    'Description': None,
                    'Quantity': None,
                    'DeliveryFrequency': None,
                    'DeliveryDay': None,
                    'Price': None,
                    'RouteNumber': customer[6]
                })
        
        # Generate a summary of total quantities needed
        item_totals = {}
        for item in items:
            if item[3]:  # If description is not null
                description = item[3]
                quantity = item[4] or 0
                
                if description not in item_totals:
                    item_totals[description] = 0
                
                item_totals[description] += quantity
        
        print("\nTotal quantities needed:")
        for desc, qty in sorted(item_totals.items(), key=lambda x: x[1], reverse=True):
            if desc:  # Only print if description is not None
                print(f"  {desc}: {qty}")
        
        # Output to CSV if a filename is provided
        if output_file:
            with open(output_file, 'w', newline='') as f:
                fieldnames = ['CustomerNumber', 'AccountName', 'Address', 'ItemID', 'Description', 
                             'Quantity', 'DeliveryFrequency', 'DeliveryDay', 'Price', 'RouteNumber']
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(output_data)
            
            print(f"\nComplete route list exported to: {output_file}")
            
            # Also create a summary file
            summary_file = os.path.splitext(output_file)[0] + '_summary.csv'
            with open(summary_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['Description', 'TotalQuantity'])
                for desc, qty in sorted(item_totals.items(), key=lambda x: x[1], reverse=True):
                    if desc:  # Only write if description is not None
                        writer.writerow([desc, qty])
            
            print(f"Summary exported to: {summary_file}")
            
            # Create a customer-only file
            customers_file = os.path.splitext(output_file)[0] + '_customers.csv'
            with open(customers_file, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['CustomerNumber', 'AccountName', 'Address', 'RouteNumber', 'ServiceDay', 'ServiceDays'])
                for customer in customers:
                    writer.writerow([customer[0], customer[1], customer[2], customer[6], customer[7], customer[8]])
            
            print(f"Customers list exported to: {customers_file}")
        
        return True
    except sqlite3.Error as e:
        print(f"Error extracting route stops: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Extract ALL route stops from database')
    parser.add_argument('database', help='Path to the SQLite database file')
    parser.add_argument('route', help='Route number (e.g., 33)')
    parser.add_argument('day', help='Day of week (e.g., Friday)')
    parser.add_argument('-o', '--output', help='Output CSV file')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose output')
    
    args = parser.parse_args()
    
    # Default output filename if not provided
    if not args.output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        args.output = f"route_{args.route}_{args.day.lower()}_{timestamp}_complete.csv"
    
    # Connect to the database
    conn = create_connection(args.database)
    if not conn:
        return
    
    try:
        # Extract load list
        success = extract_all_route_stops(conn, args.route, args.day, args.output, args.verbose)
        
        if not success:
            print("\nTroubleshooting steps:")
            print("1. Verify the route number and day are correct")
            print("2. Check that customers exist with the specified route and service day")
            print("3. Try using different service day patterns (e.g., 'F', '%F%', 'MWF')")
            print("4. Try running with --verbose flag for more detailed output")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
