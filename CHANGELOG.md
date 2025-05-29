# Changelog

All notable changes to the "repo-manager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2025-05-29

### Fixed

#### NPM Publishing OTP (One-Time Password) Handling

**Problem Fixed**: The extension was failing to handle NPM's OTP requirements properly, causing publish failures with unclear error messages when users had 2FA enabled.

**Root Cause**: The original logic incorrectly assumed that having an auth token meant OTP would not be required: `const mightRequireOTP = !authCheck.hasToken`. This was wrong - NPM can require OTP regardless of authentication method if 2FA is enabled on the user's account.

**Solution Implemented**:

- **Fixed OTP Detection Logic**: Removed the flawed assumption about token authentication bypassing OTP and added proper 2FA-aware logic that assumes OTP might always be required

- **Enhanced User Experience**:
  - Before: Auto-publish → EOTP error → Generic error message
  - After: Shows OTP warning with three options ("Continue with Auto Publish", "Use Terminal for Manual Publish", "Cancel") → If auto-publish fails with EOTP → Automatic terminal fallback → Clear instructions for OTP entry

- **Improved Error Handling**: Graceful cancellation (no more thrown errors when user cancels), automatic fallback (EOTP errors now trigger terminal option instead of failure), and better messaging with clear explanations of what OTP is and why it's needed

**Key Benefits**:

- ✅ No more cryptic EOTP errors
- ✅ Upfront choice between auto and manual publish
- ✅ Automatic fallback when OTP is required
- ✅ Graceful cancellation without throwing errors
- ✅ Works with all auth methods (tokens, login, etc.)
- ✅ Clear user guidance throughout the process

### Enhanced

#### Complete Extension Enhancement Package

**Major Improvements**:

1. **Enhanced NPM Publishing with OTP Support**

   - Environment Variable Detection: Checks for NPM_TOKEN, npm_token, NPM_AUTH_TOKEN, npm_config_authtoken
   - Multi-level .npmrc Support: Scans both local and global .npmrc files for authentication
   - Proper OTP Handling: Interactive terminal for OTP input with user-friendly prompts
   - Better Error Messages: Detailed error parsing for EOTP, ENEEDAUTH, E403, ENOTFOUND
   - Authentication Methods: Multiple login options (interactive, token, manual setup)
   - Real Exit Code Handling: Proper process monitoring for build/test scripts

2. **Code Quality & Formatting**

   - Prettier Integration: Added Prettier with comprehensive configuration
   - Format on Save: VS Code settings for automatic formatting
   - Format Scripts: `pnpm run format` and `pnpm run format:check` commands
   - CI/CD Integration: Format checking included in package build process

3. **Improved Development Workflow**

   - Build Pipeline: Enhanced with formatting → type checking → linting → building
   - Watch Mode: Separate watch tasks for ESBuild and TypeScript
   - VS Code Integration: Proper settings for Prettier, ESLint, and TypeScript
   - Output Channels: Better debugging with output capture and display

4. **Original Issues Fixed**

   - Release Notes Formatting: Updated methods to properly add empty lines between sections and format output correctly
   - CHANGELOG.md Content: Enhanced method to properly filter and map emoji labels to Keep a Changelog sections
   - Duplicate "Changed" Headings: Improved changelog entry format to include package names for scoped packages
   - URL Encoding Issues: Removed unnecessary encodeURIComponent for scoped package tag URLs
   - Missing Git Commits: Implemented commitVersionChanges() method to automatically commit package.json and CHANGELOG.md updates before creating release tags

**Technical Implementation**:

- File Changes: Enhanced `src/lib/githubManager.ts`, `src/lib/npmPublisher.ts`, added Prettier configuration
- Key Methods: Added `checkNpmAuth()`, `executeNpmCommand()`, `commitVersionChanges()`, enhanced `organizeReleaseNotesForChangelog()`
- Quality Assurance: All TypeScript compilation passes, ESLint linting passes, Prettier formatting applied consistently

**Test Results**:

- ✅ NPM Authentication: Global .npmrc detected with auth tokens, user authenticated as "fermeridamagni"
- ✅ Workspace Analysis: Both fixed and independent versioning monorepos ready with 2 packages each
- ✅ Code Quality: No compilation or runtime errors, comprehensive error handling implemented

**Production Ready Status**:

- Core Functionality: GitHub release creation, NPM publishing with OTP/2FA support, conventional commit integration, monorepo support
- Quality Assurance: Comprehensive error handling, user-friendly prompts, proper git integration
- Developer Experience: VS Code integration, watch mode for development, Prettier formatting on save

## [0.0.1] - 2025-05-28

### Added

- Initial release of Repo Manager extension
- Package discovery and tree view in Explorer sidebar
- GitHub release creation with automatic version bumping
- NPM publishing with pre-publish validation
- Conventional commit creation with interactive wizard
- Support for monorepo structures (packages/, apps/, libs/, modules/)
- Package details viewer with dependencies and scripts
- Automatic git tag creation and pushing
- Integration with VS Code's GitHub authentication

### Features

- Auto-discovery of packages in workspace
- Smart version suggestions using semantic versioning
- Interactive commit type selection with emojis
- Release notes generation from commit history
- Pre-publish safety checks (build, test, package validation)
- Support for npm publish tags (latest, beta, alpha, next, custom)
- Breaking change detection and handling
- Package access control (public/restricted)

### Technical

- Built with TypeScript and esbuild
- Uses @octokit/rest for GitHub API integration
- Uses simple-git for Git operations
- Uses semver for version management
- Comprehensive error handling and user feedback
