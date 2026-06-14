---
stage: init
phase: diagnose
gate: diagnose
description: Scaffold a new topic on disk and create the audit file for the user to fill in.
---

The agent acts like a typical framework CLI here. It creates a physical folder for the new topic on disk and generates the starter files. The most important of these is the knowledge dump (e.g. `audit_template.md`). Before any "AI magic" happens, the user must open this file in their editor and manually write out what they already know, what they have a vague sense of, and what they don't understand at all.
