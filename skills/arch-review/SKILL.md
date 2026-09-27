---
name: arch-review
description: Evaluates system architecture, fitness functions, layer boundaries, and renders Mermaid diagrams.
---

# Architecture Review Skill

Use this skill when mapping architectural boundaries, reviewing fitness functions, or generating system diagrams.

## Guidelines

1. **Fitness Functions:**
   - Verify layer isolation (e.g. presentation must not bypass domain layer to access database directly).
   - Ensure clean interfaces between bounded contexts.

2. **Diagramming Standards:**
   - Use clean, standard GitHub Flavored Markdown Mermaid blocks.
   - Quote special characters in labels to prevent syntax rendering failures.
