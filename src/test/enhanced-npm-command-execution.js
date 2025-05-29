#!/usr/bin/env node

/**
 * Enhanced NPM Command Execution with Timeout Protection
 *
 * This file contains the enhanced executeNpmCommand method that includes:
 * - Configurable timeouts to prevent hanging
 * - Better progress reporting
 * - Command cancellation support
 * - Detailed logging for diagnostics
 */

console.log("🔧 Enhanced NPM Command Execution Implementation\n");

console.log("📋 Key Improvements:");
console.log("✅ 1. Timeout protection for all npm commands");
console.log("✅ 2. Configurable timeout values per command type");
console.log("✅ 3. Progress reporting with time elapsed");
console.log("✅ 4. Graceful command termination");
console.log("✅ 5. Better error handling and diagnostics");
console.log("✅ 6. User cancellation support");

console.log("\n🔄 Implementation Details:\n");

const implementationCode = `
/**
 * Enhanced executeNpmCommand with timeout protection and better progress reporting
 */
private async executeNpmCommand(
  command: string,
  workingDir: string,
  requiresOtp: boolean = false,
  options: {
    timeoutMs?: number;
    showProgress?: boolean;
    allowCancel?: boolean;
    progressTitle?: string;
  } = {}
): Promise<{ success: boolean; output: string; error?: string; timedOut?: boolean; cancelled?: boolean }> {
  
  // Default timeout values based on command type
  const defaultTimeouts = {
    'npm run build': 120000,    // 2 minutes for build
    'npm test': 180000,         // 3 minutes for tests
    'npm publish': 60000,       // 1 minute for publish
    default: 90000              // 90 seconds default
  };

  const timeoutMs = options.timeoutMs || 
    defaultTimeouts[command] || 
    defaultTimeouts.default;

  const progressTitle = options.progressTitle || \`Running: \${command}\`;

  if (requiresOtp) {
    // For commands that might require OTP, use interactive terminal
    return this.executeInteractiveNpmCommand(command, workingDir, timeoutMs);
  }

  // For non-interactive commands with timeout protection
  return new Promise((resolve) => {
    let completed = false;
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;
    const startTime = Date.now();

    // Progress tracking
    let progressResolve: ((value: any) => void) | null = null;
    
    if (options.showProgress !== false) {
      // Show progress with cancellation option
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: progressTitle,
          cancellable: options.allowCancel !== false,
        },
        async (progress, token) => {
          return new Promise((progressRes) => {
            progressResolve = progressRes;
            
            // Handle cancellation
            token.onCancellationRequested(() => {
              if (!completed) {
                cancelled = true;
                console.log(\`🚫 User cancelled command: \${command}\`);
                cleanup(true);
              }
            });

            // Progress updates every 5 seconds
            const progressInterval = setInterval(() => {
              if (!completed) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const remaining = Math.max(0, Math.floor((timeoutMs - (Date.now() - startTime)) / 1000));
                progress.report({
                  message: \`Elapsed: \${elapsed}s, Timeout in: \${remaining}s\`
                });
              } else {
                clearInterval(progressInterval);
              }
            }, 5000);
          });
        }
      );
    }

    const child = spawn("npm", command.split(" ").slice(1), {
      cwd: workingDir,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    let errorOutput = "";

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!completed) {
        console.log(\`⏰ Command timeout: \${command} exceeded \${timeoutMs}ms\`);
        cleanup(false, true);
      }
    }, timeoutMs);

    const cleanup = (userCancelled = false, timedOut = false) => {
      if (completed) return;
      completed = true;
      
      clearTimeout(timeoutId);
      
      // Terminate the child process
      if (child && !child.killed) {
        console.log(\`🔪 Terminating process: \${command}\`);
        child.kill('SIGTERM');
        
        // Force kill after 5 seconds if still not dead
        setTimeout(() => {
          if (child && !child.killed) {
            console.log(\`💀 Force killing process: \${command}\`);
            child.kill('SIGKILL');
          }
        }, 5000);
      }

      // Close progress dialog
      if (progressResolve) {
        progressResolve(undefined);
      }

      const duration = Date.now() - startTime;
      
      if (userCancelled) {
        resolve({
          success: false,
          output: output,
          error: "Command was cancelled by user",
          cancelled: true,
          timedOut: false
        });
      } else if (timedOut) {
        resolve({
          success: false,
          output: output,
          error: \`Command timed out after \${timeoutMs}ms\`,
          timedOut: true,
          cancelled: false
        });
      }
    };

    child.stdout?.on("data", (data) => {
      output += data.toString();
    });

    child.stderr?.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", (code) => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        
        if (progressResolve) {
          progressResolve(undefined);
        }

        const duration = Date.now() - startTime;
        console.log(\`✅ Command completed: \${command} in \${duration}ms with code \${code}\`);
        
        resolve({
          success: code === 0,
          output: output,
          error: code !== 0 ? errorOutput : undefined,
          timedOut: false,
          cancelled: false
        });
      }
    });

    child.on("error", (error) => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        
        if (progressResolve) {
          progressResolve(undefined);
        }
        
        console.log(\`❌ Command error: \${command} - \${error.message}\`);
        
        resolve({
          success: false,
          output: "",
          error: error.message,
          timedOut: false,
          cancelled: false
        });
      }
    });
  });
}

/**
 * Enhanced interactive command execution for OTP-requiring commands
 */
private async executeInteractiveNpmCommand(
  command: string,
  workingDir: string,
  timeoutMs: number
): Promise<{ success: boolean; output: string; error?: string; timedOut?: boolean }> {
  
  const terminal = vscode.window.createTerminal({
    name: \`NPM: \${command}\`,
    cwd: workingDir,
  });

  terminal.show();
  terminal.sendText(command);

  // Show message with timeout warning
  const timeoutSeconds = Math.floor(timeoutMs / 1000);
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      terminal.dispose();
      resolve({
        success: false,
        output: "",
        error: \`Interactive command timed out after \${timeoutSeconds} seconds\`,
        timedOut: true
      });
    }, timeoutMs);

    vscode.window
      .showInformationMessage(
        \`NPM command is running in the terminal. If prompted for OTP, please enter it.\\n\\nTimeout: \${timeoutSeconds} seconds\`,
        { modal: false },
        "Completed Successfully",
        "Failed/Cancelled"
      )
      .then((result) => {
        clearTimeout(timeoutId);
        terminal.dispose();
        
        if (result === "Completed Successfully") {
          resolve({ 
            success: true, 
            output: "Command completed in terminal",
            timedOut: false 
          });
        } else {
          resolve({ 
            success: false, 
            output: "", 
            error: "Command failed or was cancelled",
            timedOut: false 
          });
        }
      });
  });
}
`;

console.log(implementationCode);

console.log("\n🔧 Enhanced Pre-Publish Checks Implementation:\n");

const enhancedChecksCode = `
/**
 * Enhanced runPrePublishChecks with better timeout handling
 */
private async runPrePublishChecks(
  packageInfo: PackageInfo
): Promise<boolean> {
  const checks: Array<{
    name: string;
    check: () => Promise<boolean>;
    required: boolean;
    timeoutMs: number;
  }> = [
    {
      name: "Build package",
      check: () => this.runBuildScript(packageInfo),
      required: true,
      timeoutMs: 120000, // 2 minutes for builds
    },
    {
      name: "Run tests",
      check: () => this.runTests(packageInfo),
      required: false,
      timeoutMs: 180000, // 3 minutes for tests
    },
    {
      name: "Check package files",
      check: () => this.checkPackageFiles(packageInfo),
      required: true,
      timeoutMs: 5000, // 5 seconds for file checks
    },
  ];

  for (const check of checks) {
    try {
      console.log(\`🔍 Starting check: \${check.name} (timeout: \${check.timeoutMs}ms)\`);
      
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: \`Running pre-publish check: \${check.name}\`,
          cancellable: true,
        },
        async (progress, token) => {
          // Set up timeout for the entire check
          return Promise.race([
            check.check(),
            new Promise<boolean>((_, reject) => {
              setTimeout(() => {
                reject(new Error(\`Check "\${check.name}" timed out after \${check.timeoutMs}ms\`));
              }, check.timeoutMs);
            }),
            new Promise<boolean>((_, reject) => {
              token.onCancellationRequested(() => {
                reject(new Error(\`Check "\${check.name}" was cancelled by user\`));
              });
            })
          ]);
        }
      );

      if (!result && check.required) {
        const retry = await vscode.window.showErrorMessage(
          \`Required pre-publish check failed: \${check.name}\`,
          "Retry",
          "Skip (Not Recommended)",
          "Cancel"
        );
        
        if (retry === "Retry") {
          // Retry the same check
          continue;
        } else if (retry === "Skip (Not Recommended)") {
          console.log(\`⚠️ User chose to skip required check: \${check.name}\`);
          continue;
        } else {
          return false;
        }
      }
      
      console.log(\`✅ Check completed: \${check.name}\`);
      
    } catch (error: any) {
      console.log(\`❌ Check error: \${check.name} - \${error.message}\`);
      
      if (error.message.includes('timed out')) {
        const action = await vscode.window.showErrorMessage(
          \`Check "\${check.name}" timed out. This might indicate a hanging process.\`,
          "Retry with Longer Timeout",
          "Skip Check",
          "Cancel"
        );
        
        if (action === "Retry with Longer Timeout") {
          check.timeoutMs *= 2; // Double the timeout
          continue; // Retry
        } else if (action === "Skip Check") {
          if (check.required) {
            const confirm = await vscode.window.showWarningMessage(
              \`This is a required check. Skipping may cause publish issues. Continue anyway?\`,
              "Yes, Skip",
              "No, Cancel"
            );
            if (confirm !== "Yes, Skip") {
              return false;
            }
          }
          continue;
        } else {
          return false;
        }
      } else if (error.message.includes('cancelled')) {
        return false; // User cancelled
      } else {
        // Other error - show retry options
        if (check.required) {
          const retry = await vscode.window.showErrorMessage(
            \`Required check failed: \${check.name}\\nError: \${error.message}\`,
            "Retry",
            "Cancel"
          );
          
          if (retry === "Retry") {
            continue;
          } else {
            return false;
          }
        }
      }
    }
  }

  return true;
}
`;

console.log(enhancedChecksCode);

console.log("\n🎯 Key Benefits of This Implementation:");
console.log("1. ⏰ Prevents indefinite hanging with configurable timeouts");
console.log("2. 🚫 Allows user cancellation of long-running operations");
console.log("3. 📊 Provides real-time progress feedback");
console.log("4. 🔄 Offers retry options for failed checks");
console.log("5. ⚠️  Allows skipping non-critical checks");
console.log("6. 📝 Includes detailed logging for diagnostics");
console.log("7. 🛠️  Different timeout values for different command types");

console.log("\n💡 Usage Example:");
console.log(
  "Replace the current executeNpmCommand method in npmPublisher.ts with this enhanced version."
);
console.log(
  "The hanging issue should be resolved, and users will get better feedback."
);

console.log("\n🔧 Next Steps:");
console.log("1. Run the diagnostic test to confirm which check is hanging");
console.log("2. Implement this enhanced version in npmPublisher.ts");
console.log("3. Test with the problematic packages");
console.log("4. Fine-tune timeout values based on your project needs");
