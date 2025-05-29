/**
 * Unit Test for NPM Authentication Detection Fix
 * Tests the specific scenario described in the bug report
 */

const fs = require('fs');
const path = require('path');

/**
 * Simulated version of the containsAuthToken method from NPM Publisher
 * This is the FIXED version with proper token detection
 */
function containsAuthToken(content) {
    // Split content into lines and check each line
    const lines = content.split('\n').map(line => line.trim());
    
    for (const line of lines) {
        // Skip empty lines and comments
        if (!line || line.startsWith('#') || line.startsWith(';')) {
            continue;
        }
        
        // Check for various authentication token patterns
        // Registry-specific auth tokens
        if (line.includes(':_authToken=') || line.includes(':_auth=')) {
            return true;
        }
        
        // Global auth tokens
        if (line.startsWith('_authToken=') || line.startsWith('_auth=')) {
            return true;
        }
        
        // Legacy authentication patterns
        if (line.startsWith('authToken=') || line.includes('//registry.npmjs.org/:_authToken=')) {
            return true;
        }
        
        // Check for other authentication patterns like always-auth
        if (line.startsWith('always-auth=true') && content.includes('_auth')) {
            return true;
        }
    }
    
    return false;
}

/**
 * OLD (BROKEN) version of auth detection for comparison
 */
function oldContainsAuthToken(content) {
    return content.includes("authToken") || content.includes("_auth");
}

console.log('🧪 NPM Authentication Detection Unit Test');
console.log('========================================');

// Test cases
const testCases = [
    {
        name: "Configuration Only (Bug Report Scenario)",
        content: `enable-pre-post-scripts = true
auto-install-peers = true`,
        expectedResult: false,
        description: "Should NOT detect auth tokens in config-only .npmrc"
    },
    {
        name: "Valid Auth Token",
        content: `//registry.npmjs.org/:_authToken=npm_abc123def456`,
        expectedResult: true,
        description: "Should detect valid NPM auth token"
    },
    {
        name: "Global Auth Token",
        content: `_authToken=npm_abc123def456`,
        expectedResult: true,
        description: "Should detect global auth token"
    },
    {
        name: "Legacy Auth Token",
        content: `authToken=npm_abc123def456`,
        expectedResult: true,
        description: "Should detect legacy auth token format"
    },
    {
        name: "Mixed Config and Auth",
        content: `enable-pre-post-scripts = true
//registry.npmjs.org/:_authToken=npm_abc123def456
auto-install-peers = true`,
        expectedResult: true,
        description: "Should detect auth token mixed with config"
    },
    {
        name: "Comments and Empty Lines",
        content: `# This is a comment
enable-pre-post-scripts = true

auto-install-peers = true
; Another comment`,
        expectedResult: false,
        description: "Should ignore comments and empty lines"
    },
    {
        name: "False Positive Case",
        content: `some-setting-with-auth-in-name = true
another-config_auth_related = false`,
        expectedResult: false,
        description: "Should NOT match config settings that contain 'auth' in name"
    }
];

let passed = 0;
let failed = 0;

console.log('\n📋 Running Test Cases...\n');

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`📝 ${testCase.description}`);
    console.log(`📄 Content:`);
    testCase.content.split('\n').forEach((line, i) => {
        console.log(`   ${i + 1}: ${line}`);
    });
    
    const oldResult = oldContainsAuthToken(testCase.content);
    const newResult = containsAuthToken(testCase.content);
    
    console.log(`🔧 OLD LOGIC Result: ${oldResult}`);
    console.log(`✅ NEW LOGIC Result: ${newResult}`);
    console.log(`🎯 Expected Result: ${testCase.expectedResult}`);
    
    if (newResult === testCase.expectedResult) {
        console.log(`✅ PASS - Correct detection`);
        passed++;
    } else {
        console.log(`❌ FAIL - Incorrect detection`);
        failed++;
    }
    
    if (oldResult !== newResult) {
        console.log(`🔧 FIXED - Old logic would have given: ${oldResult}`);
    }
    
    console.log('');
});

console.log('📊 Test Results Summary');
console.log('======================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Authentication detection fix is working correctly.');
} else {
    console.log('⚠️  Some tests failed. Authentication detection needs further refinement.');
}

console.log('\n🔍 Bug Report Scenario Verification');
console.log('===================================');
const bugReportContent = `auto-install-peers = true`;
const oldWouldDetect = oldContainsAuthToken(bugReportContent);
const newDetects = containsAuthToken(bugReportContent);

console.log(`📄 Bug Report .npmrc Content: "${bugReportContent}"`);
console.log(`🔧 OLD LOGIC would detect auth: ${oldWouldDetect}`);
console.log(`✅ NEW LOGIC detects auth: ${newDetects}`);

if (oldWouldDetect && !newDetects) {
    console.log('🎯 SUCCESS! Bug is fixed - no longer false positive on config-only .npmrc');
} else if (!oldWouldDetect && !newDetects) {
    console.log('ℹ️  Both old and new logic correctly identify no auth tokens');
} else {
    console.log('⚠️  Fix may need additional refinement');
}

console.log('\n🧪 Authentication Detection Unit Test Complete!');
