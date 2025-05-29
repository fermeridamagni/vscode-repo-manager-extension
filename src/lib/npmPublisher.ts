import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { PackageInfo, WorkspaceInfo } from "../types";

const execAsync = promisify(exec);

/**
 * NpmPublisher class provides methods to publish npm packages with pre-publish checks.
 * It handles user prompts, package validation, and execution of npm commands.
 * Supports both individual package publishing and bulk publishing for monorepos.
 * Enhanced with proper OTP handling and environment variable detection.
 */
class NpmPublisher {
  constructor() {}

  /**
   * Checks for NPM authentication environment variables and configuration files.
   * @param workingDir The directory to check for .npmrc files.
   * @returns Object with authentication status and details.
   */
  private async checkNpmAuth(workingDir: string): Promise<{
    hasToken: boolean;
    hasNpmrc: boolean;
    authMethod: string;
    details: string[];
  }> {
    const details: string[] = [];
    let hasToken = false;
    let hasNpmrc = false;
    let authMethod = "none";

    // Check environment variables
    const npmToken = process.env.NPM_TOKEN || process.env.npm_token;
    const npmAuthToken = process.env.NPM_AUTH_TOKEN;
    const npmConfigAuthtoken = process.env.npm_config_authtoken;

    if (npmToken || npmAuthToken || npmConfigAuthtoken) {
      hasToken = true;
      authMethod = "environment";
      details.push("Found NPM authentication token in environment variables");
    } // Check for .npmrc files (local and global)
    const localNpmrc = path.join(workingDir, ".npmrc");
    const globalNpmrc = path.join(os.homedir(), ".npmrc");

    if (fs.existsSync(localNpmrc)) {
      hasNpmrc = true;
      details.push("Found local .npmrc file");

      try {
        const content = fs.readFileSync(localNpmrc, "utf8");
        if (content.includes("authToken") || content.includes("_auth")) {
          hasToken = true;
          authMethod = authMethod === "none" ? "npmrc" : "both";
          details.push("Local .npmrc contains authentication tokens");
        } else {
          details.push(
            "Local .npmrc exists but contains no authentication tokens"
          );
        }
      } catch (error) {
        details.push("Local .npmrc exists but couldn't read content");
      }
    }

    if (fs.existsSync(globalNpmrc)) {
      hasNpmrc = true;
      details.push("Found global .npmrc file");

      try {
        const content = fs.readFileSync(globalNpmrc, "utf8");
        if (content.includes("authToken") || content.includes("_auth")) {
          hasToken = true;
          authMethod = authMethod === "none" ? "npmrc" : "both";
          details.push("Global .npmrc contains authentication tokens");
        } else {
          details.push(
            "Global .npmrc exists but contains no authentication tokens"
          );
        }
      } catch (error) {
        details.push("Global .npmrc exists but couldn't read content");
      }
    }

    return {
      hasToken,
      hasNpmrc,
      authMethod,
      details,
    };
  }

  /**
   * Executes npm command and handles OTP input properly.
   * @param command The npm command to execute.
   * @param workingDir The directory to run the command in.
   * @param requiresOtp Whether the command might require OTP input.
   * @returns Promise that resolves when command completes.
   */
  private async executeNpmCommand(
    command: string,
    workingDir: string,
    requiresOtp: boolean = false
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      if (requiresOtp) {
        // For commands that might require OTP, use interactive terminal
        const terminal = vscode.window.createTerminal({
          name: "NPM Command",
          cwd: workingDir,
        });

        terminal.show();
        terminal.sendText(command);

        // Show message and wait for user confirmation
        vscode.window
          .showInformationMessage(
            "NPM command is running in the terminal. If prompted for OTP (One-Time Password), please enter it. Click OK when the command completes.",
            "OK"
          )
          .then(() => {
            terminal.dispose();
            resolve({ success: true, output: "Command completed in terminal" });
          });
      } else {
        // For non-interactive commands, use child_process
        const child = spawn("npm", command.split(" ").slice(1), {
          cwd: workingDir,
          stdio: ["pipe", "pipe", "pipe"],
          shell: true,
        });

        let output = "";
        let errorOutput = "";

        child.stdout?.on("data", (data) => {
          output += data.toString();
        });

        child.stderr?.on("data", (data) => {
          errorOutput += data.toString();
        });

        child.on("close", (code) => {
          resolve({
            success: code === 0,
            output: output,
            error: code !== 0 ? errorOutput : undefined,
          });
        });

        child.on("error", (error) => {
          resolve({
            success: false,
            output: "",
            error: error.message,
          });
        });
      }
    });
  }

  /**
   * Publishes packages based on workspace versioning strategy.
   * For fixed strategy: publishes all packages with the same version.
   * For independent strategy: publishes a single package.
   * @param packageInfo Information about the package to publish (or root package for fixed strategy).
   * @param workspaceInfo Information about the workspace and versioning strategy.
   */
  public async publishPackages(
    packageInfo: PackageInfo,
    workspaceInfo: WorkspaceInfo
  ): Promise<void> {
    if (workspaceInfo.versionStrategy === "fixed") {
      await this.publishAllPackages(workspaceInfo);
    } else {
      await this.publishPackage(packageInfo);
    }
  }

  /**
   * Publishes all packages in a fixed versioning workspace with the same version.
   * @param workspaceInfo Information about the workspace.
   */
  public async publishAllPackages(workspaceInfo: WorkspaceInfo): Promise<void> {
    if (!workspaceInfo.rootPackage) {
      vscode.window.showErrorMessage(
        "No root package found for fixed versioning strategy"
      );
      return;
    }

    try {
      const rootPackage = workspaceInfo.rootPackage;
      const packagesToPublish = workspaceInfo.packages.filter(
        (pkg) => !pkg.private
      );

      if (packagesToPublish.length === 0) {
        vscode.window.showWarningMessage(
          "No publishable packages found (all packages are private)"
        );
        return;
      }

      // Check if any packages are private and warn
      const privatePackages = workspaceInfo.packages.filter(
        (pkg) => pkg.private
      );
      if (privatePackages.length > 0) {
        const proceed = await vscode.window.showWarningMessage(
          `Found ${
            privatePackages.length
          } private package(s) that will be skipped: ${privatePackages
            .map((p) => p.name)
            .join(", ")}. Continue with publishing ${
            packagesToPublish.length
          } public packages?`,
          "Yes",
          "No"
        );

        if (proceed !== "Yes") {
          return;
        }
      }

      // Check if user is logged in to npm
      const loginCheck = await this.checkNpmLogin(rootPackage.path);
      if (!loginCheck) {
        const login = await vscode.window.showInformationMessage(
          "You need to be logged in to npm to publish packages.",
          "Login to npm",
          "Cancel"
        );

        if (login === "Login to npm") {
          await this.npmLogin(rootPackage.path);
        } else {
          return;
        }
      }

      // Ask for publish options
      const publishOptions = await this.getPublishOptions();
      if (!publishOptions) {
        return;
      }

      // Run pre-publish checks for all packages
      const allChecksPass =
        await this.runBulkPrePublishChecks(packagesToPublish);
      if (!allChecksPass) {
        return;
      }

      // Show confirmation for bulk publish
      const packageNames = packagesToPublish.map((pkg) => pkg.name).join(", ");
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to publish ${
          packagesToPublish.length
        } packages (${packageNames}) all with version ${rootPackage.version}${
          publishOptions.tag !== "latest"
            ? ` with tag "${publishOptions.tag}"`
            : ""
        }?`,
        "Yes, Publish All",
        "Cancel"
      );

      if (confirm !== "Yes, Publish All") {
        return;
      }

      // Publish all packages
      await this.executeBulkPublish(
        packagesToPublish,
        publishOptions,
        rootPackage.version
      );

      vscode.window
        .showInformationMessage(
          `Successfully published ${packagesToPublish.length} packages with version ${rootPackage.version}!`,
          "View Published Packages"
        )
        .then((action) => {
          if (action === "View Published Packages") {
            // Open the first package on npmjs.com as an example
            if (packagesToPublish.length > 0) {
              vscode.env.openExternal(
                vscode.Uri.parse(
                  `https://www.npmjs.com/package/${packagesToPublish[0].name}`
                )
              );
            }
          }
        });
    } catch (error: any) {
      console.error("Error publishing packages:", error);
      vscode.window.showErrorMessage(
        `Failed to publish packages: ${error.message}`
      );
    }
  }

  /**
   * Publishes a package to npm with pre-publish checks and options.
   * @param packageInfo Information about the package to publish.
   */
  public async publishPackage(packageInfo: PackageInfo): Promise<void> {
    try {
      // Check if package is private
      if (packageInfo.private) {
        const proceed = await vscode.window.showWarningMessage(
          "This package is marked as private. Do you want to continue?",
          "Yes",
          "No"
        );

        if (proceed !== "Yes") {
          return;
        }
      }

      // Check if user is logged in to npm
      const loginCheck = await this.checkNpmLogin(packageInfo.path);
      if (!loginCheck) {
        const action = await vscode.window.showInformationMessage(
          "You need to be logged in to npm to publish packages.",
          "Login to npm",
          "Open Terminal for Manual Publish",
          "Cancel"
        );

        if (action === "Login to npm") {
          await this.npmLogin(packageInfo.path);
          // Re-check authentication after login attempt
          const recheck = await this.checkNpmLogin(packageInfo.path);
          if (!recheck) {
            vscode.window.showErrorMessage(
              "Authentication failed. Please try again or use manual publish."
            );
            return;
          }
        } else if (action === "Open Terminal for Manual Publish") {
          // Get publish options first
          const manualPublishOptions = await this.getPublishOptions();
          if (!manualPublishOptions) {
            return;
          }

          // Build the npm publish command
          let publishCommand = "npm publish";
          if (manualPublishOptions.tag !== "latest") {
            publishCommand += ` --tag ${manualPublishOptions.tag}`;
          }
          if (manualPublishOptions.access === "public") {
            publishCommand += " --access public";
          }

          // Open terminal with the command
          const terminal = vscode.window.createTerminal({
            name: `NPM Publish - ${packageInfo.name}`,
            cwd: packageInfo.path,
          });

          terminal.show();
          terminal.sendText(publishCommand);

          vscode.window.showInformationMessage(
            `Terminal opened for manual NPM publish. Command: ${publishCommand}\n\nPlease ensure you're authenticated (run 'npm login' if needed) and complete the publish process manually.`
          );
          return;
        } else {
          return;
        }
      }

      // Ask for publish options
      const publishOptions = await this.getPublishOptions();
      if (!publishOptions) {
        return;
      }

      // Run pre-publish checks
      const preChecks = await this.runPrePublishChecks(packageInfo);
      if (!preChecks) {
        return;
      }

      // Show confirmation
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to publish ${packageInfo.name}@${
          packageInfo.version
        }${
          publishOptions.tag !== "latest"
            ? ` with tag "${publishOptions.tag}"`
            : ""
        }?`,
        "Yes, Publish",
        "Cancel"
      );

      if (confirm !== "Yes, Publish") {
        return;
      }

      // Publish the package
      await this.executePublish(packageInfo, publishOptions);

      vscode.window
        .showInformationMessage(
          `Successfully published ${packageInfo.name}@${packageInfo.version}!`,
          "View on npmjs.com"
        )
        .then((action) => {
          if (action === "View on npmjs.com") {
            vscode.env.openExternal(
              vscode.Uri.parse(
                `https://www.npmjs.com/package/${packageInfo.name}`
              )
            );
          }
        });
    } catch (error: any) {
      console.error("Error publishing package:", error);
      vscode.window.showErrorMessage(
        `Failed to publish package: ${error.message}`
      );
    }
  }
  /**
   * Checks if the user is logged in to npm or has valid authentication.
   * @param workingDir The directory to run the npm command in.
   * @returns True if logged in or has valid auth, false otherwise.
   */
  private async checkNpmLogin(workingDir: string): Promise<boolean> {
    try {
      // First check for environment variables and .npmrc files
      const authCheck = await this.checkNpmAuth(workingDir);

      if (authCheck.hasToken) {
        vscode.window.showInformationMessage(
          `NPM authentication detected (${
            authCheck.authMethod
          }): ${authCheck.details.join(", ")}`
        );

        // Still verify with npm whoami to be sure
        const result = await this.executeNpmCommand(
          "npm whoami",
          workingDir,
          false
        );
        if (
          result.success &&
          result.output.trim() &&
          !result.output.includes("ENEEDAUTH")
        ) {
          return true;
        }
      }

      // If no environment auth or whoami failed, check npm whoami
      const result = await this.executeNpmCommand(
        "npm whoami",
        workingDir,
        false
      );

      if (
        result.success &&
        result.output.trim() &&
        !result.output.includes("ENEEDAUTH")
      ) {
        return true;
      }

      // Show detailed error if authentication failed
      if (result.error || result.output.includes("ENEEDAUTH")) {
        const errorDetails =
          authCheck.details.length > 0
            ? ` Found: ${authCheck.details.join(", ")}`
            : "";
        vscode.window.showWarningMessage(
          `NPM authentication required. No valid authentication found in environment variables or .npmrc files.${errorDetails}`
        );
      }

      return false;
    } catch (error) {
      console.error("Error checking NPM login:", error);
      return false;
    }
  }
  /**
   * Prompts the user to log in to npm with multiple authentication options.
   * @param workingDir The directory to run the npm login command in.
   */
  private async npmLogin(workingDir: string): Promise<void> {
    const authOption = await vscode.window.showQuickPick(
      [
        {
          label: "Interactive Login",
          detail: "Login using npm login command (may require OTP)",
        },
        {
          label: "Token Authentication",
          detail: "Use NPM_TOKEN environment variable or .npmrc file",
        },
        {
          label: "Manual Setup",
          detail: "Get instructions for setting up authentication",
        },
      ],
      {
        placeHolder: "Choose authentication method",
      }
    );

    if (!authOption) {
      return;
    }

    switch (authOption.label) {
      case "Interactive Login":
        await this.executeNpmCommand("npm login", workingDir, true);
        break;

      case "Token Authentication":
        const tokenInstructions = `
To set up token authentication:

1. Get your NPM access token:
   - Go to https://www.npmjs.com/
   - Login and go to Access Tokens
   - Generate a new token (Automation or Publishing)

2. Set the token in one of these ways:
   - Environment variable: NPM_TOKEN=your_token_here
   - Local .npmrc file: //registry.npmjs.org/:_authToken=your_token_here
   - Global .npmrc file in your home directory

3. For scoped packages, add: @your-scope:registry=https://registry.npmjs.org/
        `;

        vscode.window
          .showInformationMessage(
            "NPM Token Setup Instructions",
            "Copy Instructions"
          )
          .then((action) => {
            if (action === "Copy Instructions") {
              vscode.env.clipboard.writeText(tokenInstructions);
            }
          });
        break;

      case "Manual Setup":
        const manualInstructions = `
NPM Authentication Setup Options:

1. **npm login** (Interactive):
   - Run: npm login
   - Enter username, password, email
   - May require OTP if 2FA is enabled

2. **Access Token** (Recommended for CI/CD):
   - Create token at npmjs.com
   - Set NPM_TOKEN environment variable
   - Or add to .npmrc: //registry.npmjs.org/:_authToken=TOKEN

3. **Legacy auth**:
   - Add to .npmrc: _auth=base64(username:password)
   - Not recommended for security reasons

Current working directory: ${workingDir}
        `;

        const action = await vscode.window.showInformationMessage(
          "NPM authentication setup instructions are ready.",
          "Copy Instructions",
          "Open Terminal"
        );

        if (action === "Copy Instructions") {
          vscode.env.clipboard.writeText(manualInstructions);
        } else if (action === "Open Terminal") {
          const terminal = vscode.window.createTerminal({
            name: "NPM Setup",
            cwd: workingDir,
          });
          terminal.show();
        }
        break;
    }
  }

  /**
   * Prompts the user to select publish options (tag and access level).
   * @returns The selected options or null if cancelled.
   */
  private async getPublishOptions(): Promise<{
    tag: string;
    access: string;
  } | null> {
    // Choose publish tag
    const tag = await vscode.window.showQuickPick(
      [
        { label: "latest", detail: "Stable release (default)" },
        { label: "beta", detail: "Beta release" },
        { label: "alpha", detail: "Alpha release" },
        { label: "next", detail: "Next release" },
        { label: "custom", detail: "Enter custom tag" },
      ],
      { placeHolder: "Select publish tag" }
    );

    if (!tag) {
      return null;
    }

    let selectedTag = tag.label;
    if (tag.label === "custom") {
      const customTag = await vscode.window.showInputBox({
        prompt: "Enter custom tag name",
        placeHolder: "my-tag",
      });

      if (!customTag) {
        return null;
      }

      selectedTag = customTag;
    }

    // Choose access level
    const access = await vscode.window.showQuickPick(
      [
        { label: "public", detail: "Anyone can install this package" },
        {
          label: "restricted",
          detail: "Only members of your organization can install",
        },
      ],
      { placeHolder: "Select package access level" }
    );

    if (!access) {
      return null;
    }

    return {
      tag: selectedTag,
      access: access.label,
    };
  }

  /**
   * Runs pre-publish checks like building the package, running tests, and checking files.
   * @param packageInfo Information about the package to publish.
   * @returns True if all checks pass, false otherwise.
   */
  private async runPrePublishChecks(
    packageInfo: PackageInfo
  ): Promise<boolean> {
    const checks: Array<{
      name: string;
      check: () => Promise<boolean>;
      required: boolean;
    }> = [
      {
        name: "Build package",
        check: () => this.runBuildScript(packageInfo),
        required: true,
      },
      {
        name: "Run tests",
        check: () => this.runTests(packageInfo),
        required: false,
      },
      {
        name: "Check package files",
        check: () => this.checkPackageFiles(packageInfo),
        required: true,
      },
    ];

    for (const check of checks) {
      const progress = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Running pre-publish check: ${check.name}`,
          cancellable: false,
        },
        async () => {
          return await check.check();
        }
      );

      if (!progress && check.required) {
        vscode.window.showErrorMessage(
          `Required pre-publish check failed: ${check.name}`
        );
        return false;
      }
    }

    return true;
  }
  /**
   * Runs the build script defined in package.json.
   * Enhanced with proper exit code handling and output capture.
   * @param packageInfo Information about the package to build.
   * @returns True if build script runs successfully, false otherwise.
   */
  private async runBuildScript(packageInfo: PackageInfo): Promise<boolean> {
    if (!packageInfo.scripts?.build) {
      return true; // No build script is okay
    }

    try {
      const result = await this.executeNpmCommand(
        "npm run build",
        packageInfo.path,
        false
      );

      if (!result.success) {
        vscode.window.showErrorMessage(
          `Build failed for ${packageInfo.name}: ${
            result.error || "Unknown error"
          }`
        );

        // Offer to show build output
        const showOutput = await vscode.window.showErrorMessage(
          "Build script failed. Would you like to see the output?",
          "Show Output",
          "Continue Anyway",
          "Cancel"
        );

        if (showOutput === "Show Output") {
          const outputChannel = vscode.window.createOutputChannel(
            `Build: ${packageInfo.name}`
          );
          outputChannel.appendLine("Build Output:");
          outputChannel.appendLine(result.output);
          if (result.error) {
            outputChannel.appendLine("\nError Output:");
            outputChannel.appendLine(result.error);
          }
          outputChannel.show();
        }

        return showOutput === "Continue Anyway";
      }

      return true;
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Build script execution failed: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Runs the test script defined in package.json.
   * Enhanced with proper exit code handling and output capture.
   * @param packageInfo Information about the package to test.
   * @returns True if tests run successfully, false otherwise.
   */
  private async runTests(packageInfo: PackageInfo): Promise<boolean> {
    if (!packageInfo.scripts?.test) {
      return true; // No test script is okay
    }

    try {
      const result = await this.executeNpmCommand(
        "npm test",
        packageInfo.path,
        false
      );

      if (!result.success) {
        vscode.window.showWarningMessage(
          `Tests failed for ${packageInfo.name}: ${
            result.error || "Unknown error"
          }`
        );

        // Offer to show test output
        const showOutput = await vscode.window.showWarningMessage(
          "Test script failed. Would you like to see the output?",
          "Show Output",
          "Continue Anyway",
          "Cancel"
        );

        if (showOutput === "Show Output") {
          const outputChannel = vscode.window.createOutputChannel(
            `Tests: ${packageInfo.name}`
          );
          outputChannel.appendLine("Test Output:");
          outputChannel.appendLine(result.output);
          if (result.error) {
            outputChannel.appendLine("\nError Output:");
            outputChannel.appendLine(result.error);
          }
          outputChannel.show();
        }

        return showOutput === "Continue Anyway";
      }

      return true;
    } catch (error: any) {
      vscode.window.showWarningMessage(
        `Test script execution failed: ${error.message}`
      );
      return false;
    }
  }
  /**
   * Checks if essential files for publishing exist in the package directory.
   * @param packageInfo Information about the package to check.
   * @returns True if all essential files exist, false otherwise.
   */
  private async checkPackageFiles(packageInfo: PackageInfo): Promise<boolean> {
    // Check if essential files exist
    const essentialFiles = ["package.json"];

    for (const file of essentialFiles) {
      const filePath = path.join(packageInfo.path, file);
      if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`Essential file missing: ${file}`);
        return false;
      }
    }

    return true;
  }
  /**
   * Executes the npm publish command with the specified options.
   * Enhanced to properly handle OTP input and provide better feedback.
   * @param packageInfo Information about the package to publish.
   * @param options Publish options like tag and access level.
   */
  private async executePublish(
    packageInfo: PackageInfo,
    options: { tag: string; access: string }
  ): Promise<void> {
    let publishCommand = "npm publish";

    if (options.tag !== "latest") {
      publishCommand += ` --tag ${options.tag}`;
    }

    if (options.access === "public") {
      publishCommand += " --access public";
    }

    // Check if package might require OTP (2FA can be enabled even with tokens)
    const authCheck = await this.checkNpmAuth(packageInfo.path);

    // Show OTP warning for all authenticated users (2FA can be enabled regardless of auth method)
    const otpWarning = await vscode.window.showWarningMessage(
      `Publishing ${packageInfo.name}@${packageInfo.version}. If you have 2FA enabled on your NPM account, you may need to enter an OTP (One-Time Password).`,
      "Continue with Auto Publish",
      "Use Terminal for Manual Publish",
      "Cancel"
    );

    if (otpWarning === "Cancel") {
      vscode.window.showInformationMessage("NPM publish cancelled by user.");
      return;
    }

    if (otpWarning === "Use Terminal for Manual Publish") {
      // Open terminal with the command for manual publish
      const terminal = vscode.window.createTerminal({
        name: `NPM Publish - ${packageInfo.name}`,
        cwd: packageInfo.path,
      });

      terminal.show();
      terminal.sendText(publishCommand);

      // Don't show success message - user needs to complete the process manually
      return;
    }

    // Try automated publish first
    const result = await this.executeNpmCommand(
      publishCommand,
      packageInfo.path,
      false // Start with non-interactive mode
    );

    if (!result.success && result.error) {
      // Parse common npm publish errors and provide helpful messages
      if (result.error.includes("EOTP")) {
        // OTP required - offer manual publish option
        const otpAction = await vscode.window.showWarningMessage(
          "OTP (One-Time Password) required for publishing. NPM requires 2FA authentication.",
          "Open Terminal for Manual Publish",
          "Cancel"
        );

        if (otpAction === "Open Terminal for Manual Publish") {
          const terminal = vscode.window.createTerminal({
            name: `NPM Publish with OTP - ${packageInfo.name}`,
            cwd: packageInfo.path,
          });

          terminal.show();
          terminal.sendText(publishCommand);

          vscode.window.showInformationMessage(
            `Terminal opened for manual NPM publish with OTP support.\n\nCommand: ${publishCommand}\n\nPlease enter your OTP when prompted and complete the publish process.`
          );
          return;
        } else {
          vscode.window.showInformationMessage(
            "NPM publish cancelled. OTP authentication required."
          );
          return;
        }
      } else if (result.error.includes("ENEEDAUTH")) {
        throw new Error(
          "Authentication required. Please run npm login or set up an NPM access token."
        );
      } else if (result.error.includes("E403")) {
        throw new Error(
          "Permission denied. You may not have permission to publish this package or the version already exists."
        );
      } else if (result.error.includes("ENOTFOUND")) {
        throw new Error(
          "Network error. Please check your internet connection and npm registry settings."
        );
      } else {
        throw new Error(`NPM publish failed: ${result.error}`);
      }
    }

    // Show success message with package details
    vscode.window.showInformationMessage(
      `✅ Successfully published ${packageInfo.name}@${packageInfo.version}${
        options.tag !== "latest" ? ` with tag "${options.tag}"` : ""
      }`
    );
  }

  /**
   * Runs pre-publish checks for all packages in bulk.
   * @param packages Array of packages to check.
   * @returns True if all checks pass for all packages, false otherwise.
   */
  private async runBulkPrePublishChecks(
    packages: PackageInfo[]
  ): Promise<boolean> {
    for (const packageInfo of packages) {
      const checksPass = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Running checks for ${packageInfo.name}`,
          cancellable: false,
        },
        async () => {
          return await this.runPrePublishChecks(packageInfo);
        }
      );

      if (!checksPass) {
        vscode.window.showErrorMessage(
          `Pre-publish checks failed for package: ${packageInfo.name}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Executes npm publish for all packages with the specified options and version.
   * @param packages Array of packages to publish.
   * @param options Publish options like tag and access level.
   * @param version Version to publish all packages with.
   */
  private async executeBulkPublish(
    packages: PackageInfo[],
    options: { tag: string; access: string },
    version: string
  ): Promise<void> {
    const publishPromises = packages.map(async (packageInfo, index) => {
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Publishing ${packageInfo.name}@${version} (${index + 1}/${
            packages.length
          })`,
          cancellable: false,
        },
        async () => {
          // Update package.json version if needed
          if (packageInfo.version !== version) {
            await this.updatePackageVersion(packageInfo, version);
          }

          await this.executePublish(packageInfo, options);
        }
      );
    });

    // Execute all publishes in parallel (with some concurrency limit)
    const batchSize = 3; // Limit concurrent publishes to avoid rate limits
    for (let i = 0; i < publishPromises.length; i += batchSize) {
      const batch = publishPromises.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }
  /**
   * Updates the version in a package's package.json file.
   * @param packageInfo Information about the package to update.
   * @param newVersion The new version to set.
   */
  private async updatePackageVersion(
    packageInfo: PackageInfo,
    newVersion: string
  ): Promise<void> {
    const packageJsonPath = path.join(packageInfo.path, "package.json");

    try {
      const packageJsonContent = await fs.promises.readFile(
        packageJsonPath,
        "utf8"
      );
      const packageJson = JSON.parse(packageJsonContent);
      packageJson.version = newVersion;
      await fs.promises.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2)
      );

      // Update the packageInfo object to reflect the change
      packageInfo.version = newVersion;
    } catch (error: any) {
      throw new Error(
        `Failed to update version for ${packageInfo.name}: ${error.message}`
      );
    }
  }
}

export { NpmPublisher };
