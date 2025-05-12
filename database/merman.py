import sqlite3

def generate_mermaid_diagram(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables_query = "SELECT name FROM sqlite_master WHERE type='table';"
    cursor.execute(tables_query)
    tables = [row[0] for row in cursor.fetchall()]

    diagram = "erDiagram\n"

    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()

        diagram += f"    {table} {{\n"
        for col in columns:
            col_name, col_type = col[1], col[2]
            diagram += f"        {col_type} {col_name}\n"
        diagram += "    }\n\n"

    conn.close()
    return diagram

# Run and print the Mermaid diagram
db_path = "/home/xoom000/mission_api/database/master.db"  # Change this to your actual DB path
print(generate_mermaid_diagram(db_path))
