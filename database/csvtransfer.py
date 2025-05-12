import sqlite3
import csv
import os

def export_all_tables_to_one_csv(db_path, output_csv):
    # Connect to the SQLite database.
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all table names.
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]

    if not tables:
        print("No tables found in the database.")
        return

    # Build the union of columns from all tables.
    union_columns = set()
    table_columns = {}  # Dictionary mapping table name to its list of columns.
    for table in tables:
        # Use PRAGMA table_info to get column details.
        cursor.execute(f"PRAGMA table_info({table});")
        info = cursor.fetchall()
        cols = [col[1] for col in info]  # col[1] is the column name.
        table_columns[table] = cols
        union_columns.update(cols)

    # Sort the union of columns to have a consistent order.
    union_columns = sorted(list(union_columns))
    
    # Open the CSV file for writing.
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        # Write header: an extra "table_name" column followed by the union of all columns.
        header = ['table_name'] + union_columns
        writer.writerow(header)

        # Process each table and append its rows.
        for table in tables:
            cursor.execute(f"SELECT * FROM {table};")
            rows = cursor.fetchall()
            cols = table_columns[table]  # Actual columns for this table.
            
            # For each row, create a dictionary mapping column names to their values.
            for row in rows:
                row_dict = dict(zip(cols, row))
                # Create a full row matching the header.
                full_row = [table] + [row_dict.get(col, '') for col in union_columns]
                writer.writerow(full_row)

    conn.close()
    print(f"All tables have been exported to {output_csv}.")

if __name__ == '__main__':
    db_file = 'master.db'
    output_csv = 'combined_output.csv'
    
    if not os.path.isfile(db_file):
        print(f"Database file '{db_file}' does not exist in the current directory.")
    else:
        export_all_tables_to_one_csv(db_file, output_csv)
