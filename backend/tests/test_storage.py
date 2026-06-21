import pytest
import json
from app.storage import JsonStore, ListStore

def test_json_store_crud(tmp_path):
    file_path = tmp_path / "test_store.json"
    store = JsonStore(file_path)
    
    # 1. Set/Get
    store.set("key1", {"name": "Alice", "age": 20})
    assert store.get("key1") == {"name": "Alice", "age": 20}
    
    # 2. Find
    store.set("key2", {"name": "Bob", "age": 20})
    results = store.find(age=20)
    assert len(results) == 2
    
    # 3. Delete
    store.delete("key1")
    assert store.get("key1") is None
    assert len(store.all()) == 1

def test_list_store_crud(tmp_path):
    file_path = tmp_path / "test_list_store.json"
    store = ListStore(file_path)
    
    # 1. Add
    store.add({"id": "1", "name": "Item 1"})
    store.add({"id": "2", "name": "Item 2"})
    assert len(store.all()) == 2
    
    # 2. Update by ID
    store.update_by_id("1", {"name": "Updated Item 1"})
    item = store.find_one(id="1")
    assert item["name"] == "Updated Item 1"
    
    # 3. Delete by ID
    store.delete_by_id("2")
    assert len(store.all()) == 1

def test_json_store_backup_and_recovery(tmp_path):
    file_path = tmp_path / "test_backup.json"
    store = JsonStore(file_path)
    
    store.set("user1", {"name": "John"})
    assert file_path.exists()
    
    # Verify backup exists after update
    store.set("user1", {"name": "John Doe"})
    backup_path = file_path.with_suffix(".json.bak")
    assert backup_path.exists()
    
    # Corrupt main file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("{invalid json...")
        
    # Re-initialize should recover from backup (which holds the previous good state)
    recovered_store = JsonStore(file_path)
    assert recovered_store.get("user1") == {"name": "John"}
