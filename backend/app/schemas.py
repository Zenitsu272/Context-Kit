from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str


class UserRead(BaseModel):
    id: str
    email: str
    name: str

    model_config = {"from_attributes": True}


class AuthLoginRequest(BaseModel):
    email: str
    name: str = ""


class AuthSessionResponse(BaseModel):
    token: str
    user: UserRead


WorkspaceRole = Literal["owner", "admin", "member", "viewer"]


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceRead(BaseModel):
    id: str
    name: str
    slug: str
    role: WorkspaceRole
    member_count: int = 1
    package_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMembershipRead(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: WorkspaceRole
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceInviteCreate(BaseModel):
    email: str
    role: WorkspaceRole = "member"


class WorkspaceInviteRead(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: WorkspaceRole
    invited_by: str
    accepted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ContextPackageBase(BaseModel):
    workspace_id: str | None = None
    title: str
    source_platform: str
    source_url: str = ""
    visibility: Literal["private", "team", "selected"] = "private"
    created_by: str | None = None
    status: Literal["active", "archived", "deleted"] = "active"
    summary: str = ""
    key_decisions: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sensitive_findings: list[dict[str, Any]] = Field(default_factory=list)
    messages: list[dict[str, Any]] = Field(default_factory=list)
    depth: Literal["brief", "detailed", "full"] = "detailed"
    notes: str = ""
    extraction_confidence: Literal["high", "medium", "low"] = "medium"
    review_warnings: list[str] = Field(default_factory=list)


class ContextPackageCreate(ContextPackageBase):
    id: str | None = None


class ContextPackageUpdate(BaseModel):
    workspace_id: str | None = None
    title: str | None = None
    summary: str | None = None
    key_decisions: list[str] | None = None
    constraints: list[str] | None = None
    open_questions: list[str] | None = None
    tags: list[str] | None = None
    messages: list[dict[str, Any]] | None = None
    notes: str | None = None
    visibility: Literal["private", "team", "selected"] | None = None
    status: Literal["active", "archived", "deleted"] | None = None
    depth: Literal["brief", "detailed", "full"] | None = None
    extraction_confidence: Literal["high", "medium", "low"] | None = None
    review_warnings: list[str] | None = None


class ContextPackageRead(ContextPackageBase):
    id: str
    created_at: datetime
    updated_at: datetime
    current_version: int = 1
    version_count: int = 1

    model_config = {"from_attributes": True}


class ContextPackageImportRequest(BaseModel):
    packages: list[ContextPackageCreate]


class ContextPackageVersionRead(BaseModel):
    id: str
    context_package_id: str
    version_number: int
    created_by: str | None
    title: str
    summary: str
    visibility: Literal["private", "team", "selected"]
    created_at: datetime

    model_config = {"from_attributes": True}
