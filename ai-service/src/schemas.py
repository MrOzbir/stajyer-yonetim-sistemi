from pydantic import BaseModel
from typing import List, Optional

class TaskData(BaseModel):
    title: str
    status: str
    repoLink: Optional[str]
    createdAt: str

class ArchiveData(BaseModel):
    content: str
    date: str

class LogData(BaseModel):
    loginTime: str
    logoutTime: Optional[str]

class InternPayload(BaseModel):
    id: int
    name: str
    surname: str
    tasksReceived: List[TaskData]
    archives: List[ArchiveData]
    logs: List[LogData]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    messages: List[ChatMessage] = []
    context: Optional[dict] = None