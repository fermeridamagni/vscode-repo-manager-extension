import { simpleGit, SimpleGit } from "simple-git";

import type { GitInfo } from "../types";

/**
 * GitManager class provides methods to interact with Git repositories.
 * It allows retrieving Git information, creating tags, pushing tags,
 * getting remote URLs, and managing commits and changes.
 */
class GitManager {
  private getGitInstance(workingDir: string): SimpleGit {
    return simpleGit(workingDir);
  }

  /**
   * Retrieves the Git information for the specified working directory.
   * @param workingDir The working directory to get Git information for.
   * @returns The Git information or null if not found.
   */
  public async getGitInfo(workingDir: string): Promise<GitInfo | null> {
    try {
      const git = this.getGitInstance(workingDir);

      const status = await git.status();
      const branch = await git.revparse(["--abbrev-ref", "HEAD"]);

      let ahead = 0;
      let behind = 0;
      let remote = "";

      try {
        const remotes = await git.getRemotes(true);
        if (remotes.length > 0) {
          remote = remotes[0].refs.fetch;
        }

        // Get ahead/behind counts
        const aheadBehind = await git.raw([
          "rev-list",
          "--left-right",
          "--count",
          `origin/${branch}...HEAD`,
        ]);
        const counts = aheadBehind.trim().split("\t");
        if (counts.length === 2) {
          behind = parseInt(counts[0]) || 0;
          ahead = parseInt(counts[1]) || 0;
        }
      } catch (error) {
        // Ignore errors for remote operations
      }

      return {
        branch: branch.trim(),
        hasChanges: !status.isClean(),
        remote,
        ahead,
        behind,
      };
    } catch (error) {
      console.error("Error getting git info:", error);
      return null;
    }
  }

  /**
   * Creates a new Git tag.
   * @param workingDir The working directory to create the tag in.
   * @param tagName The name of the tag to create.
   * @param message The message for the tag.
   */
  public async createTag(
    workingDir: string,
    tagName: string,
    message: string
  ): Promise<void> {
    const git = this.getGitInstance(workingDir);
    await git.addAnnotatedTag(tagName, message);
  }

  public async pushTag(workingDir: string, _tagName: string): Promise<void> {
    const git = this.getGitInstance(workingDir);
    await git.pushTags("origin");
  }

  public async getRemoteUrl(workingDir: string): Promise<string | null> {
    try {
      const git = this.getGitInstance(workingDir);
      const remotes = await git.getRemotes(true);

      if (remotes.length > 0) {
        return remotes[0].refs.fetch;
      }

      return null;
    } catch (error) {
      console.error("Error getting remote URL:", error);
      return null;
    }
  }

  /**
   * Retrieves the commits since the last tag for the specified working directory.
   * @param workingDir The working directory to get commits since the last tag.
   * @returns An array of commit objects.
   */
  public async getCommitsSinceLastTag(
    workingDir: string
  ): Promise<Array<{ hash: string; message: string; date: string }>> {
    try {
      const git = this.getGitInstance(workingDir);

      // Get the latest tag
      let latestTag: string;
      try {
        latestTag = await git.raw(["describe", "--tags", "--abbrev=0"]);
        latestTag = latestTag.trim();
      } catch (error) {
        // No tags found, get all commits
        latestTag = "";
      }

      // Get commits since the latest tag
      const logOptions = latestTag
        ? ["--pretty=format:%H|%s|%ad", "--date=short", `${latestTag}..HEAD`]
        : ["--pretty=format:%H|%s|%ad", "--date=short"];

      const log = await git.raw(["log", ...logOptions]);

      return log
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split("|");
          return {
            hash: parts[0] || "",
            message: parts[1] || "",
            date: parts[2] || "",
          };
        });
    } catch (error) {
      console.error("Error getting commits since last tag:", error);
      return [];
    }
  }

  /**
   * Commits changes in the specified working directory.
   * @param workingDir The working directory to commit changes in.
   * @param message The commit message.
   * @param files The files to commit (optional).
   */
  public async commit(
    workingDir: string,
    message: string,
    files?: string[]
  ): Promise<void> {
    const git = this.getGitInstance(workingDir);

    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add(".");
    }

    await git.commit(message);
  }

  /**
   * Stages the specified files in the working directory.
   * @param workingDir The working directory to stage files in.
   * @param files The files to stage.
   */
  public async stageFiles(workingDir: string, files: string[]): Promise<void> {
    const git = this.getGitInstance(workingDir);
    await git.add(files);
  }

  /**
   * Gets the list of changed files in the working directory.
   * @param workingDir The working directory to check for changes.
   * @returns An array of changed file paths.
   */
  public async getChangedFiles(workingDir: string): Promise<string[]> {
    try {
      const git = this.getGitInstance(workingDir);
      const status = await git.status();

      return [
        ...status.modified,
        ...status.created,
        ...status.deleted,
        ...status.renamed.map((r) => r.to),
        ...status.staged,
      ];
    } catch (error) {
      console.error("Error getting changed files:", error);
      return [];
    }
  }
}

export { GitManager };
