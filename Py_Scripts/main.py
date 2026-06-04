
import datetime as dt
import time
import psutil
import win32gui
import win32process

from config import (
    TARGET_PROCESS_NAME,
    CHECK_INTERVAL_SECONDS,
    HEATMAP_REFRESH_MINUTES,
)
from database import init_db, add_seconds
from heatmap import generate_heatmap

def is_zotero_foreground():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return False
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        proc = psutil.Process(pid)
        return proc.name().lower() == TARGET_PROCESS_NAME.lower()
    except Exception:
        return False

def today():
    return dt.date.today().isoformat()

def main():
    init_db()
    generate_heatmap()

    last_refresh = time.time()

    print("Zotero Reading Tracker started")

    while True:
        if is_zotero_foreground():
            add_seconds(today(), CHECK_INTERVAL_SECONDS)
            print(dt.datetime.now().strftime("%H:%M:%S"),
                  "Zotero Active")

        if time.time() - last_refresh >= HEATMAP_REFRESH_MINUTES * 60:
            generate_heatmap()
            print("Heatmap refreshed")
            last_refresh = time.time()

        time.sleep(CHECK_INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
