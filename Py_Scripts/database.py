
import sqlite3
from config import DB_PATH

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS reading_time (
        date TEXT PRIMARY KEY,
        seconds INTEGER NOT NULL DEFAULT 0
    )
    """)
    conn.commit()
    conn.close()

def add_seconds(day, seconds):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT seconds FROM reading_time WHERE date=?", (day,))
    row = cur.fetchone()
    if row:
        cur.execute("UPDATE reading_time SET seconds=? WHERE date=?",
                    (row[0] + seconds, day))
    else:
        cur.execute("INSERT INTO reading_time(date,seconds) VALUES(?,?)",
                    (day, seconds))
    conn.commit()
    conn.close()

def load_all():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT date, seconds FROM reading_time ORDER BY date"
    ).fetchall()
    conn.close()
    return rows
