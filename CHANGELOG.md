# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.7] - 2025-01-29
### Added
- `embed-web` function to generate embeddings from a website (#32)

## [0.0.6] - 2025-01-29
### Changed
- Add support for OpenAI LLMs (#29)

## [0.0.5] - 2024-11-06
### Fixed
- init command failing (#26)
- repl command requiring OPENAI_API_KEY env var (#26)

## [0.0.4] - 2024-11-06
### Fixed
- RagTool parameters naming missmatch (#25)

### Changed
- Docker: Exclude submodule, remove default project argument (#25)

## [0.0.3] - 2024-11-05
### Changed
- Update init docker compose
- Stream Vector DB publishing to avoid loading into memory (#23)

### Added
- Support for loading vector db from local and http archives, this will extract
  to a temp dir (#23)

## [0.0.2] - 2024-10-30
### Fixed
- Lancedb path being url instead of file path for local files

[Unreleased]: https://github.com/subquery/subql-ai-app-framework/compare/v0.0.7...HEAD
[0.0.7]: https://github.com/subquery/subql-ai-app-framework/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/subquery/subql-ai-app-framework/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/subquery/subql-ai-app-framework"/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/subquery/subql-ai-app-framework"/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/subquery/subql-ai-app-framework"/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/subquery/subql-ai-app-framework"/releases/tag/v0.0.2
