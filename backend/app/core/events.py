from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Callable, Any, Awaitable
import asyncio

EventHandler = Callable[..., Awaitable[None]]


@dataclass
class Event:
    name: str
    payload: dict
    timestamp: datetime = field(default_factory=datetime.utcnow)


class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[EventHandler]] = {}

    def subscribe(self, event_name: str, handler: EventHandler):
        self._subscribers.setdefault(event_name, []).append(handler)

    def unsubscribe(self, event_name: str, handler: EventHandler):
        self._subscribers.get(event_name, []).remove(handler)

    async def publish(self, event: Event):
        handlers = self._subscribers.get(event.name, [])
        if not handlers:
            return
        results = await asyncio.gather(
            *[h(event) for h in handlers], return_exceptions=True
        )
        for r in results:
            if isinstance(r, Exception):
                print(f"[EventBus] Handler failed for {event.name}: {r}")


event_bus = EventBus()
