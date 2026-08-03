import type { ContextPackage } from "../types/context-package";
import { summarizePlatform } from "../core/context";

interface PackageListProps {
  packages: ContextPackage[];
  onSelect: (contextPackage: ContextPackage) => void;
  workspaceNameById?: Record<string, string>;
}

export function PackageList({ packages, onSelect, workspaceNameById = {} }: PackageListProps) {
  if (!packages.length) {
    return (
      <div className="empty-state">
        <p>No Context Packages yet.</p>
        <span>Save a conversation or create one manually to get started.</span>
      </div>
    );
  }

  return (
    <div className="package-list">
      {packages.map((contextPackage) => (
        <button
          key={contextPackage.id}
          className="package-card"
          onClick={() => onSelect(contextPackage)}
          type="button"
        >
          <div className="package-card__topline">
            <span className="package-card__platform">
              {summarizePlatform(contextPackage.platform)}
            </span>
            <span className="package-card__time">
              {new Date(contextPackage.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <strong>{contextPackage.title}</strong>
          <p>{contextPackage.summary || "No summary saved yet."}</p>
          <div className="tag-row">
            {contextPackage.workspaceId && workspaceNameById[contextPackage.workspaceId] && (
              <span className="tag-chip tag-chip--workspace">{workspaceNameById[contextPackage.workspaceId]}</span>
            )}
            {contextPackage.currentVersion ? (
              <span className="tag-chip">v{contextPackage.currentVersion}</span>
            ) : null}
            {contextPackage.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
