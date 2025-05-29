# Repo Manager VS Code Extension

A comprehensive VS Code extension for managing packages in repositories and monorepos. Provides tools for creating GitHub releases, publishing to NPM, and making conventional commits.

## Features

### 📦 Package Management

- **Auto-discovery**: Automatically detects packages in your workspace, including monorepo structures
- **Package Overview**: View package details, dependencies, and scripts in a convenient sidebar
- **Quick Access**: Open package.json files directly from the tree view

### 🚀 GitHub Releases

- **Automated Release Creation**: Create GitHub releases with automatic version bumping
- **Smart Version Suggestions**: Suggests patch, minor, major, and prerelease versions using semantic versioning
- **Release Notes Generation**: Auto-generates release notes from commit history
- **Git Integration**: Automatically creates and pushes git tags

### 📤 NPM Publishing

- **Streamlined Publishing**: Publish packages to NPM with built-in safety checks
- **Pre-publish Validation**: Runs build scripts and tests before publishing
- **Tag Support**: Publish with custom tags (latest, beta, alpha, next, or custom)
- **Access Control**: Configure public or restricted package access

### 💬 Conventional Commits

- **Interactive Commit Creation**: Guided workflow for creating conventional commits
- **Type Selection**: Choose from standard commit types (feat, fix, docs, etc.)
- **Scope Support**: Add optional scopes to your commits
- **Breaking Changes**: Special handling for breaking changes
- **Validation**: Ensures commits follow conventional commit standards

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Repo Manager"
4. Click Install

## Usage

### Accessing the Extension

The Repo Manager appears in the Explorer sidebar when you have packages in your workspace.

### Creating a GitHub Release

1. Right-click on a package in the Repo Manager view
2. Select "Create GitHub Release"
3. Choose the new version number
4. Enter release notes
5. Specify if it's a prerelease
6. The extension will update package.json, create a git tag, and publish the release

### Publishing to NPM

1. Right-click on a package in the Repo Manager view
2. Select "Publish to NPM"
3. Choose publication settings (tag, access level)
4. The extension will run pre-publish checks and publish the package

### Making Conventional Commits

1. Right-click on a package in the Repo Manager view
2. Select "Conventional Commit"
3. Select files to include
4. Choose commit type and add details
5. Review and confirm the commit

## Supported Project Structures

- **Single Package**: Standard npm package with package.json in root
- **Monorepos**: Supports packages in common locations:
  - `packages/`
  - `apps/`
  - `libs/`
  - `modules/`

## Requirements

- VS Code 1.100.0 or higher
- Git repository
- For GitHub features: GitHub authentication
- For NPM publishing: NPM account and login

## Extension Settings

This extension contributes the following settings:

- `repoManager.autoRefresh`: Automatically refresh package list when files change (default: true)

## Commands

- `Repo Manager: Refresh` - Manually refresh the package list
- `Repo Manager: Create GitHub Release` - Create a new GitHub release
- `Repo Manager: Publish to NPM` - Publish package to NPM
- `Repo Manager: Conventional Commit` - Create a conventional commit

## Known Issues

- GitHub authentication requires manual approval in VS Code
- NPM publishing requires npm login via terminal

## Release Notes

### 0.0.1

- Initial release
- Package discovery and management
- GitHub release creation
- NPM publishing
- Conventional commit support

## Contributing

Found a bug or have a feature request? Please create an issue on GitHub.

## License

This extension is released under the MIT License.
