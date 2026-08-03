export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  memberCount: number;
  packageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  email: string;
  name: string;
  createdAt: string;
}

export interface PackageVersion {
  id: string;
  contextPackageId: string;
  versionNumber: number;
  createdBy: string | null;
  title: string;
  summary: string;
  visibility: "private" | "team" | "selected";
  createdAt: string;
}
