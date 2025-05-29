import * as vscode from "vscode";

import type { PackageInfo, ConventionalCommitType } from "../types";
import { GitManager } from "./gitManager";

/**
 * ConventionalCommitManager provides methods to create and manage conventional commits.
 * It interacts with the GitManager to handle Git operations and uses VS Code APIs for user interaction.
 */
class ConventionalCommitManager {
  private gitManager: GitManager;

  constructor() {
    this.gitManager = new GitManager();
  }

  /**
   * Creates a conventional commit based on the changes in the specified package.
   * @param packageInfo The package information.
   * @returns A promise that resolves when the commit is created.
   */
  public async createConventionalCommit(
    packageInfo: PackageInfo
  ): Promise<void> {
    try {
      // Check if there are changes to commit
      const changedFiles = await this.gitManager.getChangedFiles(
        packageInfo.path
      );
      if (changedFiles.length === 0) {
        vscode.window.showInformationMessage("No changes to commit.");
        return;
      }

      // Show changed files and let user select which to include
      const filesToCommit = await this.selectFilesToCommit(changedFiles);
      if (!filesToCommit || filesToCommit.length === 0) {
        return;
      }

      // Select commit type
      const commitType = await this.selectCommitType();
      if (!commitType) {
        return;
      }

      // Get commit scope (optional)
      const scope = await this.getCommitScope();

      // Check if breaking change
      const isBreakingChange = await this.checkBreakingChange();

      // Get commit description
      const description = await this.getCommitDescription();
      if (!description) {
        return;
      }

      // Get commit body (optional)
      const body = await this.getCommitBody();

      // Get footer (optional, typically for breaking changes or issue references)
      const footer = await this.getCommitFooter(isBreakingChange);

      // Build commit message
      const commitMessage = this.buildCommitMessage({
        type: commitType.type,
        scope,
        description,
        body,
        footer,
        isBreakingChange,
      });

      // Show preview and confirm
      const confirmed = await this.confirmCommit(commitMessage, filesToCommit);
      if (!confirmed) {
        return;
      }

      // Stage files and commit
      await this.gitManager.stageFiles(packageInfo.path, filesToCommit);
      await this.gitManager.commit(packageInfo.path, commitMessage);

      vscode.window
        .showInformationMessage(
          `Conventional commit created successfully! ${commitType.emoji}`,
          "View Git Log"
        )
        .then((action) => {
          if (action === "View Git Log") {
            vscode.commands.executeCommand("git.viewHistory");
          }
        });
    } catch (error: any) {
      console.error("Error creating conventional commit:", error);
      vscode.window.showErrorMessage(
        `Failed to create commit: ${error.message}`
      );
    }
  }

  /**
   * Prompts the user to select which files to include in the commit.
   * @param changedFiles An array of changed files to select from.
   * @returns An array of selected file paths or undefined if no files were selected.
   */
  private async selectFilesToCommit(
    changedFiles: string[]
  ): Promise<string[] | undefined> {
    const fileItems = changedFiles.map((file) => ({
      label: file,
      picked: true, // Pre-select all files
    }));

    const selectedItems = await vscode.window.showQuickPick(fileItems, {
      placeHolder: "Select files to include in commit",
      canPickMany: true,
    });

    return selectedItems?.map((item) => item.label);
  }

  /**
   * Prompts the user to select a commit type.
   * @returns The selected commit type or undefined if cancelled.
   */
  private async selectCommitType(): Promise<
    ConventionalCommitType | undefined
  > {
    const typeItems = COMMIT_TYPES_LIST.map((type) => ({
      label: `${type.emoji} ${type.type}`,
      detail: type.description,
      type,
    }));

    const selected = await vscode.window.showQuickPick(typeItems, {
      placeHolder: "Select the type of change you're committing",
    });

    return selected?.type;
  }

  /**
   * Prompts the user to enter a scope for the commit.
   * @returns The entered scope or undefined if cancelled.
   */
  private async getCommitScope(): Promise<string | undefined> {
    const scope = await vscode.window.showInputBox({
      prompt: "Enter the scope of this change (optional)",
      placeHolder: "api, ui, core, etc.",
      validateInput: (value) => {
        if (value && !/^[a-z0-9-]+$/i.test(value)) {
          return "Scope should only contain letters, numbers, and hyphens";
        }
        return undefined;
      },
    });

    return scope?.trim() || undefined;
  }

  /**
   * Prompts the user to confirm if the commit is a breaking change.
   * @returns True if it is a breaking change, false otherwise.
   */
  private async checkBreakingChange(): Promise<boolean> {
    const result = await vscode.window.showQuickPick(
      [
        { label: "No", detail: "This change is backward compatible" },
        { label: "Yes", detail: "This change breaks existing functionality" },
      ],
      { placeHolder: "Is this a breaking change?" }
    );

    return result?.label === "Yes";
  }

  /**
   * Prompts the user to enter a short description of the change.
   * @returns The entered description or undefined if cancelled.
   */
  private async getCommitDescription(): Promise<string | undefined> {
    const description = await vscode.window.showInputBox({
      prompt: "Enter a short description of the change",
      placeHolder: "add user authentication feature",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Description is required";
        }
        if (value.length > 50) {
          return "Description should be 50 characters or less";
        }
        if (value.charAt(0) === value.charAt(0).toUpperCase()) {
          return "Description should start with a lowercase letter";
        }
        if (value.endsWith(".")) {
          return "Description should not end with a period";
        }
        return undefined;
      },
    });

    return description?.trim();
  }

  /**
   * Prompts the user to enter a longer body for the commit.
   * @returns The entered body or undefined if cancelled.
   */
  private async getCommitBody(): Promise<string | undefined> {
    const body = await vscode.window.showInputBox({
      prompt: "Enter a longer description (optional)",
      placeHolder: "Explain what and why vs. how...",
    });

    return body?.trim() || undefined;
  }

  /**
   * Prompts the user to enter footer information, typically for breaking changes or issue references.
   * @param isBreakingChange Whether the commit is a breaking change.
   * @returns The entered footer or undefined if cancelled.
   */
  private async getCommitFooter(
    isBreakingChange: boolean
  ): Promise<string | undefined> {
    let footerPrompt = "Enter footer information (optional)";
    let footerPlaceholder = "Closes #123, Refs #456";

    if (isBreakingChange) {
      footerPrompt = "Enter breaking change description";
      footerPlaceholder = "BREAKING CHANGE: removed support for Node 12";
    }

    const footer = await vscode.window.showInputBox({
      prompt: footerPrompt,
      placeHolder: footerPlaceholder,
    });

    return footer?.trim() || undefined;
  }

  /**
   * Builds the conventional commit message based on the provided options.
   * @param options The options for building the commit message.
   * @returns The formatted commit message.
   */
  private buildCommitMessage(options: {
    type: string;
    scope?: string;
    description: string;
    body?: string;
    footer?: string;
    isBreakingChange: boolean;
  }): string {
    let message = options.type;

    if (options.scope) {
      message += `(${options.scope})`;
    }

    if (options.isBreakingChange) {
      message += "!";
    }

    message += `: ${options.description}`;

    if (options.body) {
      message += `\n\n${options.body}`;
    }

    if (options.footer) {
      let footer = options.footer;
      if (options.isBreakingChange && !footer.startsWith("BREAKING CHANGE:")) {
        footer = `BREAKING CHANGE: ${footer}`;
      }
      message += `\n\n${footer}`;
    }

    return message;
  }

  /**
   * Confirms the commit with the user by showing a preview of the commit message and files.
   * @param commitMessage The commit message to preview.
   * @param files The files to be committed.
   * @returns True if the user confirms the commit, false otherwise.
   */
  private async confirmCommit(
    commitMessage: string,
    files: string[]
  ): Promise<boolean> {
    const previewMessage = `${commitMessage}\n\nFiles to be committed:\n${files
      .map((f) => `• ${f}`)
      .join("\n")}`;

    const result = await vscode.window.showInformationMessage(
      "Review your commit:",
      { modal: true, detail: previewMessage },
      "Commit",
      "Cancel"
    );

    return result === "Commit";
  }

  /**
   * Validates the commit message against conventional commit standards.
   * @param message The commit message to validate.
   * @returns An object indicating whether the message is valid and any errors found.
   */
  async validateCommitMessage(
    message: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic format check: type(scope): description
    const conventionalPattern = /^(\w+)(\(.+\))?!?: .+/;
    if (!conventionalPattern.test(message)) {
      errors.push(
        "Commit message does not follow conventional format: type(scope): description"
      );
    }

    // Check if type is valid
    const typeMatch = message.match(/^(\w+)/);
    if (typeMatch) {
      const type = typeMatch[1];
      const validTypes = COMMIT_TYPES_LIST.map((t) => t.type);
      if (!validTypes.includes(type)) {
        errors.push(
          `Invalid commit type: ${type}. Valid types are: ${validTypes.join(
            ", "
          )}`
        );
      }
    }

    // Check description length
    const descriptionMatch = message.match(/^[^:]+: (.+)/);
    if (descriptionMatch) {
      const description = descriptionMatch[1].split("\n")[0];
      if (description.length > 50) {
        errors.push("Description should be 50 characters or less");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

const COMMIT_TYPES_LIST: ConventionalCommitType[] = [
  { type: "feat", description: "A new feature", emoji: "✨" },
  { type: "fix", description: "A bug fix", emoji: "🐛" },
  { type: "docs", description: "Documentation only changes", emoji: "📝" },
  {
    type: "style",
    description: "Changes that do not affect the meaning of the code",
    emoji: "💄",
  },
  {
    type: "refactor",
    description: "A code change that neither fixes a bug nor adds a feature",
    emoji: "♻️",
  },
  {
    type: "test",
    description: "Adding missing tests or correcting existing tests",
    emoji: "✅",
  },
  {
    type: "chore",
    description: "Changes to the build process or auxiliary tools",
    emoji: "🔧",
  },
  {
    type: "perf",
    description: "A code change that improves performance",
    emoji: "⚡",
  },
  {
    type: "ci",
    description: "Changes to CI configuration files and scripts",
    emoji: "👷",
  },
  {
    type: "build",
    description:
      "Changes that affect the build system or external dependencies",
    emoji: "📦",
  },
  { type: "revert", description: "Reverts a previous commit", emoji: "⏪" },
];

export { ConventionalCommitManager };
