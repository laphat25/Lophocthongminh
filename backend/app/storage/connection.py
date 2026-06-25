import warnings
import contextlib
from psycopg2.pool import ThreadedConnectionPool
from app.config import DATABASE_URL

db_pool = None
is_postgres_active = False

if DATABASE_URL:
    try:
        db_pool = ThreadedConnectionPool(1, 20, DATABASE_URL)
        print("Successfully connected to PostgreSQL database pool.")
        is_postgres_active = True
    except Exception as e:
        warnings.warn(f"Failed to connect to PostgreSQL pool: {e}. Falling back to Local JSON store.")
        db_pool = None
        is_postgres_active = False

@contextlib.contextmanager
def get_db_cursor():
    if not db_pool:
        raise RuntimeError("PostgreSQL database pool is not initialized.")
    conn = db_pool.getconn()
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        db_pool.putconn(conn)
