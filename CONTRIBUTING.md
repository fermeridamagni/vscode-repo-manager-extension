# Contributing to VS Code Repo Manager Extension

Thank you for your interest in contributing to the VS Code Repo Manager Extension! This document provides guidelines and information for contributors.

## 🌟 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior include:

- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

### Enforcement

Project maintainers are responsible for clarifying the standards of acceptable behavior and are expected to take appropriate and fair corrective action in response to any instances of unacceptable behavior.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Package manager (recommended)
- **VS Code**: Latest version
- **Git**: For version control

### Development Setup

1. **Fork and Clone**

   ```bash
   git clone https://github.com/your-username/repo-manager.git
   cd repo-manager
   ```

2. **Install Dependencies**

   ```bash
   pnpm install
   ```

3. **Build the Extension**

   ```bash
   pnpm run build
   ```

4. **Run in Development Mode**

   ```bash
   pnpm run watch
   ```

5. **Test the Extension**
   - Press `F5` in VS Code to launch Extension Development Host
   - Test your changes in the new VS Code window

## 📋 Development Guidelines

### Code Style

We use **Prettier** and **ESLint** to maintain consistent code style:

```bash
# Format code
pnpm run format

# Check formatting
pnpm run format:check

# Lint code
pnpm run lint
```

### Code Quality Standards

- **TypeScript**: Use strict typing, avoid `any` types
- **Error Handling**: Always handle errors gracefully
- **Documentation**: Add JSDoc comments for public methods
- **Testing**: Include tests for new functionality
- **Performance**: Consider performance implications of changes

### File Structure

```text
src/
├── commands/          # VS Code command handlers
├── lib/              # Core functionality
│   ├── githubManager.ts    # GitHub operations
│   ├── npmPublisher.ts     # NPM publishing
│   └── packageManager.ts   # Package detection
├── providers/        # Tree data providers
├── test/            # Test files
└── extension.ts     # Main extension entry point
```

## 🔄 Contributing Workflow

### 1. Issue First

- Check existing issues before creating new ones
- For features, create a feature request issue first
- For bugs, provide detailed reproduction steps

### 2. Branch Naming

Use descriptive branch names:

```text
feature/add-npm-otp-support
fix/release-notes-formatting
docs/update-contributing-guide
```

### 3. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add OTP support for NPM publishing
fix: resolve release notes formatting issues
docs: update installation instructions
chore: update dependencies
```

### 4. Pull Request Process

1. **Update Documentation**: Update README.md if needed
2. **Add Tests**: Include tests for new functionality
3. **Check Quality**: Ensure all checks pass

```bash
   pnpm run format:check
   pnpm run lint
   pnpm run build
```

1. **Write Clear Description**: Explain what your PR does and why
2. **Link Issues**: Reference related issues in your PR description

### 5. PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Manual testing completed
- [ ] Automated tests added/updated
- [ ] All existing tests pass

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

## 🧪 Testing

### Manual Testing

1. **Package Detection**: Test with different project structures
2. **GitHub Releases**: Test release creation and formatting
3. **NPM Publishing**: Test with and without 2FA
4. **Error Handling**: Test error scenarios

### Test Projects

Use the included test monorepos:

- `e:\tmp\fixed-versioning-monorepo` - Fixed versioning test
- `e:\tmp\independent-versioning-monorepo` - Independent versioning test

### Testing Checklist

- [ ] Package discovery works in monorepos
- [ ] Release notes are properly formatted
- [ ] Changelog entries are correct
- [ ] NPM publishing handles OTP correctly
- [ ] Git commits are created properly
- [ ] Error messages are user-friendly

## 🐛 Bug Reports

When reporting bugs, include:

1. **VS Code Version**: Help → About
2. **Extension Version**: From Extensions panel
3. **Operating System**: Windows/macOS/Linux version
4. **Steps to Reproduce**: Detailed steps
5. **Expected Behavior**: What should happen
6. **Actual Behavior**: What actually happens
7. **Screenshots/Logs**: If applicable
8. **Sample Repository**: Link to reproduce the issue

## 💡 Feature Requests

For feature requests:

1. **Check Existing Issues**: Avoid duplicates
2. **Describe Use Case**: Explain the problem you're solving
3. **Proposed Solution**: How would you implement it?
4. **Alternatives**: What other solutions did you consider?
5. **Additional Context**: Screenshots, mockups, etc.

## 📝 Documentation

### Types of Documentation

- **Code Comments**: JSDoc for public APIs
- **README.md**: User-facing documentation
- **CHANGELOG.md**: Version history
- **This File**: Contributing guidelines

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code changes
- Use proper Markdown formatting

## 🔧 Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Run full test suite
4. Build extension package
5. Create GitHub release
6. Publish to VS Code Marketplace

## 🆘 Getting Help

### Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Code Review**: PR comments and suggestions

### Response Times

- **Bug Reports**: 48-72 hours
- **Feature Requests**: 1 week
- **Pull Requests**: 48-72 hours for initial review

## 🏆 Recognition

Contributors will be:

- Added to the CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Given credit in the extension's acknowledgments

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to the VS Code Repo Manager Extension!** 🎉

Your contributions help make package management better for the entire VS Code community.
