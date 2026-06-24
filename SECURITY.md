# Security Policy

OpenLayer is local-first and is designed to talk to a ComfyUI server that the user runs on their own machine.

## Supported Versions

Only the latest alpha release is actively reviewed for security issues.

## Reporting A Vulnerability

Please report security issues privately through the project maintainer contact listed on the GitHub repository.

Do not publish exploit details publicly until the issue has been reviewed.

## Local Network Guidance

- Prefer running ComfyUI on `127.0.0.1`.
- Do not expose your ComfyUI server to the public internet unless you understand the risks.
- OpenLayer does not require cloud APIs or paid services.
- OpenLayer should never send images to external services as part of the core plugin.
