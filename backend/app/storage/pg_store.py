import uuid
from datetime import datetime
from typing import Optional
from psycopg2.extras import Json
from .connection import get_db_cursor

class PgRelationalStore:
    def __init__(self, table_name: str, columns: list, json_cols: list = None):
        self.table_name = table_name
        self.columns = columns
        self.json_cols = json_cols or []

    def _map_row(self, row) -> dict:
        if not row:
            return None
        res = {}
        for col, val in zip(self.columns, row):
            if isinstance(val, datetime):
                res[col] = val.isoformat()
            else:
                res[col] = val
        return res

    def get(self, key: str) -> Optional[dict]:
        query = f"SELECT {', '.join(self.columns)} FROM {self.table_name} WHERE id = %s"
        with get_db_cursor() as cur:
            cur.execute(query, (key,))
            row = cur.fetchone()
            return self._map_row(row) if row else None

    def all(self) -> dict:
        query = f"SELECT {', '.join(self.columns)} FROM {self.table_name}"
        with get_db_cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return {r[0]: self._map_row(r) for r in rows}

    def values(self) -> list:
        query = f"SELECT {', '.join(self.columns)} FROM {self.table_name}"
        with get_db_cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return [self._map_row(r) for r in rows]

    def set(self, key: str, value: dict):
        val_copy = dict(value)
        val_copy["id"] = key
        
        placeholders = []
        vals = []
        for col in self.columns:
            v = val_copy.get(col)
            placeholders.append("%s")
            if col in self.json_cols:
                vals.append(Json(v) if v is not None else None)
            else:
                vals.append(v)

        update_assignments = [f"{col} = EXCLUDED.{col}" for col in self.columns if col != "id"]
        
        query = f"""
            INSERT INTO {self.table_name} ({', '.join(self.columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (id) DO UPDATE SET {', '.join(update_assignments)}
        """
        with get_db_cursor() as cur:
            cur.execute(query, tuple(vals))

    def delete(self, key: str):
        query = f"DELETE FROM {self.table_name} WHERE id = %s"
        with get_db_cursor() as cur:
            cur.execute(query, (key,))

    def find(self, **kwargs) -> list:
        query = f"SELECT {', '.join(self.columns)} FROM {self.table_name}"
        params = []
        if kwargs:
            conds = []
            for k, v in kwargs.items():
                conds.append(f"{k} = %s")
                params.append(v)
            query += " WHERE " + " AND ".join(conds)
        with get_db_cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [self._map_row(r) for r in rows]

    def find_one(self, **kwargs) -> Optional[dict]:
        res = self.find(**kwargs)
        return res[0] if res else None


class PgRelationalListStore(PgRelationalStore):
    def all(self) -> list:
        query = f"SELECT {', '.join(self.columns)} FROM {self.table_name}"
        with get_db_cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            return [self._map_row(r) for r in rows]

    def add(self, item: dict):
        item_id = item.get("id") or str(uuid.uuid4())
        self.set(item_id, item)

    def update_by_id(self, item_id: str, updates: dict, id_field: str = "id"):
        current = self.get(item_id)
        if current:
            current.update(updates)
            self.set(item_id, current)

    def delete_by_id(self, item_id: str, id_field: str = "id"):
        self.delete(item_id)
