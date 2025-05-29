import * as vscode from "vscode";
import * as semver from "semver";
import * as path from "node:path";
import * as fs from "node:fs";

import type { PackageInfo, WorkspaceInfo } from "../types";
import { GitManager } from "./gitManager";

/**
 * GitHub Release Manager for both single packages and monorepos.
 *
 * For monorepo packages:
 * - Uses scoped package names like @org/package@1.0.0 for tags
 * - Filters commits to only include those relevant to the specific package
 * - Supports conventional commit format: "feat(@org/package): add feature"
 *
 * For single packages:
 * - Uses traditional v1.0.0 tag format
 * - Includes all commits since last release
 */
class GithubManager {
  private octokit: any | null = null;
  private gitManager: GitManager;

  constructor() {
    this.gitManager = new GitManager();
    this.initializeOctokit();
  }
  /**
   * Initializes the Octokit instance for GitHub API interactions.
   */
  private async initializeOctokit(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession(
        "github",
        ["repo"],
        { createIfNone: true }
      );
      if (session) {
        const { Octokit } = await import("@octokit/rest");
        this.octokit = new Octokit({
          auth: session.accessToken,
        });
      }
    } catch (error) {
      console.error("Failed to initialize GitHub authentication:", error);
    }
  }

  /**
   * Creates a GitHub release for the specified package.
   * For fixed versioning strategy, creates unified releases with consolidated changelogs.
   * For independent versioning strategy, creates individual package releases.
   * @param packageInfo
   * @param workspaceInfo
   * @returns
   */
  public async createRelease(
    packageInfo: PackageInfo,
    workspaceInfo?: WorkspaceInfo
  ): Promise<void> {
    if (!this.octokit) {
      await this.initializeOctokit();
      if (!this.octokit) {
        vscode.window.showErrorMessage(
          "GitHub authentication failed. Please try again."
        );
        return;
      }
    }

    try {
      // Get repository info
      const repoInfo = await this.getRepositoryInfo(packageInfo);
      if (!repoInfo) {
        vscode.window.showErrorMessage(
          "Could not determine repository information."
        );
        return;
      }

      // Handle different versioning strategies
      if (
        workspaceInfo?.isMonorepo &&
        workspaceInfo.versionStrategy === "fixed"
      ) {
        await this.createFixedVersionRelease(
          packageInfo,
          workspaceInfo,
          repoInfo
        );
      } else {
        await this.createIndependentRelease(packageInfo, repoInfo);
      }
    } catch (error: any) {
      console.error("Error creating release:", error);
      vscode.window.showErrorMessage(
        `Failed to create release: ${error.message}`
      );
    }
  }

  /**
   * Creates a unified release for fixed versioning strategy.
   * Updates all packages to the same version and creates a single release with consolidated changelog.
   */
  private async createFixedVersionRelease(
    packageInfo: PackageInfo,
    workspaceInfo: WorkspaceInfo,
    repoInfo: { owner: string; repo: string }
  ): Promise<void> {
    // Suggest next version
    const currentVersion = packageInfo.version;
    const suggestedVersions = this.suggestNextVersions(currentVersion);

    // Let user choose version
    const versionChoice = await vscode.window.showQuickPick(
      suggestedVersions.map((v) => ({
        label: v,
        detail: `Current: ${currentVersion} (will update all packages)`,
      })),
      {
        placeHolder: "Select the version for this unified release",
        canPickMany: false,
        matchOnDetail: true,
      }
    );

    if (!versionChoice) {
      return;
    }

    const newVersion = versionChoice.label;

    // Check if there are any changes across all packages
    const hasChanges = await this.hasChangesForWorkspace(workspaceInfo);
    if (!hasChanges) {
      const shouldContinue = await vscode.window.showWarningMessage(
        `No changes detected across packages since the last release. Do you want to continue anyway?`,
        "Yes, Continue",
        "Cancel"
      );

      if (shouldContinue !== "Yes, Continue") {
        vscode.window.showInformationMessage(
          "Release cancelled - no changes detected."
        );
        return;
      }
    }

    // Generate consolidated release notes for all packages
    const releaseNotes = await this.generateConsolidatedReleaseNotes(
      workspaceInfo,
      newVersion
    );

    // Ask if this is a prerelease
    const isPrerelease = await vscode.window.showQuickPick(["No", "Yes"], {
      placeHolder: "Is this a prerelease?",
    });

    if (!isPrerelease) {
      return;
    } // Update all package versions to the same version
    await this.updateAllPackageVersions(workspaceInfo.packages, newVersion);

    // Update root package changelog
    await this.updateWorkspaceChangelog(
      workspaceInfo,
      newVersion,
      releaseNotes
    );

    // Commit all changes before creating tag
    await this.commitVersionChanges(packageInfo, newVersion, true);

    // Create unified git tag
    const tagName = `v${newVersion}`;
    await this.gitManager.createTag(
      packageInfo.path,
      tagName,
      `Release ${newVersion}`
    );

    // Push tag
    await this.gitManager.pushTag(packageInfo.path, tagName);

    // Create GitHub release
    const release = await this.octokit.rest.repos.createRelease({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      tag_name: tagName,
      name: `Release ${newVersion}`,
      body: releaseNotes,
      prerelease: isPrerelease === "Yes",
      draft: false,
    });

    vscode.window
      .showInformationMessage(
        `Unified release ${newVersion} created successfully!`,
        "View Release"
      )
      .then((action) => {
        if (action === "View Release") {
          vscode.env.openExternal(vscode.Uri.parse(release.data.html_url));
        }
      });
  }

  /**
   * Creates an independent release for a single package.
   */
  private async createIndependentRelease(
    packageInfo: PackageInfo,
    repoInfo: { owner: string; repo: string }
  ): Promise<void> {
    // Suggest next version
    const currentVersion = packageInfo.version;
    const suggestedVersions = this.suggestNextVersions(currentVersion);

    // Let user choose version
    const versionChoice = await vscode.window.showQuickPick(
      suggestedVersions.map((v) => ({
        label: v,
        detail: `Current: ${currentVersion}`,
      })),
      {
        placeHolder: "Select the version for this release",
        canPickMany: false,
        matchOnDetail: true,
      }
    );

    if (!versionChoice) {
      return;
    }

    const newVersion = versionChoice.label;

    // Check if there are any changes for this package
    const hasChanges = await this.hasChangesForPackage(packageInfo);
    if (!hasChanges) {
      const shouldContinue = await vscode.window.showWarningMessage(
        `No changes detected for ${packageInfo.name} since the last release. Do you want to continue anyway?`,
        "Yes, Continue",
        "Cancel"
      );

      if (shouldContinue !== "Yes, Continue") {
        vscode.window.showInformationMessage(
          "Release cancelled - no changes detected."
        );
        return;
      }
    }

    // Get release notes
    const releaseNotes = await this.generateReleaseNotes(
      packageInfo,
      newVersion
    );

    // Ask if this is a prerelease
    const isPrerelease = await vscode.window.showQuickPick(["No", "Yes"], {
      placeHolder: "Is this a prerelease?",
    });

    if (!isPrerelease) {
      return;
    } // Update package.json version
    await this.updatePackageVersion(packageInfo, newVersion);

    // Update CHANGELOG.md
    await this.updateChangelog(packageInfo, newVersion, releaseNotes);

    // Commit the changes before creating tag
    await this.commitVersionChanges(packageInfo, newVersion);

    // Create git tag
    const tagName = this.generateTagName(packageInfo.name, newVersion);
    await this.gitManager.createTag(
      packageInfo.path,
      tagName,
      `Release ${newVersion}`
    );

    // Push tag
    await this.gitManager.pushTag(packageInfo.path, tagName);

    // Create GitHub release
    const release = await this.octokit.rest.repos.createRelease({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      tag_name: tagName,
      name: `${packageInfo.name} ${newVersion}`,
      body: releaseNotes,
      prerelease: isPrerelease === "Yes",
      draft: false,
    });

    vscode.window
      .showInformationMessage(
        `Release ${newVersion} created successfully!`,
        "View Release"
      )
      .then((action) => {
        if (action === "View Release") {
          vscode.env.openExternal(vscode.Uri.parse(release.data.html_url));
        }
      });
  }

  /**
   * Checks if there are changes across all packages in the workspace.
   */
  private async hasChangesForWorkspace(
    workspaceInfo: WorkspaceInfo
  ): Promise<boolean> {
    try {
      // Check if any package has changes
      for (const pkg of workspaceInfo.packages) {
        const hasChanges = await this.hasChangesForPackage(pkg);
        if (hasChanges) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking workspace changes:", error);
      return true; // Assume changes if we can't determine
    }
  }

  /**
   * Generates consolidated release notes for all packages in the workspace.
   */
  private async generateConsolidatedReleaseNotes(
    workspaceInfo: WorkspaceInfo,
    version: string
  ): Promise<string> {
    try {
      const releaseNotes = [`# Release ${version}\n`];

      // Generate notes for each package that has changes
      for (const pkg of workspaceInfo.packages) {
        const hasChanges = await this.hasChangesForPackage(pkg);
        if (hasChanges) {
          const commits = await this.gitManager.getCommitsSinceLastTag(
            pkg.path
          );
          const relevantCommits = this.filterCommitsForPackage(commits, pkg);
          if (relevantCommits.length > 0) {
            releaseNotes.push(`## ${pkg.name}`);
            releaseNotes.push("");

            const commitsByType = this.groupCommitsByType(relevantCommits);
            const typeOrder = [
              "feat",
              "fix",
              "perf",
              "refactor",
              "docs",
              "style",
              "test",
              "chore",
              "other",
            ];

            for (const type of typeOrder) {
              if (commitsByType[type] && commitsByType[type].length > 0) {
                const typeLabel = this.getTypeLabel(type);
                releaseNotes.push(`### ${typeLabel}`);
                releaseNotes.push("");

                for (const commit of commitsByType[type]) {
                  const message = commit.message.split("\n")[0];
                  const cleanMessage = message.replace(
                    /^(feat|fix|docs|style|refactor|perf|test|chore)(\(.+?\))?:\s*/,
                    ""
                  );
                  releaseNotes.push(`- ${cleanMessage}`);
                }
                releaseNotes.push(""); // Add empty line after each section
              }
            }
          }
        }
      }

      return releaseNotes.join("\n");
    } catch (error) {
      return `Release ${version}`;
    }
  }

  /**
   * Updates all packages to the same version for fixed versioning strategy.
   */
  private async updateAllPackageVersions(
    packages: PackageInfo[],
    newVersion: string
  ): Promise<void> {
    for (const pkg of packages) {
      await this.updatePackageVersion(pkg, newVersion);
    }
  }

  /**
   * Updates the workspace changelog with consolidated release information.
   */
  private async updateWorkspaceChangelog(
    _workspaceInfo: WorkspaceInfo,
    newVersion: string,
    releaseNotes: string
  ): Promise<void> {
    try {
      // Create changelog in the root directory for fixed versioning
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error("No workspace folder found");
      }

      const changelogPath = path.join(workspaceRoot, "CHANGELOG.md");

      // Read existing changelog or create new one
      let existingContent = "";
      if (fs.existsSync(changelogPath)) {
        existingContent = fs.readFileSync(changelogPath, "utf8");
      }

      // Generate new changelog entry
      const today = new Date().toISOString().split("T")[0];
      const tagName = `v${newVersion}`;

      let newEntry = `## [Release ${newVersion}](releases/tag/${tagName}) - ${today}\n\n`;

      // Add release notes to the entry
      const organizedNotes =
        this.organizeReleaseNotesForChangelog(releaseNotes);
      newEntry += organizedNotes + "\n\n";

      // Combine with existing content
      let updatedContent = "";
      if (existingContent.trim() === "") {
        // Create new changelog
        updatedContent = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n${newEntry}`;
      } else {
        // Insert new entry after the header
        const lines = existingContent.split("\n");
        const headerEndIndex = lines.findIndex(
          (line, index) =>
            index > 0 &&
            line.startsWith("## ") &&
            lines[index - 1].trim() !== ""
        );

        if (headerEndIndex === -1) {
          // No existing entries, add after any existing header
          const insertIndex =
            lines.findIndex((line) => line.startsWith("#")) + 1;
          lines.splice(insertIndex, 0, "", newEntry.trim(), "");
        } else {
          // Insert before first existing entry
          lines.splice(headerEndIndex, 0, newEntry.trim(), "");
        }

        updatedContent = lines.join("\n");
      }

      // Write the updated changelog
      const changelogUri = vscode.Uri.file(changelogPath);
      const edit = new vscode.WorkspaceEdit();

      if (fs.existsSync(changelogPath)) {
        // Update existing file
        const document = await vscode.workspace.openTextDocument(changelogUri);
        edit.replace(
          changelogUri,
          new vscode.Range(0, 0, document.lineCount, 0),
          updatedContent
        );
      } else {
        // Create new file
        edit.createFile(changelogUri, { ignoreIfExists: true });
        edit.insert(changelogUri, new vscode.Position(0, 0), updatedContent);
      }

      await vscode.workspace.applyEdit(edit);

      // Save the document if it's open
      try {
        const document = await vscode.workspace.openTextDocument(changelogUri);
        await document.save();
      } catch (error) {
        // Document might not be open, which is fine
      }

      console.log(`Updated workspace changelog at: ${changelogPath}`);
    } catch (error) {
      console.error("Error updating workspace changelog:", error);
      vscode.window.showWarningMessage(
        `Failed to update changelog: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Retrieves the repository information for the specified package.
   * @param packageInfo The package information.
   * @returns The repository information or null if not found.
   */
  private async getRepositoryInfo(
    packageInfo: PackageInfo
  ): Promise<{ owner: string; repo: string } | null> {
    try {
      const remoteUrl = await this.gitManager.getRemoteUrl(packageInfo.path);
      if (!remoteUrl) {
        return null;
      }

      // Parse GitHub URL
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting repository info:", error);
      return null;
    }
  }

  /**
   * Suggests the next versions for a given version.
   * @param currentVersion The current version.
   * @returns An array of suggested next versions.
   */
  private suggestNextVersions(currentVersion: string): string[] {
    const versions: string[] = [];

    try {
      const patch = semver.inc(currentVersion, "patch");
      const minor = semver.inc(currentVersion, "minor");
      const major = semver.inc(currentVersion, "major");
      const prerelease = semver.inc(currentVersion, "prerelease", "beta");
      if (patch) {
        versions.push(patch);
      }
      if (minor) {
        versions.push(minor);
      }
      if (major) {
        versions.push(major);
      }
      if (prerelease) {
        versions.push(prerelease);
      }
    } catch (error) {
      // Fallback if semver parsing fails
      versions.push("1.0.0");
    }

    return versions;
  }

  /**
   * Generates release notes for the specified package and version.
   * @param packageInfo The package information.
   * @param version The version for the release.
   * @returns The generated release notes.
   */
  private async generateReleaseNotes(
    packageInfo: PackageInfo,
    version: string
  ): Promise<string> {
    try {
      const commits = await this.gitManager.getCommitsSinceLastTag(
        packageInfo.path
      );
      if (commits.length === 0) {
        return `Release ${version}`;
      }

      // Filter commits for monorepo packages
      const relevantCommits = this.filterCommitsForPackage(
        commits,
        packageInfo
      );

      if (relevantCommits.length === 0) {
        return `Release ${version}\n\nNo changes specific to this package since last release.`;
      }

      const releaseNotes = ["\n## Changes"];

      // Group commits by type for better organization
      const commitsByType = this.groupCommitsByType(relevantCommits);

      // Add commits in order of importance
      const typeOrder = [
        "feat",
        "fix",
        "perf",
        "refactor",
        "docs",
        "style",
        "test",
        "chore",
        "other",
      ];
      for (const type of typeOrder) {
        if (commitsByType[type] && commitsByType[type].length > 0) {
          const typeLabel = this.getTypeLabel(type);
          releaseNotes.push(`\n### ${typeLabel}`);
          releaseNotes.push("");

          for (const commit of commitsByType[type]) {
            const message = commit.message.split("\n")[0];
            // Remove conventional commit prefix if present
            const cleanMessage = message.replace(
              /^(feat|fix|docs|style|refactor|perf|test|chore)(\(.+?\))?:\s*/,
              ""
            );
            releaseNotes.push(`- ${cleanMessage}`);
          }
          releaseNotes.push(""); // Add empty line after each section
        }
      }
      return releaseNotes.join("\n");
    } catch (error) {
      return `Release ${version}`;
    }
  }

  /**
   * Checks if there are any changes for the specified package since the last release.
   * @param packageInfo The package information.
   * @returns True if there are changes, false otherwise.
   */
  private async hasChangesForPackage(
    packageInfo: PackageInfo
  ): Promise<boolean> {
    try {
      // Get commits since the last tag (similar to generateReleaseNotes)
      const commits = await this.gitManager.getCommitsSinceLastTag(
        packageInfo.path
      );

      // If no commits at all, there are no changes
      if (commits.length === 0) {
        return false;
      }

      // Filter commits to only include those relevant to this package
      const relevantCommits = this.filterCommitsForPackage(
        commits,
        packageInfo
      );

      return relevantCommits.length > 0;
    } catch (error) {
      console.error("Error checking for changes:", error);
      // If we can't determine changes, assume there are some to be safe
      return true;
    }
  }

  /**
   * Filters commits to only include those relevant to the specific package.
   * @param commits All commits since last tag.
   * @param packageInfo The package information.
   * @returns Filtered commits relevant to the package.
   */
  private filterCommitsForPackage(
    commits: any[],
    packageInfo: PackageInfo
  ): any[] {
    const isMonorepo = packageInfo.name.startsWith("@");

    if (!isMonorepo) {
      // For single packages, return all commits
      return commits;
    }

    return commits.filter((commit) => {
      const message = commit.message;

      // Check if commit uses conventional commit format with package scope
      // Examples: "feat(@org/package): add feature", "fix(@org/package): bug fix"
      const conventionalCommitMatch = message.match(
        /^(feat|fix|docs|style|refactor|perf|test|chore)(\(([^)]+)\))?:/
      );

      if (conventionalCommitMatch && conventionalCommitMatch[3]) {
        const scope = conventionalCommitMatch[3];
        // Check if scope matches package name or is a path that includes the package
        return (
          scope === packageInfo.name ||
          scope.includes(packageInfo.name) ||
          message.includes(packageInfo.name)
        );
      }

      // Fallback: check if commit message mentions the package name
      if (message.includes(packageInfo.name)) {
        return true;
      }

      // Fallback: check if any files in the commit affect this package's directory
      // This would require file change information from git, which we don't have in the current commit object
      // For now, we'll include commits that don't have specific scoping
      return false;
    });
  }

  /**
   * Groups commits by their conventional commit type.
   * @param commits The commits to group.
   * @returns Commits grouped by type.
   */
  private groupCommitsByType(commits: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    for (const commit of commits) {
      const message = commit.message;
      const match = message.match(
        /^(feat|fix|docs|style|refactor|perf|test|chore)(\([^)]*\))?:/
      );

      let type = "other";
      if (match) {
        type = match[1];
      }

      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(commit);
    }

    return grouped;
  }

  /**
   * Gets a human-readable label for a commit type.
   * @param type The commit type.
   * @returns The human-readable label.
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      feat: "🚀 Features",
      fix: "🐛 Bug Fixes",
      perf: "⚡ Performance Improvements",
      refactor: "♻️ Code Refactoring",
      docs: "📚 Documentation",
      style: "💄 Styles",
      test: "🧪 Tests",
      chore: "🔧 Chores",
      other: "📝 Other Changes",
    };

    return labels[type] || "📝 Other Changes";
  }

  /**
   * Generates the appropriate tag name based on package type.
   * For monorepo packages (scoped): @org/package@1.0.0
   * For single packages: v1.0.0
   * @param packageName The package name.
   * @param version The version.
   * @returns The tag name.
   */
  private generateTagName(packageName: string, version: string): string {
    // For scoped packages (monorepo), use package name + version
    // This allows multiple packages to have separate release tags
    if (packageName.startsWith("@")) {
      return `${packageName}@${version}`;
    }
    // For single packages, use v prefix (traditional approach)
    return `v${version}`;
  }
  /**
   * Commits version changes (package.json and CHANGELOG.md) before creating release tag.
   * @param packageInfo The package information.
   * @param newVersion The new version being released.
   * @param isWorkspace Whether this is a workspace-wide release (commits all changes).
   */
  private async commitVersionChanges(
    packageInfo: PackageInfo,
    newVersion: string,
    isWorkspace: boolean = false
  ): Promise<void> {
    try {
      const workingDir = isWorkspace
        ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || packageInfo.path
        : packageInfo.path;

      if (isWorkspace) {
        // For workspace releases, commit all package.json files and root CHANGELOG.md
        const filesToCommit = ["**/package.json", "CHANGELOG.md"];

        const commitMessage = `chore: release version ${newVersion}

- Update all package versions to ${newVersion}
- Update CHANGELOG.md with release notes`;

        await this.gitManager.commit(workingDir, commitMessage, filesToCommit);
      } else {
        // For individual package releases, commit only that package's files
        const packageJsonPath = "package.json";
        const changelogPath = "CHANGELOG.md";

        const commitMessage = `chore(${packageInfo.name}): release version ${newVersion}

- Update ${packageInfo.name} to version ${newVersion}
- Update CHANGELOG.md with release notes`;

        await this.gitManager.commit(workingDir, commitMessage, [
          packageJsonPath,
          changelogPath,
        ]);
      }

      console.log(
        `Committed version changes for ${
          isWorkspace ? "workspace" : packageInfo.name
        } v${newVersion}`
      );
    } catch (error) {
      console.error("Error committing version changes:", error);
      // Continue with release creation even if commit fails
      vscode.window.showWarningMessage(
        `Failed to commit version changes: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Release will continue without committing changes.`
      );
    }
  }

  /**
   * Updates the version of the specified package.
   * @param packageInfo The package information.
   * @param newVersion The new version to set.
   */
  private async updatePackageVersion(
    packageInfo: PackageInfo,
    newVersion: string
  ): Promise<void> {
    const packageJsonPath = vscode.Uri.file(`${packageInfo.path}/package.json`);
    const document = await vscode.workspace.openTextDocument(packageJsonPath);
    const text = document.getText();
    const packageJson = JSON.parse(text);

    packageJson.version = newVersion;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      packageJsonPath,
      new vscode.Range(0, 0, document.lineCount, 0),
      JSON.stringify(packageJson, null, 2)
    );
    await vscode.workspace.applyEdit(edit);
    await document.save();
  }

  /**
   * Updates or creates the CHANGELOG.md file with the new release information.
   * @param packageInfo The package information.
   * @param newVersion The new version being released.
   * @param releaseNotes The release notes for this version.
   */
  private async updateChangelog(
    packageInfo: PackageInfo,
    newVersion: string,
    releaseNotes: string
  ): Promise<void> {
    try {
      // Determine changelog path based on package type
      let changelogPath: string;

      if (packageInfo.name.startsWith("@")) {
        // For monorepo packages, create changelog in the package directory
        changelogPath = path.join(packageInfo.path, "CHANGELOG.md");
      } else {
        // For single packages, create changelog in the root directory
        const workspaceRoot =
          vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
          throw new Error("No workspace folder found");
        }
        changelogPath = path.join(workspaceRoot, "CHANGELOG.md");
      }

      // Read existing changelog or create new one
      let existingContent = "";
      if (fs.existsSync(changelogPath)) {
        existingContent = fs.readFileSync(changelogPath, "utf8");
      }

      // Generate new changelog entry
      const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
      const tagName = this.generateTagName(packageInfo.name, newVersion);
      let newEntry = "";
      if (packageInfo.name.startsWith("@")) {
        // For monorepo packages, include package name in the entry
        // GitHub URLs work with @ symbol, no need to encode
        newEntry = `## [${packageInfo.name}@${newVersion}](../../releases/tag/${tagName}) - ${today}\n\n`;
      } else {
        // For single packages, use standard format
        newEntry = `## [${newVersion}](releases/tag/${tagName}) - ${today}\n\n`;
      } // Add release notes to the entry
      const organizedNotes =
        this.organizeReleaseNotesForChangelog(releaseNotes);
      newEntry += organizedNotes + "\n\n";

      // Combine with existing content
      let updatedContent = "";
      if (existingContent.trim() === "") {
        // Create new changelog
        updatedContent = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n${newEntry}`;
      } else {
        // Insert new entry after the header
        const lines = existingContent.split("\n");
        const headerEndIndex = lines.findIndex(
          (line, index) =>
            index > 0 &&
            line.startsWith("## ") &&
            lines[index - 1].trim() !== ""
        );

        if (headerEndIndex === -1) {
          // No existing entries, add after any existing header
          const insertIndex =
            lines.findIndex((line) => line.startsWith("#")) + 1;
          lines.splice(insertIndex, 0, "", newEntry.trim(), "");
        } else {
          // Insert before first existing entry
          lines.splice(headerEndIndex, 0, newEntry.trim(), "");
        }

        updatedContent = lines.join("\n");
      }

      // Write the updated changelog
      const changelogUri = vscode.Uri.file(changelogPath);
      const edit = new vscode.WorkspaceEdit();

      if (fs.existsSync(changelogPath)) {
        // Update existing file
        const document = await vscode.workspace.openTextDocument(changelogUri);
        edit.replace(
          changelogUri,
          new vscode.Range(0, 0, document.lineCount, 0),
          updatedContent
        );
      } else {
        // Create new file
        edit.createFile(changelogUri, { ignoreIfExists: true });
        edit.insert(changelogUri, new vscode.Position(0, 0), updatedContent);
      }

      await vscode.workspace.applyEdit(edit);

      // Save the document if it's open
      try {
        const document = await vscode.workspace.openTextDocument(changelogUri);
        await document.save();
      } catch (error) {
        // Document might not be open, which is fine
      }

      console.log(`Updated changelog at: ${changelogPath}`);
    } catch (error) {
      console.error("Error updating changelog:", error);
      vscode.window.showWarningMessage(
        `Failed to update changelog: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
  /**
   * Organizes release notes according to Keep a Changelog format.
   * @param releaseNotes The raw release notes.
   * @returns Formatted release notes with proper sections.
   */
  private organizeReleaseNotesForChangelog(releaseNotes: string): string {
    const lines = releaseNotes.split("\n");
    const sections: Record<string, string[]> = {};

    // Map emoji labels to Keep a Changelog sections
    const sectionMapping: Record<string, string> = {
      "🚀 Features": "Added",
      "🐛 Bug Fixes": "Fixed",
      "⚡ Performance Improvements": "Changed",
      "♻️ Code Refactoring": "Changed",
      "📚 Documentation": "Changed",
      "💄 Styles": "Changed",
      "🧪 Tests": "Changed",
      "🔧 Chores": "Changed",
      "📝 Other Changes": "Changed",
    };

    let currentSection = "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("###")) {
        // This is a section header
        const sectionTitle = trimmedLine.replace("###", "").trim();
        currentSection = sectionMapping[sectionTitle] || "Changed";
      } else if (trimmedLine.startsWith("-")) {
        // This is a list item
        if (currentSection) {
          if (!sections[currentSection]) {
            sections[currentSection] = [];
          }
          sections[currentSection].push(trimmedLine);
        }
      }
    }

    // If no sections were found, treat the whole thing as "Changed"
    if (Object.keys(sections).length === 0) {
      const cleanedLines = releaseNotes
        .split("\n")
        .filter(
          (line) =>
            line.trim() !== "" &&
            !line.startsWith("#") &&
            !line.startsWith("##")
        )
        .map((line) => (line.startsWith("-") ? line : `- ${line}`));

      if (cleanedLines.length > 0) {
        sections["Changed"] = cleanedLines;
      }
    }

    // Build the formatted output - only include sections that have content
    const formattedSections: string[] = [];
    const sectionOrder = [
      "Added",
      "Changed",
      "Deprecated",
      "Removed",
      "Fixed",
      "Security",
    ];

    for (const section of sectionOrder) {
      if (sections[section] && sections[section].length > 0) {
        formattedSections.push(`### ${section}`);
        formattedSections.push("");
        formattedSections.push(sections[section].join("\n"));
        formattedSections.push("");
      }
    }

    return formattedSections.join("\n").trim();
  }
}

export { GithubManager };
