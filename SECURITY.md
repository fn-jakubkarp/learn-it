# Security Policy

## Supported Versions

Please ensure you are using the latest version of `learn-it`.

| Version | Supported          |
| ------- | ------------------ |
| Main    | :white_check_mark: |
| 0.1.0   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within `learn-it`, please do not disclose it publicly.

Instead, please report it privately by sending an email to **lirinlabs@gmail.com**.

**Please include the following information in your report:**
- Type of issue (e.g., prompt injection, command injection, path traversal)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit)
- Step-by-step instructions to reproduce the issue
- Proof of concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Scope

`learn-it` is a CLI-based learning engine that runs locally using Bun and SQLite. 
Vulnerabilities of particular interest include:
- **Command Injection:** Execution of arbitrary commands on the host system.
- **Path Traversal / Arbitrary File Read/Write:** Unauthorized access to files outside the intended project/data directories.
- **Prompt Injection:** If LLM features can be manipulated to compromise the host system.

We will try to acknowledge receipt of your vulnerability report promptly and provide regular updates on our progress in addressing it.
