/**
 * Represents the versioning strategy for a monorepo workspace.
 */
interface WorkspaceInfo {
  isMonorepo: boolean;
  versionStrategy: "independent" | "fixed";
  rootPackage?: PackageInfo;
  packages: PackageInfo[];
}

/**
 * Represents a package in the repository.
 */
interface PackageInfo {
  name: string;
  version: string;
  path: string;
  description?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  repository?: {
    type: string;
    url: string;
  };
}

/**
 * Represents Git information for a repository.
 */
interface GitInfo {
  branch: string;
  hasChanges: boolean;
  remote?: string;
  ahead: number;
  behind: number;
}

/**
 * Represents release information for a GitHub release.
 */
interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
}

/**
 * Represents a conventional commit type, including its type, description, and emoji.
 */
interface ConventionalCommitType {
  type: string;
  description: string;
  emoji: string;
}

export {
  PackageInfo,
  GitInfo,
  ReleaseInfo,
  ConventionalCommitType,
  WorkspaceInfo,
};
