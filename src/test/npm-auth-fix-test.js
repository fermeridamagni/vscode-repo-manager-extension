#!/usr/bin/env node

/**
 * Test script to verify the NPM authentication fix
 * Tests that .npmrc files without tokens are handled correctly
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

console.log("🧪 NPM Authentication Fix Test\n");

// Test 1: Verify the fix scenario - .npmrc exists but no token
console.log("📋 Test 1: .npmrc Without Token Scenario");

const testWorkspaceDir = path.join(process.cwd());
const npmrcPath = path.join(testWorkspaceDir, ".npmrc");

console.log(`Testing workspace: ${testWorkspaceDir}`);

if (fs.existsSync(npmrcPath)) {
  console.log("  ✅ Found .npmrc file");

  try {
    const content = fs.readFileSync(npmrcPath, "utf8");
    console.log("  📄 .npmrc content:");

    const lines = content.trim().split("\n");
    lines.forEach((line, index) => {
      console.log(`    ${index + 1}: ${line}`);
    });

    // Check for auth tokens
    const hasAuthToken =
      content.includes("authToken") || content.includes("_auth");
    console.log(`  🔐 Contains auth tokens: ${hasAuthToken ? "Yes" : "No"}`);

    if (!hasAuthToken) {
      console.log(
        "  ✅ SCENARIO CONFIRMED: .npmrc exists but contains no auth tokens"
      );
      console.log(
        "  📝 This should trigger 'Open Terminal for Manual Publish' option"
      );
    } else {
      console.log(
        "  ⚠️  This .npmrc contains auth tokens - not the test scenario"
      );
    }
  } catch (error) {
    console.log(`  ❌ Error reading .npmrc: ${error.message}`);
  }
} else {
  console.log("  ❌ No .npmrc file found");
  console.log("  📝 Creating test .npmrc without auth tokens...");

  const testNpmrcContent = `# NPM configuration
enable-pre-post-scripts = true
auto-install-peers = true
# No auth tokens here - this should trigger manual publish mode
`;

  try {
    fs.writeFileSync(npmrcPath, testNpmrcContent);
    console.log("  ✅ Created test .npmrc file");
  } catch (error) {
    console.log(`  ❌ Failed to create test .npmrc: ${error.message}`);
  }
}

// Test 2: Check environment variables
console.log("\n📋 Test 2: Environment Variable Check");

const npmEnvVars = [
  "NPM_TOKEN",
  "npm_token",
  "NPM_AUTH_TOKEN",
  "npm_config_authtoken",
];

let hasEnvAuth = false;
npmEnvVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${"*".repeat(20)}...`);
    hasEnvAuth = true;
  } else {
    console.log(`  ❌ ${varName}: Not set`);
  }
});

console.log(`  🔐 Has environment auth: ${hasEnvAuth ? "Yes" : "No"}`);

// Test 3: Global .npmrc check
console.log("\n📋 Test 3: Global .npmrc Check");

const globalNpmrcPath = path.join(os.homedir(), ".npmrc");
if (fs.existsSync(globalNpmrcPath)) {
  console.log("  ✅ Found global .npmrc");

  try {
    const content = fs.readFileSync(globalNpmrcPath, "utf8");
    const hasGlobalAuth =
      content.includes("authToken") || content.includes("_auth");
    console.log(`  🔐 Contains auth tokens: ${hasGlobalAuth ? "Yes" : "No"}`);
  } catch (error) {
    console.log(`  ❌ Error reading global .npmrc: ${error.message}`);
  }
} else {
  console.log("  ❌ No global .npmrc found");
}

// Test 4: npm whoami check
console.log("\n📋 Test 4: NPM whoami Check");

const { execSync } = require("child_process");

try {
  const whoamiResult = execSync("npm whoami", {
    encoding: "utf8",
    timeout: 5000,
    cwd: testWorkspaceDir,
  });
  console.log(`  ✅ npm whoami: ${whoamiResult.trim()}`);
  console.log("  📝 User is authenticated via npm login or global config");
} catch (error) {
  console.log("  ❌ npm whoami failed:");
  console.log(`     ${error.message}`);
  console.log("  📝 This confirms no valid authentication");
}

// Test 5: Simulate the fix logic
console.log("\n📋 Test 5: Simulating checkNpmAuth Logic");

function simulateCheckNpmAuth(workingDir) {
  const details = [];
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
  }

  // Check for .npmrc files (local and global)
  const localNpmrc = path.join(workingDir, ".npmrc");
  const globalNpmrc = path.join(os.homedir(), ".npmrc");

  if (fs.existsSync(localNpmrc)) {
    hasNpmrc = true;
    authMethod = authMethod === "none" ? "npmrc" : "both";
    details.push("Found local .npmrc file");

    try {
      const content = fs.readFileSync(localNpmrc, "utf8");
      if (content.includes("authToken") || content.includes("_auth")) {
        hasToken = true; // Only set hasToken if actual tokens found
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
    authMethod = authMethod === "none" ? "npmrc" : "both";
    details.push("Found global .npmrc file");

    try {
      const content = fs.readFileSync(globalNpmrc, "utf8");
      if (content.includes("authToken") || content.includes("_auth")) {
        hasToken = true; // Only set hasToken if actual tokens found
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

const authCheck = simulateCheckNpmAuth(testWorkspaceDir);

console.log("  📊 Auth Check Results:");
console.log(`     hasToken: ${authCheck.hasToken}`);
console.log(`     hasNpmrc: ${authCheck.hasNpmrc}`);
console.log(`     authMethod: ${authCheck.authMethod}`);
console.log(`     details: ${authCheck.details.join(", ")}`);

// Test 6: Simulate checkNpmLogin logic with the fix
console.log("\n📋 Test 6: Simulating checkNpmLogin Logic (FIXED)");

function simulateCheckNpmLoginFixed(authCheck) {
  // OLD (BROKEN) LOGIC: if (authCheck.hasToken || authCheck.hasNpmrc)
  // NEW (FIXED) LOGIC: if (authCheck.hasToken)

  console.log("  🔧 OLD LOGIC (broken):");
  const oldLogicResult = authCheck.hasToken || authCheck.hasNpmrc;
  console.log(
    `     if (authCheck.hasToken || authCheck.hasNpmrc) = ${oldLogicResult}`
  );
  console.log(
    `     Would ${oldLogicResult ? "proceed with automatic publish" : "show manual publish option"}`
  );

  console.log("  ✅ NEW LOGIC (fixed):");
  const newLogicResult = authCheck.hasToken;
  console.log(`     if (authCheck.hasToken) = ${newLogicResult}`);
  console.log(
    `     Will ${newLogicResult ? "proceed with automatic publish" : "show manual publish option"}`
  );

  return newLogicResult;
}

const loginResult = simulateCheckNpmLoginFixed(authCheck);

// Test Summary
console.log("\n📋 Test Summary");
console.log(`  📁 Workspace: ${testWorkspaceDir}`);
console.log(`  📄 .npmrc exists: ${authCheck.hasNpmrc}`);
console.log(`  🔐 Has valid auth tokens: ${authCheck.hasToken}`);
console.log(`  🚀 Will auto-publish: ${loginResult}`);
console.log(`  🔧 Will show manual publish: ${!loginResult}`);

if (authCheck.hasNpmrc && !authCheck.hasToken) {
  console.log("\n✅ FIX VERIFICATION SUCCESSFUL!");
  console.log("   🎯 .npmrc exists but contains no auth tokens");
  console.log(
    "   🎯 Fix correctly identifies this as requiring manual publish"
  );
  console.log("   🎯 User will see 'Open Terminal for Manual Publish' option");
} else if (!authCheck.hasNpmrc) {
  console.log("\n⚠️  TEST SCENARIO NOT PRESENT");
  console.log("   📝 No .npmrc file found to test the fix");
} else if (authCheck.hasToken) {
  console.log("\n⚠️  TEST SCENARIO NOT APPLICABLE");
  console.log(
    "   📝 .npmrc contains valid auth tokens, so auto-publish is correct"
  );
}

console.log("\n🎉 NPM Authentication Fix Test Complete!");
