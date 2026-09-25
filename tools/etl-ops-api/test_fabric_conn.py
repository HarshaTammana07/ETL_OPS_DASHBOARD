"""Test connection to Microsoft Fabric SQL Analytics Endpoint using Azure CLI token."""

import json
import struct
import subprocess
import pyodbc

SERVER = "ziupvjpf2lfe3ey7dnmuxchh44-7n7qtrmow4oujflvvav2yi6kza.datawarehouse.fabric.microsoft.com"
DATABASE = "bhg_bronze"

print(f"Connecting to Fabric endpoint: {SERVER}", flush=True)
print(f"Database: {DATABASE}", flush=True)

try:
    print("Getting Azure access token...", flush=True)
    res = subprocess.run(
        "az account get-access-token --resource https://database.windows.net",
        shell=True,
        capture_output=True,
        text=True,
        check=True,
    )
    token_data = json.loads(res.stdout)
    access_token = token_data["accessToken"]
    print(" Token acquired successfully!", flush=True)

    # Encode token for SQL_COPT_SS_ACCESS_TOKEN (attribute 1256 in ODBC Driver 18)
    token_bytes = access_token.encode("utf-16-le")
    token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)

    conn_str = (
        f"Driver={{ODBC Driver 18 for SQL Server}};"
        f"Server={SERVER};"
        f"Database={DATABASE};"
        f"Encrypt=yes;"
        f"TrustServerCertificate=no;"
    )

    print("Connecting to Fabric endpoint via pyodbc...", flush=True)
    conn = pyodbc.connect(conn_str, attrs_before={1256: token_struct}, timeout=30)
    cursor = conn.cursor()
    print(" Connected successfully to Microsoft Fabric!\n", flush=True)

    # Test query 1: check meta tables row counts
    print("--- Live Table Row Counts in [meta] ---", flush=True)
    tables = ["pipelinerun", "taskaudit", "taskqueue", "taskconfig", "etlconfig", "dataquality"]
    for t in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM [meta].[{t}]")
            count = cursor.fetchone()[0]
            print(f"  [meta].[{t}]: {count:,} rows", flush=True)
        except Exception as e:
            print(f"  [meta].[{t}]: Error -> {e}", flush=True)

    # Test query 2: recent 3 runs
    print("\n--- Recent 3 Live Pipeline Runs from Fabric ---", flush=True)
    cursor.execute("""
        SELECT TOP 3 RunId, PipelineRunId, ConfigName, Status, StartTime
        FROM [meta].[pipelinerun]
        ORDER BY StartTime DESC
    """)
    for row in cursor.fetchall():
        print(f"  RunId: {row[0]} | Config: {row[2]} | Status: {row[3]} | Start: {row[4]}", flush=True)

    conn.close()
    print("\n Fabric connection test completed successfully!", flush=True)

except Exception as err:
    print(f"\n Connection failed: {err}", flush=True)
