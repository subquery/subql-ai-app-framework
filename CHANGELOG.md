# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Changed
- Update init docker compose
- Stream Vector DB publishing to avoid loading into memory (#23)

### Added
- Support for loading vector db from local and http archives, this will extract to a temp dir (#23)

## [0.0.2] - 2024-10-30
### Fixed
- Lancedb path being url instead of file path for local files

[Unreleased]: https://github.com/subquery/subql-ai-app-framework"/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/subquery/subql-ai-app-framework"/releases/tag/v0.0.2
