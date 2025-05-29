/**
 * Comprehensive Fix Verification Test
 * Tests the complete authentication detection fix to ensure no regressions
 * and proper handling of both authentication and configuration-only scenarios
 */

const { NPMPublisher } = require("../../out/lib/npmPublisher");
const fs = require("fs");
const path = require("path");
const os = require("os");

class ComprehensiveFixVerification {
  constructor() {
    this.testResults = [];
    this.tempFiles = [];
  }

  log(message) {
    console.log(`[VERIFICATION] ${message}`);
  }

  createTempNpmrc(content, filename = ".npmrc") {
    const tempPath = path.join(os.tmpdir(), `test-${Date.now()}-${filename}`);
    fs.writeFileSync(tempPath, content);
    this.tempFiles.push(tempPath);
    return tempPath;
  }

  cleanup() {
    this.tempFiles.forEach((file) => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.warn(`Warning: Could not clean up temp file ${file}`);
      }
    });
  }

  async testScenario(name, testFunc) {
    this.log(`Testing: ${name}`);
    try {
      const result = await testFunc();
      this.testResults.push({ name, passed: true, result });
      this.log(`✅ PASSED: ${name}`);
      return result;
    } catch (error) {
      this.testResults.push({ name, passed: false, error: error.message });
      this.log(`❌ FAILED: ${name} - ${error.message}`);
      throw error;
    }
  }

  async runComprehensiveVerification() {
    this.log("Starting Comprehensive Fix Verification");

    try {
      // Test 1: Configuration-only .npmrc should NOT trigger auth detection
      await this.testScenario("Config-only .npmrc detection", async () => {
        const configContent = `
registry=https://registry.npmjs.org/
auto-install-peers = true
fund = false
audit-level = moderate
save-exact = true
`;
        const tempFile = this.createTempNpmrc(configContent);
        const publisher = new NPMPublisher();

        // Mock the file paths to use our temp file
        const originalHomedir = os.homedir;
        os.homedir = () => path.dirname(tempFile);

        try {
          const authCheck = await publisher.checkNpmAuth();
          if (authCheck.hasToken) {
            throw new Error(
              "Config-only .npmrc incorrectly detected as having auth token"
            );
          }
          return { hasToken: false, configOnly: true };
        } finally {
          os.homedir = originalHomedir;
        }
      });

      // Test 2: Valid auth token should be detected
      await this.testScenario("Valid auth token detection", async () => {
        const authContent = `
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=npm_1234567890abcdef
`;
        const tempFile = this.createTempNpmrc(authContent);
        const publisher = new NPMPublisher();

        const originalHomedir = os.homedir;
        os.homedir = () => path.dirname(tempFile);

        try {
          const authCheck = await publisher.checkNpmAuth();
          if (!authCheck.hasToken) {
            throw new Error("Valid auth token not detected");
          }
          return { hasToken: true, validAuth: true };
        } finally {
          os.homedir = originalHomedir;
        }
      });

      // Test 3: Mixed config and auth should detect auth
      await this.testScenario("Mixed config and auth detection", async () => {
        const mixedContent = `
registry=https://registry.npmjs.org/
auto-install-peers = true
//registry.npmjs.org/:_authToken=npm_test_token_here
fund = false
`;
        const tempFile = this.createTempNpmrc(mixedContent);
        const publisher = new NPMPublisher();

        const originalHomedir = os.homedir;
        os.homedir = () => path.dirname(tempFile);

        try {
          const authCheck = await publisher.checkNpmAuth();
          if (!authCheck.hasToken) {
            throw new Error("Auth token in mixed config not detected");
          }
          return { hasToken: true, mixedConfig: true };
        } finally {
          os.homedir = originalHomedir;
        }
      });

      // Test 4: Test containsAuthToken method directly
      await this.testScenario(
        "containsAuthToken method validation",
        async () => {
          const publisher = new NPMPublisher();

          const testCases = [
            { content: "auto-install-peers = true", expected: false },
            {
              content: "//registry.npmjs.org/:_authToken=test",
              expected: true,
            },
            { content: "_authToken=test", expected: true },
            { content: "authToken=test", expected: true },
            {
              content: "# This is just a comment about authToken",
              expected: false,
            },
            { content: "username=myuser\npassword=mypass", expected: false },
          ];

          for (const testCase of testCases) {
            const result = publisher.containsAuthToken(testCase.content);
            if (result !== testCase.expected) {
              throw new Error(
                `containsAuthToken failed for "${testCase.content}". Expected ${testCase.expected}, got ${result}`
              );
            }
          }

          return { methodValidation: true, testCases: testCases.length };
        }
      );

      // Test 5: No .npmrc file scenario
      await this.testScenario("No .npmrc file handling", async () => {
        const publisher = new NPMPublisher();

        // Mock fs.existsSync to return false for .npmrc files
        const originalExistsSync = fs.existsSync;
        fs.existsSync = (filePath) => {
          if (filePath.includes(".npmrc")) {
            return false;
          }
          return originalExistsSync(filePath);
        };

        try {
          const authCheck = await publisher.checkNpmAuth();
          if (authCheck.hasToken) {
            throw new Error("Non-existent .npmrc detected as having auth");
          }
          return { hasToken: false, noFile: true };
        } finally {
          fs.existsSync = originalExistsSync;
        }
      });

      // Test 6: Bug scenario that caused the original hanging issue
      await this.testScenario("Original bug scenario fix", async () => {
        const bugScenarioContent = `
registry=https://registry.npmjs.org/
auto-install-peers = true
fund = false
audit-level = moderate
save-exact = true
progress = false
`;
        const tempFile = this.createTempNpmrc(bugScenarioContent);
        const publisher = new NPMPublisher();

        const originalHomedir = os.homedir;
        os.homedir = () => path.dirname(tempFile);

        try {
          const authCheck = await publisher.checkNpmAuth();

          // This scenario should NOT have auth tokens
          if (authCheck.hasToken) {
            throw new Error(
              "Bug scenario still triggering false positive auth detection"
            );
          }

          // Verify the method returns the correct structure
          if (
            typeof authCheck !== "object" ||
            !authCheck.hasOwnProperty("hasToken")
          ) {
            throw new Error(
              "checkNpmAuth not returning expected object structure"
            );
          }

          return {
            hasToken: false,
            bugFixed: true,
            authCheckStructure: Object.keys(authCheck),
          };
        } finally {
          os.homedir = originalHomedir;
        }
      });

      this.generateReport();
    } catch (error) {
      this.log(`❌ Verification failed: ${error.message}`);
      this.generateReport();
      throw error;
    } finally {
      this.cleanup();
    }
  }

  generateReport() {
    this.log("\n" + "=".repeat(60));
    this.log("COMPREHENSIVE VERIFICATION REPORT");
    this.log("=".repeat(60));

    const passed = this.testResults.filter((r) => r.passed).length;
    const total = this.testResults.length;

    this.log(`Overall Result: ${passed}/${total} tests passed`);

    if (passed === total) {
      this.log("🎉 ALL TESTS PASSED - Fix is working correctly!");
    } else {
      this.log("⚠️  Some tests failed - please review the results below");
    }

    this.log("\nDetailed Results:");
    this.testResults.forEach((result) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      this.log(`${status}: ${result.name}`);
      if (!result.passed) {
        this.log(`   Error: ${result.error}`);
      } else if (result.result) {
        this.log(`   Result: ${JSON.stringify(result.result, null, 2)}`);
      }
    });

    this.log("\n" + "=".repeat(60));

    if (passed === total) {
      this.log(
        "✅ VERIFICATION COMPLETE: Authentication detection fix validated"
      );
      this.log("✅ No regressions detected");
      this.log("✅ Original hanging bug scenario resolved");
    }
  }
}

// Run the comprehensive verification
async function runVerification() {
  const verifier = new ComprehensiveFixVerification();
  try {
    await verifier.runComprehensiveVerification();
    console.log("\n🎉 Comprehensive verification completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Comprehensive verification failed:", error.message);
    process.exit(1);
  }
}

// Export for use in other tests or run directly
if (require.main === module) {
  runVerification();
}

module.exports = { ComprehensiveFixVerification };
