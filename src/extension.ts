import * as vscode from "vscode";

import type { PackageInfo } from "./types";
import {
  RepoManagerProvider,
  PackageTreeItem,
} from "./lib/repoManagerProvider";
import { GithubManager } from "./lib/githubManager";
import { NpmPublisher } from "./lib/npmPublisher";
import { ConventionalCommitManager } from "./lib/conventionalCommitManager";

let repoProvider: RepoManagerProvider;
let releaseManager: GithubManager;
let npmPublisher: NpmPublisher;
let commitManager: ConventionalCommitManager;

export function activate(context: vscode.ExtensionContext) {
  console.log("Repo Manager extension is now active!");
  console.log(
    "Workspace folders:",
    vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath)
  );

  // Initialize providers and managers
  repoProvider = new RepoManagerProvider();
  releaseManager = new GithubManager();
  npmPublisher = new NpmPublisher();
  commitManager = new ConventionalCommitManager();

  // Register tree view
  const treeView = vscode.window.createTreeView("repoManagerView", {
    treeDataProvider: repoProvider,
    showCollapseAll: true,
  });

  console.log("Tree view registered with id: repoManagerView");

  // Register commands
  const refreshCommand = vscode.commands.registerCommand(
    "repoManager.refresh",
    () => {
      repoProvider.refresh();
    }
  );

  const createReleaseCommand = vscode.commands.registerCommand(
    "repoManager.createRelease",
    async (item: PackageTreeItem) => {
      if (item && item.packageInfo) {
        const workspaceInfo = repoProvider.getWorkspaceInfo();
        await releaseManager.createRelease(
          item.packageInfo,
          workspaceInfo || undefined
        );
        repoProvider.refresh();
      }
    }
  );

  const publishNpmCommand = vscode.commands.registerCommand(
    "repoManager.publishNpm",
    async (item: PackageTreeItem) => {
      if (item && item.packageInfo) {
        const workspaceInfo = repoProvider.getWorkspaceInfo();
        if (workspaceInfo) {
          await npmPublisher.publishPackages(item.packageInfo, workspaceInfo);
        } else {
          await npmPublisher.publishPackage(item.packageInfo);
        }
      }
    }
  );

  const conventionalCommitCommand = vscode.commands.registerCommand(
    "repoManager.conventionalCommit",
    async (item: PackageTreeItem) => {
      if (item && item.packageInfo) {
        await commitManager.createConventionalCommit(item.packageInfo);
      }
    }
  );

  const viewPackageDetailsCommand = vscode.commands.registerCommand(
    "repoManager.viewPackageDetails",
    async (item: PackageTreeItem) => {
      if (item && item.packageInfo) {
        await showPackageDetails(item.packageInfo);
      }
    }
  );

  const openPackageJsonCommand = vscode.commands.registerCommand(
    "repoManager.openPackageJson",
    async (item: PackageTreeItem) => {
      if (item && item.packageInfo) {
        const packageJsonPath = vscode.Uri.file(
          `${item.packageInfo.path}/package.json`
        );
        await vscode.window.showTextDocument(packageJsonPath);
      }
    }
  );

  // Add all disposables to context
  context.subscriptions.push(
    treeView,
    refreshCommand,
    createReleaseCommand,
    publishNpmCommand,
    conventionalCommitCommand,
    viewPackageDetailsCommand,
    openPackageJsonCommand
  );

  // Initial setup
  vscode.commands.executeCommand("setContext", "workspaceHasRepos", false);

  // Watch for workspace changes
  const watcher = vscode.workspace.createFileSystemWatcher("**/package.json");
  watcher.onDidCreate(() => repoProvider.refresh());
  watcher.onDidDelete(() => repoProvider.refresh());
  watcher.onDidChange(() => repoProvider.refresh());
  context.subscriptions.push(watcher);
}

/**
 * Show the details of a package.
 * @param packageInfo The package information to display.
 */
async function showPackageDetails(packageInfo: PackageInfo): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "packageDetails",
    `Package Details: ${packageInfo.name}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  panel.webview.html = getPackageDetailsHtml(packageInfo);
}

/**
 * Get the HTML representation of the package details.
 * @param packageInfo The package information to display in HTML format.
 * @returns The HTML string representing the package details.
 */
function getPackageDetailsHtml(packageInfo: PackageInfo): string {
  const dependenciesHtml = packageInfo.dependencies
    ? Object.entries(packageInfo.dependencies)
        .map(([name, version]) => `<li><code>${name}</code>: ${version}</li>`)
        .join("")
    : "<li>No dependencies</li>";

  const devDependenciesHtml = packageInfo.devDependencies
    ? Object.entries(packageInfo.devDependencies)
        .map(([name, version]) => `<li><code>${name}</code>: ${version}</li>`)
        .join("")
    : "<li>No dev dependencies</li>";

  const scriptsHtml = packageInfo.scripts
    ? Object.entries(packageInfo.scripts)
        .map(
          ([name, script]) =>
            `<li><strong>${name}</strong>: <code>${script}</code></li>`
        )
        .join("")
    : "<li>No scripts</li>";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Package Details</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                line-height: 1.6;
            }
            .header {
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 20px;
                margin-bottom: 20px;
            }
            .version {
                color: var(--vscode-textLink-foreground);
                font-weight: bold;
            }
            .private {
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 0.8em;
                margin-left: 10px;
            }
            .section {
                margin-bottom: 30px;
            }
            .section h3 {
                color: var(--vscode-textLink-foreground);
                border-bottom: 1px solid var(--vscode-panel-border);
                padding-bottom: 5px;
            }
            ul {
                list-style-type: none;
                padding-left: 0;
            }
            li {
                padding: 5px 0;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            code {
                background-color: var(--vscode-textCodeBlock-background);
                padding: 2px 4px;
                border-radius: 3px;
                font-family: var(--vscode-editor-font-family);
            }
            .path {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>
                ${packageInfo.name} 
                <span class="version">v${packageInfo.version}</span>
                ${
                  packageInfo.private
                    ? '<span class="private">PRIVATE</span>'
                    : ""
                }
            </h1>
            <div class="path">${packageInfo.path}</div>
            ${
              packageInfo.description ? `<p>${packageInfo.description}</p>` : ""
            }
        </div>

        <div class="section">
            <h3>Scripts</h3>
            <ul>${scriptsHtml}</ul>
        </div>

        <div class="section">
            <h3>Dependencies</h3>
            <ul>${dependenciesHtml}</ul>
        </div>

        <div class="section">
            <h3>Dev Dependencies</h3>
            <ul>${devDependenciesHtml}</ul>
        </div>

        ${
          packageInfo.repository
            ? `
        <div class="section">
            <h3>Repository</h3>
            <p><strong>Type:</strong> ${packageInfo.repository.type}</p>
            <p><strong>URL:</strong> <code>${packageInfo.repository.url}</code></p>
        </div>
        `
            : ""
        }
    </body>
    </html>
  `;
}

export function deactivate() {
  // Clean up resources if needed
}
