# Changelog

All notable changes to the "repo-manager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
