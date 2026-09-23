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

## Permission Notes

OpenLayer's Photoshop UXP manifest currently requests local filesystem access and network access.

- Local filesystem access is used for temporary files and Photoshop import tokens, and — only after you
  confirm a download on the Setup screen — to write a model file into the ComfyUI models folder you chose.
- Network access is used to talk to the ComfyUI server selected by the user, normally `127.0.0.1`.
- It is also used by the Setup screen's **Download** button, which fetches a model file from the URL the
  preset registry pins (Hugging Face) after a confirmation naming the size, folder and host. Nothing is
  downloaded without that click, and licence-gated files are never downloaded at all.
- When you turn on the **Agent Bridge** (off by default), the panel connects to a WebSocket hub on
  `127.0.0.1:8199` that you start yourself from the repository. The hub accepts loopback connections only,
  but it has **no authentication token yet**: while it is running, any program on your own machine can
  connect to it and ask the panel to run a tool. Leave the bridge off when you are not using it.
- Settings diagnostics and Copy Diagnostics are local only. OpenLayer does not upload diagnostics automatically.
