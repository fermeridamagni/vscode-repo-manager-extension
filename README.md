# VS Code Repo Manager Extension

A comprehensive VS Code extension for managing packages in repositories and monorepos with enhanced release management and NPM publishing capabilities.

## 🎯 Project Status: Production Ready ✅

All formatting issues have been resolved and significant enhancements have been added for professional-grade package management.

## 🚀 Core Features

### 📦 Package Management

- **Auto-discovery**: Automatically detects packages in workspaces and monorepos
- **Package Overview**: View package details, dependencies, and scripts
- **Monorepo Support**: Both fixed and independent versioning strategies

### 🔄 GitHub Releases

- **Automated Release Creation**: Create releases with proper version bumping
- **Enhanced Release Notes**: Properly formatted multi-line release notes
- **Smart Changelog**: Organized changelog with package-specific sections
- **Git Integration**: Automatic commits for package.json and CHANGELOG.md updates

### 📤 NPM Publishing

- **Enhanced Authentication**: Environment variable and .npmrc detection
- **OTP Support**: Interactive 2FA/OTP handling for secure publishing
- **Multi-auth Methods**: Token-based, interactive, and manual authentication
- **Error Handling**: Comprehensive error messages for common NPM issues

### 💬 Conventional Commits

- **Interactive Commit Creation**: Guided conventional commit workflow
- **Standard Types**: Support for feat, fix, docs, chore, and more
- **Scope Support**: Optional scopes for better commit organization

## 🛠️ Recent Enhancements

### ✅ Fixed Issues

- **Release Notes Formatting**: Proper multi-line formatting with section breaks
- **Changelog Content**: Real changes displayed instead of placeholders
- **URL Encoding**: Fixed scoped package URLs for GitHub links
- **Git Commits**: Automatic commits for version and changelog updates
- **Duplicate Headers**: Eliminated duplicate "Changed" sections

### 🔧 New Features

- **NPM OTP Support**: Interactive terminal for 2FA codes
- **Environment Detection**: Automatic NPM token discovery
- **Prettier Integration**: Code formatting with consistent style
- **Enhanced Error Messages**: User-friendly NPM publishing feedback

## 📦 Installation

### From VSIX Package

1. Download `vscode-repo-manager-extension-0.0.1.vsix`
2. Open VS Code Command Palette (`Ctrl+Shift+P`)
3. Run "Extensions: Install from VSIX..."
4. Select the downloaded .vsix file

### Development Setup

```bash
git clone <repository-url>
cd repo-manager
pnpm install
pnpm run build
```

## 🎯 Usage

### Quick Start

1. Open a repository with package.json files
2. Find "Repo Manager" in the Explorer sidebar
3. Right-click packages for release and publishing options

### Creating GitHub Releases

1. Right-click package → "Create GitHub Release"
2. Select version type (patch/minor/major/prerelease)
3. Review generated release notes
4. Confirm to create release and push tags

### NPM Publishing

1. Right-click package → "Publish to NPM"
2. Choose tag (latest, beta, alpha, etc.)
3. Enter OTP when prompted (if 2FA enabled)
4. Monitor publishing progress in output panel

## 🔧 Development

### Code Quality

- **Prettier**: Automatic code formatting
- **ESLint**: Code linting and standards
- **TypeScript**: Full type safety

### Scripts

```bash
pnpm run format        # Format all code
pnpm run format:check  # Check formatting
pnpm run lint         # Run ESLint
pnpm run build        # Build extension
pnpm run watch        # Development mode
```

## 📋 Requirements

- **VS Code**: Version 1.100.0 or higher
- **Node.js**: For NPM operations
- **Git**: For version control operations
- **GitHub Account**: For creating releases
- **NPM Account**: For publishing packages

## 🎯 Supported Project Structures

### Single Package

- Standard npm package with package.json in root

### Monorepos

Supports packages in common locations:

- `packages/`
- `apps/`
- `libs/`
- `tools/`

### Versioning Strategies

- **Fixed Versioning**: All packages share the same version
- **Independent Versioning**: Each package has its own version

## ⚙️ Configuration

The extension works out of the box but can be configured via VS Code settings:

- **GitHub Integration**: Requires GitHub authentication
- **NPM Publishing**: Supports multiple authentication methods
- **Conventional Commits**: Customizable commit types and scopes

## 🔧 Commands

- `Repo Manager: Create GitHub Release` - Create a new GitHub release
- `Repo Manager: Publish to NPM` - Publish package to NPM
- `Repo Manager: Conventional Commit` - Create a conventional commit
- `Repo Manager: Refresh` - Refresh package detection

## 🐛 Troubleshooting

### NPM Publishing Issues

- **OTP Required**: Extension will prompt for 2FA code
- **Authentication**: Check .npmrc or environment variables
- **Network Issues**: Verify NPM registry connectivity

### GitHub Release Issues

- **Authentication**: Ensure GitHub token is configured
- **Repository Access**: Verify push permissions
- **Git Status**: Ensure working directory is clean

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## 📈 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes.

---

**Made with ❤️ for the VS Code community** 3. Choose the new version number 4. Enter release notes 5. Specify if it's a prerelease 6. The extension will update package.json, create a git tag, and publish the release

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
