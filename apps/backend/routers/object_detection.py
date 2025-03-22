from fastapi import APIRouter, WebSocket
from services import object_detection_service
import asyncio

router = APIRouter()

@router.websocket("/ws/detect-objects")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            detection_result = object_detection_service.process_frame(data)
            await websocket.send_json(detection_result)
            await asyncio.sleep(0.05)  # Control frame rate (~20 FPS)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
