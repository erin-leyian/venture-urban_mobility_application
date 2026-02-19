import sqlite3
import os

def get_db_connection():
    # Use the mock DB created from sample_trips.parquet
    db_path = os.path.join(
        os.path.dirname(__file__),
        '..', 'data', 'taxi_mock.db'
    )

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def dict_from_row(row):
    return dict(row)