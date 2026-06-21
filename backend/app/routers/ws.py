from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
from typing import Dict, List
from app.logger import logger

router = APIRouter(prefix="/ws", tags=["websockets"])

# Global task database
# task_id -> { "task_id": str, "status": str, "progress": float, "message": str, "result": dict, "error": str }
tasks_db: Dict[str, dict] = {}
tasks_lock = asyncio.Lock()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, task_id: str):
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = []
        self.active_connections[task_id].append(websocket)
        
        # Send initial status
        async with tasks_lock:
            current_status = tasks_db.get(task_id, {
                "task_id": task_id,
                "status": "unknown",
                "progress": 0.0,
                "message": "Nhiệm vụ chưa được khởi tạo",
                "result": None,
                "error": None
            })
        await websocket.send_json(current_status)

    def disconnect(self, websocket: WebSocket, task_id: str):
        if task_id in self.active_connections:
            if websocket in self.active_connections[task_id]:
                self.active_connections[task_id].remove(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]

    async def broadcast_task_update(self, task_id: str, data: dict):
        if task_id in self.active_connections:
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_json(data)
                except Exception as e:
                    # Connection might be closed, clean up in disconnect
                    pass

manager = ConnectionManager()

async def update_task_progress(
    task_id: str,
    status: str,
    progress: float,
    message: str = "",
    result: dict = None,
    error: str = None
):
    data = {
        "task_id": task_id,
        "status": status,
        "progress": round(progress, 2),
        "message": message,
        "result": result,
        "error": error
    }
    async with tasks_lock:
        tasks_db[task_id] = data
    
    await manager.broadcast_task_update(task_id, data)

@router.websocket("/tasks/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await manager.connect(websocket, task_id)
    try:
        while True:
            # We receive message from client, usually just keep-alive/pings
            # receive_text is blocking until client sends anything or disconnects
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)
    except Exception as e:
        logger.error(f"WebSocket error on task {task_id}: {e}")
        manager.disconnect(websocket, task_id)
