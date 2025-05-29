import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";

import type { PackageInfo, WorkspaceInfo } from "../types";

/**
 * PackageTreeItem represents a single package in the tree view.
 * It extends vscode.TreeItem to provide custom properties and behavior.
 */
class PackageTreeItem extends vscode.TreeItem {
  constructor(
    public readonly packageInfo: PackageInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command
  ) {
    super(packageInfo.name, collapsibleState);

    this.tooltip = `${packageInfo.name} v${packageInfo.version}`;
    this.description = packageInfo.version;
    this.contextValue = "package";

    // Set icon based on package type
    if (packageInfo.private) {
      this.iconPath = new vscode.ThemeIcon("lock");
    } else {
      this.iconPath = new vscode.ThemeIcon("package");
    }
  }
}

/**
 * NoPackagesTreeItem is displayed when no packages are found in the workspace.
 * It provides a message and a command to refresh the view.
 */
class NoPackagesTreeItem extends vscode.TreeItem {
  constructor() {
    super("No packages found", vscode.TreeItemCollapsibleState.None);

    this.tooltip = "No package.json files found in this workspace";
    this.description = "Try refreshing or add a package.json file";
    this.contextValue = "noPackages";
    this.iconPath = new vscode.ThemeIcon("info");

    // Add a command to refresh when clicked
    this.command = {
      command: "repoManager.refresh",
      title: "Refresh",
      arguments: [],
    };
  }
}

/**
 * RepoManagerProvider is a class that implements vscode.TreeDataProvider
 * to manage and display packages in the workspace.
 * It provides methods to load packages, refresh the view, and handle tree item interactions.
 */
class RepoManagerProvider
  implements vscode.TreeDataProvider<PackageTreeItem | NoPackagesTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    PackageTreeItem | NoPackagesTreeItem | undefined | null | void
  > = new vscode.EventEmitter<
    PackageTreeItem | NoPackagesTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<
    PackageTreeItem | NoPackagesTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  private packages: PackageInfo[] = [];
  private isInitialized = false;
  private workspaceInfo: WorkspaceInfo | null = null;

  constructor() {
    console.log("RepoManagerProvider constructor called");
    this.refresh();
  }

  /**
   * Refreshes the package list and updates the tree view.
   */
  public refresh(): void {
    console.log("RepoManagerProvider refresh called");
    this.loadPackages()
      .then(() => {
        this.isInitialized = true;
        console.log("Packages loaded, firing tree data change event");
        this._onDidChangeTreeData.fire();
      })
      .catch((error) => {
        console.error("Error loading packages:", error);
      });
  }
  /**
   * Returns the tree item for the given element.
   * @param element The package tree item to return.
   */
  public getTreeItem(
    element: PackageTreeItem | NoPackagesTreeItem
  ): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children of the given element or the root packages if no element is provided.
   * @param element The parent package tree item, or undefined for root packages.
   */ public getChildren(
    element?: PackageTreeItem | NoPackagesTreeItem
  ): Thenable<(PackageTreeItem | NoPackagesTreeItem)[]> {
    console.log(
      "getChildren called, element:",
      element,
      "isInitialized:",
      this.isInitialized
    );
    if (!element) {
      // Return root packages or fallback message
      console.log("Returning root packages, count:", this.packages.length);

      if (!this.isInitialized) {
        console.log("Not initialized yet, loading packages now");
        return this.loadPackages().then(() => {
          this.isInitialized = true;
          console.log(
            "Packages loaded in getChildren, count:",
            this.packages.length
          );

          if (this.packages.length === 0) {
            return [new NoPackagesTreeItem()];
          }

          return this.packages.map(
            (pkg) =>
              new PackageTreeItem(pkg, vscode.TreeItemCollapsibleState.None)
          );
        });
      }

      // If no packages found, show fallback message
      if (this.packages.length === 0) {
        return Promise.resolve([new NoPackagesTreeItem()]);
      }

      return Promise.resolve(
        this.packages.map(
          (pkg) =>
            new PackageTreeItem(pkg, vscode.TreeItemCollapsibleState.None)
        )
      );
    }
    return Promise.resolve([]);
  }
  /**
   * Loads packages from the workspace and updates the internal package list.
   */
  private async loadPackages(): Promise<void> {
    console.log("LoadPackages called");
    this.packages = [];

    if (!vscode.workspace.workspaceFolders) {
      console.log("No workspace folders found");
      return;
    }

    console.log(
      "Workspace folders:",
      vscode.workspace.workspaceFolders.map((f) => f.uri.fsPath)
    );

    for (const folder of vscode.workspace.workspaceFolders) {
      await this.scanForPackages(folder.uri.fsPath);
    }

    // Detect workspace info and apply versioning strategy
    this.workspaceInfo = await this.detectWorkspaceInfo();
    this.applyVersioningStrategy();

    console.log("Packages found:", this.packages.length);
    this.packages.forEach((pkg) =>
      console.log("Package:", pkg.name, pkg.version)
    );

    // Set context to show the view
    vscode.commands.executeCommand(
      "setContext",
      "workspaceHasRepos",
      this.packages.length > 0
    );
  }

  /**
   * Scans the given root path for package.json files and collects package information.
   * @param rootPath The root directory to scan for packages.
   */
  private async scanForPackages(rootPath: string): Promise<void> {
    try {
      console.log("Scanning for packages in:", rootPath);

      // Check root for package.json
      const rootPackageJsonPath = path.join(rootPath, "package.json");
      console.log("Checking for root package.json at:", rootPackageJsonPath);

      if (fs.existsSync(rootPackageJsonPath)) {
        console.log("Found root package.json");
        const packageInfo = await this.parsePackageJson(rootPackageJsonPath);
        if (packageInfo) {
          console.log("Parsed root package:", packageInfo.name);
          this.packages.push(packageInfo);
        }
      }

      // Look for packages in common monorepo locations
      const commonPaths = ["packages", "apps", "libs", "modules"];

      for (const commonPath of commonPaths) {
        const packagesDir = path.join(rootPath, commonPath);
        console.log("Checking for packages directory:", packagesDir);

        if (
          fs.existsSync(packagesDir) &&
          fs.statSync(packagesDir).isDirectory()
        ) {
          console.log("Found packages directory:", packagesDir);
          const entries = fs.readdirSync(packagesDir);

          for (const entry of entries) {
            const entryPath = path.join(packagesDir, entry);
            if (fs.statSync(entryPath).isDirectory()) {
              const packageJsonPath = path.join(entryPath, "package.json");
              if (fs.existsSync(packageJsonPath)) {
                console.log("Found package.json at:", packageJsonPath);
                const packageInfo =
                  await this.parsePackageJson(packageJsonPath);
                if (packageInfo) {
                  console.log("Parsed package:", packageInfo.name);
                  this.packages.push(packageInfo);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error scanning for packages:", error);
    }
  }

  /**
   * Parses the package.json file at the given path and returns package information.
   * @param packageJsonPath The path to the package.json file.
   * @returns A Promise that resolves to PackageInfo or null if parsing fails.
   */
  private async parsePackageJson(
    packageJsonPath: string
  ): Promise<PackageInfo | null> {
    try {
      console.log("Parsing package.json at:", packageJsonPath);
      const content = fs.readFileSync(packageJsonPath, "utf8");
      const packageJson = JSON.parse(content);

      const packageInfo: PackageInfo = {
        name: packageJson.name || path.basename(path.dirname(packageJsonPath)),
        version: packageJson.version || "0.0.0",
        path: path.dirname(packageJsonPath),
        description: packageJson.description,
        private: packageJson.private || false,
        scripts: packageJson.scripts,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
        repository: packageJson.repository,
      };

      console.log(
        "Successfully parsed package:",
        packageInfo.name,
        packageInfo.version
      );
      return packageInfo;
    } catch (error) {
      console.error(`Error parsing package.json at ${packageJsonPath}:`, error);
      return null;
    }
  }

  /**
   * Detects the workspace type and versioning strategy.
   * @returns WorkspaceInfo containing the detected configuration.
   */
  private async detectWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        isMonorepo: false,
        versionStrategy: "independent",
        packages: this.packages,
      };
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const rootPackageJsonPath = path.join(rootPath, "package.json");

    if (!fs.existsSync(rootPackageJsonPath)) {
      return {
        isMonorepo: false,
        versionStrategy: "independent",
        packages: this.packages,
      };
    }

    try {
      const content = fs.readFileSync(rootPackageJsonPath, "utf8");
      const rootPackageJson = JSON.parse(content);

      // Find root package in our packages list
      const rootPackage = this.packages.find((pkg) => pkg.path === rootPath);

      // Check if this is a monorepo by looking for workspaces or multiple packages
      const hasWorkspaces = rootPackageJson.workspaces;
      const hasMultiplePackages = this.packages.length > 1;
      const isMonorepo = hasWorkspaces || hasMultiplePackages;

      if (!isMonorepo) {
        return {
          isMonorepo: false,
          versionStrategy: "independent",
          packages: this.packages,
        };
      }

      // Check for version strategy in root package.json
      const versionStrategy =
        rootPackageJson.versionStrategy ||
        rootPackageJson.version_strategy ||
        "independent"; // Default to independent

      return {
        isMonorepo: true,
        versionStrategy: versionStrategy as "independent" | "fixed",
        rootPackage,
        packages: this.packages,
      };
    } catch (error) {
      console.error("Error reading root package.json:", error);
      return {
        isMonorepo: false,
        versionStrategy: "independent",
        packages: this.packages,
      };
    }
  }

  /**
   * Applies the versioning strategy to filter packages shown in the tree.
   */
  private applyVersioningStrategy(): void {
    if (!this.workspaceInfo || !this.workspaceInfo.isMonorepo) {
      return; // No changes needed for single packages
    }

    if (this.workspaceInfo.versionStrategy === "fixed") {
      // For fixed versioning, only show the root package if it exists
      if (this.workspaceInfo.rootPackage) {
        this.packages = [this.workspaceInfo.rootPackage];
        console.log(
          "Applied fixed versioning strategy - showing only root package"
        );
      }
    } else if (this.workspaceInfo.versionStrategy === "independent") {
      // For independent versioning, hide the root package if it exists
      if (this.workspaceInfo.rootPackage) {
        this.packages = this.packages.filter(
          (pkg) => pkg.path !== this.workspaceInfo!.rootPackage!.path
        );
        console.log(
          "Applied independent versioning strategy - hiding root package"
        );
      }
    }
  }

  /**
   * Gets the workspace information including versioning strategy.
   * @returns The WorkspaceInfo object or null if not detected.
   */
  public getWorkspaceInfo(): WorkspaceInfo | null {
    return this.workspaceInfo;
  }

  /**
   * Gets a package by its name.
   * @param name The name of the package to retrieve.
   * @returns The PackageInfo object if found, otherwise undefined.
   */
  getPackageByName(name: string): PackageInfo | undefined {
    return this.packages.find((pkg) => pkg.name === name);
  }

  /**
   * Gets all packages in the workspace.
   * @returns An array of PackageInfo objects.
   */
  getAllPackages(): PackageInfo[] {
    return [...this.packages];
  }
}

export { RepoManagerProvider, PackageTreeItem, NoPackagesTreeItem };
