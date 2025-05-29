#!/usr/bin/env node

/**
 * NPM Publishing Hang Diagnostic Test
 *
 * This test helps identify which pre-publish check is causing the hanging issue.
 * It simulates the pre-publish check process with timeouts to isolate the problem.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🔍 NPM Publishing Hang Diagnostic Test\n");

// Configuration
const TIMEOUT_MS = 30000; // 30 seconds timeout
const TEST_PACKAGES = [
  // Add your package paths here
  ".", // Current directory as example
];

/**
 * Executes a command with timeout protection
 */
function executeCommandWithTimeout(
  command,
  workingDir,
  timeoutMs = TIMEOUT_MS
) {
  return new Promise((resolve) => {
    console.log(`   ⏱️  Starting: ${command} (timeout: ${timeoutMs / 1000}s)`);
    const startTime = Date.now();

    const child = spawn("npm", command.split(" ").slice(1), {
      cwd: workingDir,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let output = "";
    let errorOutput = "";
    let completed = false;
    let timeoutId;

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!completed) {
        console.log(
          `   🚨 TIMEOUT: Command "${command}" exceeded ${timeoutMs / 1000}s`
        );
        child.kill("SIGTERM");

        // Force kill after 5 seconds if still not dead
        setTimeout(() => {
          if (!completed) {
            console.log(`   💀 FORCE KILL: ${command}`);
            child.kill("SIGKILL");
          }
        }, 5000);

        completed = true;
        resolve({
          success: false,
          output: output,
          error: `Command timed out after ${timeoutMs / 1000}s`,
          duration: Date.now() - startTime,
          timedOut: true,
        });
      }
    }, timeoutMs);

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
        const duration = Date.now() - startTime;
        console.log(`   ✅ Completed in ${duration}ms with exit code: ${code}`);
        resolve({
          success: code === 0,
          output: output,
          error: code !== 0 ? errorOutput : undefined,
          duration: duration,
          timedOut: false,
        });
      }
    });

    child.on("error", (error) => {
      if (!completed) {
        completed = true;
        clearTimeout(timeoutId);
        console.log(`   ❌ Error: ${error.message}`);
        resolve({
          success: false,
          output: "",
          error: error.message,
          duration: Date.now() - startTime,
          timedOut: false,
        });
      }
    });
  });
}

/**
 * Simulates the pre-publish checks with diagnostics
 */
async function runDiagnosticChecks(packagePath) {
  console.log(`\n📦 Testing package: ${packagePath}`);

  // Check if package.json exists
  const packageJsonPath = path.join(packagePath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`   ❌ No package.json found in ${packagePath}`);
    return;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    console.log(`   📋 Package: ${packageJson.name}@${packageJson.version}`);
  } catch (error) {
    console.log(`   ❌ Error reading package.json: ${error.message}`);
    return;
  }

  const results = {
    build: null,
    test: null,
    fileCheck: null,
  };

  // Check 1: Build script
  console.log(`\n🔨 Check 1: Build Script`);
  if (packageJson.scripts?.build) {
    console.log(`   📝 Found build script: ${packageJson.scripts.build}`);
    results.build = await executeCommandWithTimeout(
      "npm run build",
      packagePath
    );

    if (results.build.timedOut) {
      console.log(`   🚨 BUILD SCRIPT HANGS! This is likely the culprit.`);
      console.log(
        `   💡 Suggestion: Check your build script for infinite loops or processes waiting for input`
      );
    } else if (!results.build.success) {
      console.log(
        `   ⚠️  Build failed but didn't hang (duration: ${results.build.duration}ms)`
      );
    } else {
      console.log(
        `   ✅ Build completed successfully (duration: ${results.build.duration}ms)`
      );
    }
  } else {
    console.log(`   ⏭️  No build script found - skipping`);
    results.build = { success: true, skipped: true };
  }

  // Check 2: Test script
  console.log(`\n🧪 Check 2: Test Script`);
  if (packageJson.scripts?.test) {
    console.log(`   📝 Found test script: ${packageJson.scripts.test}`);
    results.test = await executeCommandWithTimeout("npm test", packagePath);

    if (results.test.timedOut) {
      console.log(`   🚨 TEST SCRIPT HANGS! This is likely the culprit.`);
      console.log(
        `   💡 Suggestion: Check your test script for infinite loops or tests waiting for input`
      );
    } else if (!results.test.success) {
      console.log(
        `   ⚠️  Tests failed but didn't hang (duration: ${results.test.duration}ms)`
      );
    } else {
      console.log(
        `   ✅ Tests completed successfully (duration: ${results.test.duration}ms)`
      );
    }
  } else {
    console.log(`   ⏭️  No test script found - skipping`);
    results.test = { success: true, skipped: true };
  }

  // Check 3: File existence (this shouldn't hang)
  console.log(`\n📁 Check 3: Essential Files`);
  const essentialFiles = ["package.json"];
  let allFilesExist = true;

  for (const file of essentialFiles) {
    const filePath = path.join(packagePath, file);
    if (fs.existsSync(filePath)) {
      console.log(`   ✅ ${file} exists`);
    } else {
      console.log(`   ❌ ${file} missing`);
      allFilesExist = false;
    }
  }

  results.fileCheck = { success: allFilesExist, duration: 0 };

  return results;
}

/**
 * Main diagnostic function
 */
async function runDiagnostics() {
  console.log("🎯 Purpose: Identify which pre-publish check causes hanging");
  console.log(
    "📊 This test simulates the exact checks that run before NPM publishing\n"
  );

  const allResults = [];

  for (const packagePath of TEST_PACKAGES) {
    const results = await runDiagnosticChecks(packagePath);
    if (results) {
      allResults.push({ packagePath, results });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DIAGNOSTIC SUMMARY");
  console.log("=".repeat(60));

  const hangingChecks = [];

  allResults.forEach(({ packagePath, results }) => {
    console.log(`\n📦 ${packagePath}:`);

    Object.entries(results).forEach(([checkName, result]) => {
      if (result.skipped) {
        console.log(`   ⏭️  ${checkName}: Skipped (no script)`);
      } else if (result.timedOut) {
        console.log(
          `   🚨 ${checkName}: HANGS! (timed out after ${TIMEOUT_MS / 1000}s)`
        );
        hangingChecks.push({ packagePath, checkName });
      } else if (result.success) {
        console.log(`   ✅ ${checkName}: OK (${result.duration}ms)`);
      } else {
        console.log(`   ❌ ${checkName}: Failed (${result.duration}ms)`);
      }
    });
  });

  if (hangingChecks.length > 0) {
    console.log(`\n🔥 HANGING ISSUES FOUND:`);
    hangingChecks.forEach(({ packagePath, checkName }) => {
      console.log(`   🚨 ${packagePath} → ${checkName} check hangs`);
    });

    console.log(`\n💡 RECOMMENDED FIXES:`);
    console.log(`1. Add timeouts to executeNpmCommand() method`);
    console.log(`2. Check the hanging scripts for:`);
    console.log(`   - Infinite loops`);
    console.log(`   - Processes waiting for user input`);
    console.log(`   - Network requests that don't timeout`);
    console.log(`   - File watchers that don't exit`);
    console.log(
      `3. Consider making failing checks non-blocking with user choice`
    );
  } else {
    console.log(`\n✅ No hanging issues detected in the test environment`);
    console.log(
      `💭 The hang might be environment-specific or triggered by specific conditions`
    );
  }

  console.log("\n🔧 Next Steps:");
  console.log("1. Run this test on the actual packages that hang");
  console.log("2. Implement timeout protection in npmPublisher.ts");
  console.log("3. Add better progress feedback and cancellation options");
}

// Run the diagnostics
runDiagnostics().catch((error) => {
  console.error("❌ Diagnostic test failed:", error);
  process.exit(1);
});
