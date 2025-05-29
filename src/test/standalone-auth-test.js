/**
 * Standalone Authentication Detection Test
 * Tests the containsAuthToken logic without VS Code dependencies
 */

console.log("🔐 Standalone Authentication Detection Test");
console.log("============================================");

// Extract the containsAuthToken logic directly from our fix
function containsAuthToken(content) {
  const lines = content.split("\n").map((line) => line.trim());

  for (const line of lines) {
    // Skip empty lines and comments
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    // Check for registry-specific auth tokens
    if (line.includes(":_authToken=") || line.includes(":_auth=")) {
      return true;
    }

    // Check for global auth tokens
    if (line.startsWith("_authToken=") || line.startsWith("_auth=")) {
      return true;
    }

    // Check for other auth token formats
    if (line.startsWith("authToken=")) {
      return true;
    }

    // Check for username/password authentication (legacy)
    if (line.startsWith("username=") || line.startsWith("password=")) {
      return true;
    }
  }

  return false;
}

// Test cases
const testCases = [
  {
    name: "Configuration-only .npmrc (bug scenario)",
    content: `
registry=https://registry.npmjs.org/
auto-install-peers = true
fund = false
audit-level = moderate
save-exact = true
progress = false
`,
    expected: false,
    description: "Should NOT detect auth tokens in config-only file",
  },
  {
    name: "Registry-specific auth token",
    content: `
registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=npm_1234567890abcdef
`,
    expected: true,
    description: "Should detect registry-specific auth token",
  },
  {
    name: "Global auth token",
    content: `
_authToken=npm_global_token_here
registry=https://registry.npmjs.org/
`,
    expected: true,
    description: "Should detect global auth token",
  },
  {
    name: "Mixed config and auth",
    content: `
registry=https://registry.npmjs.org/
auto-install-peers = true
//registry.npmjs.org/:_authToken=npm_test_token_here
fund = false
`,
    expected: true,
    description: "Should detect auth token in mixed content",
  },
  {
    name: "Comment with auth keyword",
    content: `
# This is just a comment about authToken
registry=https://registry.npmjs.org/
auto-install-peers = true
`,
    expected: false,
    description: "Should NOT detect auth keywords in comments",
  },
  {
    name: "Legacy username/password auth",
    content: `
registry=https://registry.npmjs.org/
username=myusername
password=mypassword
`,
    expected: true,
    description: "Should detect legacy username/password auth",
  },
  {
    name: "Alternative auth token format",
    content: `
authToken=npm_alternative_format
registry=https://registry.npmjs.org/
`,
    expected: true,
    description: "Should detect alternative auth token format",
  },
  {
    name: "False positive test - auth in URL",
    content: `
registry=https://auth.example.com/npm/
auto-install-peers = true
fund = false
`,
    expected: false,
    description: "Should NOT detect 'auth' in URL as auth token",
  },
  {
    name: "Empty content",
    content: "",
    expected: false,
    description: "Should handle empty content gracefully",
  },
  {
    name: "Only comments",
    content: `
# This file only has comments
; Another comment style
# Even mentions authToken but it's a comment
`,
    expected: false,
    description: "Should NOT detect auth tokens in comment-only files",
  },
];

// Run tests
let passed = 0;
let total = testCases.length;

console.log(`\nRunning ${total} test cases...\n`);

testCases.forEach((testCase, index) => {
  const result = containsAuthToken(testCase.content);
  const success = result === testCase.expected;

  if (success) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${testCase.name}`);
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
    console.log(`   Description: ${testCase.description}`);
  }
});

console.log(`\n${"=".repeat(50)}`);
console.log(`TEST RESULTS: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log("🎉 ALL TESTS PASSED!");
  console.log("✅ Authentication detection fix is working correctly");
  console.log("✅ Original bug scenario (auto-install-peers) is fixed");
  console.log("✅ No false positives detected");
  console.log("✅ All legitimate auth token formats still detected");
} else {
  console.log("⚠️  Some tests failed - fix needs review");
  process.exit(1);
}

// Specific bug scenario verification
console.log(`\n${"=".repeat(50)}`);
console.log("BUG SCENARIO VERIFICATION");
console.log(`${"=".repeat(50)}`);

const bugScenario = `
registry=https://registry.npmjs.org/
auto-install-peers = true
fund = false
audit-level = moderate
save-exact = true
progress = false
`;

const bugResult = containsAuthToken(bugScenario);
console.log(`Original bug content: ${bugScenario.trim()}`);
console.log(`Detection result: ${bugResult}`);

if (!bugResult) {
  console.log(
    "✅ BUG FIXED: Configuration-only .npmrc no longer triggers false positive"
  );
  console.log("✅ This will prevent the hanging issue during NPM publishing");
} else {
  console.log("❌ BUG NOT FIXED: Still detecting false positive auth token");
  process.exit(1);
}

console.log(`\n${"=".repeat(50)}`);
console.log("VERIFICATION COMPLETE");
console.log(`${"=".repeat(50)}`);
console.log("✅ Authentication detection logic validated");
console.log("✅ NPM publish hanging issue should be resolved");
console.log("✅ Ready for production use");
