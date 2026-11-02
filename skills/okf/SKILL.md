---
name: okf
description: Guides the authoring, formatting, and validation of Open Knowledge Format (OKF) v0.2 concept bundles for repository intelligence.
---

# Open Knowledge Format (OKF) v0.2 Skill

This skill provides comprehensive instructions, formatting standards, and authoring rules for creating conformant **OKF v0.2 bundles** within Reponix.

---

## 1. Core Principles

1. **The LLM Writes, the CLI Guarantees:** Agents author concept bodies, frontmatter descriptions, and cross-links. Deterministic TypeScript in the Reponix CLI owns mechanical tasks: frontmatter validation, `index.md` generation, `log.md` appends, citation resolution, link checking, trust stamping, and staleness detection.
2. **Never Touch Reserved Files:** Agents must NEVER hand-write or modify `index.md` or `log.md`.
3. **Subtree Ownership:** Each agent owns exactly one subtree to prevent write conflicts:
   - `overview.md` &rarr; `reponix-orchestrator`
   - `inventory/` &rarr; `repo-analyst`
   - `architecture/` &rarr; `arch-mapper`
   - `contracts/` &rarr; `code-inspector`
   - `reconstruction/` &rarr; `modernizer`
   - `validation/` &rarr; `validator`
4. **Deterministic Slugs:** File paths must be deterministic kebab-case slugs derived from real code identifiers (e.g., `apis/post-orders.md`, `schemas/orders.md`, `components/inventory-service.md`).
5. **Granularity Rule:** One concept per endpoint, table, component, entity, rule, or migration phase. Do NOT create one file per function or class.

---

## 2. Concept Document Anatomy

Every concept document is a UTF-8 markdown file with YAML frontmatter:

```markdown
---
type: API Endpoint
title: POST /orders
description: Creates an order from a cart and reserves inventory.
resource: ../../../src/api/orders.controller.ts#L18-L64
tags: [orders, rest, write-path]
status: draft
generated: { by: reponix-code-inspector/example-model, at: 2026-10-24T09:12:00Z }
sources:
  - id: ctrl
    resource: ../../../src/api/orders.controller.ts#L18-L64
    title: OrdersController.create
  - id: svc
    resource: ../../../src/services/order.service.ts#L40-L97
    title: OrderService.placeOrder
reponix: { cli: 0.1.2, agent: code-inspector }
---

# Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `cartId` | string | yes | Must reference an open cart. |

# Behavior

Validates the cart, then reserves stock through the
[Inventory Service](/architecture/components/inventory-service.md).[^svc]
Persists to the [orders table](/contracts/schemas/orders.md).[^ctrl]

[^ctrl]: OrdersController.create
[^svc]: OrderService.placeOrder
```

---

## 3. Citations & Footnote Verification

- Every assertion of fact or behavior must cite a source using a markdown footnote reference `[^id]`.
- Every footnote reference `[^id]` must match a declared `sources[].id` in frontmatter.
- Every `sources[].id` must be cited in the body.
- `sources[].resource` must be a valid path relative to the repository or concept, and any line range `#Lstart-Lend` must fall within the file's line count.

---

## 4. Cross-Linking

- Use bundle-relative paths starting with `/`:
  - `[Orders Schema](/contracts/schemas/orders.md)`
  - `[Inventory Service](/architecture/components/inventory-service.md)`
- Avoid relative traversal (`../../...`) between bundle concepts.

---

## 5. CLI Toolchain

- **Validate Bundle:**
  ```bash
  npx reponix okf validate [dir] [--strict] [--format text|json|sarif]
  ```
- **Generate Index Files:**
  ```bash
  npx reponix okf index [dir]
  ```
- **Finalize Bundle (Cite &rarr; Links &rarr; Trust &rarr; Index &rarr; Log &rarr; Validate):**
  ```bash
  npx reponix okf finalize [dir]
  ```

---

## 6. Further References

- [OKF v0.2 Specification](./reference/SPEC.md)
- [Reponix OKF Profile](./reference/profile.md)
- [Concept Types & Schemas](./reference/types.md)
