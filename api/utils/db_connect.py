import sqlite3
import os

def get_db_connection():
    """Get SQLite connection for now, will switch to PostgreSQL later"""
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'taxi_mock.db')
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Return dict-like rows
    return conn

def dict_from_row(row):
    """Convert sqlite3.Row to dictionary"""
    return dict(row)