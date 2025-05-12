import sqlite3
import os

def generate_schema_info(db_path, output_file):
    # Connect to the SQLite database.
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Retrieve all table names.
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]

    with open(output_file, 'w', encoding='utf-8') as f:
        for table in tables:
            f.write(f"Table: {table}\n")
            f.write("Columns:\n")
            # Get column information for the current table.
            cursor.execute(f"PRAGMA table_info({table});")
            columns = cursor.fetchall()
            for col in columns:
                # PRAGMA returns:
                # col[0] = cid, col[1] = name, col[2] = type,
                # col[3] = notnull, col[4] = default_value, col[5] = pk
                f.write(f"  - cid: {col[0]}, name: {col[1]}, type: {col[2]}, notnull: {col[3]}, default: {col[4]}, pk: {col[5]}\n")
            f.write("\n")
    
    conn.close()

if __name__ == '__main__':
    db_file = 'master.db'
    output_file = 'database_schema.txt'
    
    if os.path.isfile(db_file):
        generate_schema_info(db_file, output_file)
        print(f"Database schema information written to '{output_file}'.")
    else:
        print(f"Database file '{db_file}' not found in the current directory.")
