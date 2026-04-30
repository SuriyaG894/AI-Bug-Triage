from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class BugBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    priority: Optional[str] = None
    severity: Optional[str] = None
    repro_steps: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None
    attachments: Optional[List[Any]] = None
    assigned_to: Optional[str] = None


class BugCreate(BugBase):
    created_by: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None
    reporter_id: Optional[int] = None
    duplicate_justification: Optional[str] = None
    duplicate_of_external_ids: Optional[List[str]] = None


class BugUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    priority: Optional[str] = None
    severity: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    repro_steps: Optional[str] = None
    expected_result: Optional[str] = None
    actual_result: Optional[str] = None


class BugSuggestionRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    repro_steps: Optional[str] = None


class BugSuggestionResponse(BaseModel):
    priority: str
    severity: str
    bug_type: str
    confidence: float
    reasoning: str


class BugResponse(BugBase):
    id: int
    type: str
    status: str
    source: str
    external_id: Optional[str]
    push_to_external: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    duplicate_justification: Optional[str] = None
    duplicate_of_external_ids: Optional[List[str]] = None

    class Config:
        from_attributes = True


class BugSuggestionRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    repro_steps: Optional[str] = None
    assigned_to: Optional[str] = None


class AnalysisResultResponse(BaseModel):
    bug_id: int
    root_causes: Optional[List[Dict[str, Any]]]
    confidence_scores: Optional[Dict[str, float]]
    analyzed_at: datetime

    class Config:
        from_attributes = True


class DuplicateCheckRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)


class SimilarBug(BaseModel):
    id: Optional[int] = None
    title: str
    description: str
    severity: str
    type: str
    status: str
    source: str
    similarity: float
    external_url: Optional[str] = None
    external_id: Optional[str] = None


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    similar_bugs: List[SimilarBug]
    message: str


class BugWithAnalysis(BugResponse):
    analysis: Optional[AnalysisResultResponse] = None


class BugListResponse(BaseModel):
    total: int
    bugs: List[BugResponse]
