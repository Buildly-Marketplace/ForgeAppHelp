# Buildly AI Engineering Standard

> **Version:** 1.0  
> **Effective Date:** 2026-03-17  
> **Scope:** All Buildly repositories and AI-assisted development

---

## Executive Summary

This standard defines how AI tools are used in Buildly software development. The goal is to **accelerate development** while ensuring **human understanding**, **traceability**, and **code quality**.

**Core Philosophy:**
> **The AI handles the boring parts. The engineer owns understanding and originality.**

---

## 1. Principles

### 1.1 AI as Assistant, Not Author

AI tools are assistants that help engineers work faster. They are not autonomous agents that produce final code. Every line of code merged into production must be understood by a human engineer who takes responsibility for it.

### 1.2 Traceability Always

Every code change must be traceable to a work item:
- Buildly Labs feature
- GitHub issue
- Punchlist item

This ensures product requirements flow through to implementation and changes are never orphaned.

### 1.3 Small, Focused Changes

AI should produce minimal, targeted changes. Large refactors and rewrites require explicit approval and careful human review. The smaller the diff, the easier it is to understand and review.

### 1.4 Human Accountability

The engineer who submits a PR is accountable for all code in that PR, regardless of whether AI generated it. "The AI wrote it" is not an excuse for bugs, security issues, or poor quality.

---

## 2. AI Responsibilities

AI tools are appropriate for:

| Task | Examples |
|------|----------|
| **Scaffolding** | Project setup, file templates, boilerplate |
| **Repetitive Code** | CRUD operations, standard patterns |
| **Test Generation** | Unit tests, test data, edge cases |
| **Documentation** | Docstrings, README sections, comments |
| **Refactoring** | Rename variables, extract functions, format |
| **Translation** | Port patterns between languages/frameworks |

---

## 3. Human Responsibilities

Humans must own:

| Task | Rationale |
|------|-----------|
| **Architecture** | Long-term impact requires human judgment |
| **Business Logic** | Domain knowledge and product context |
| **Security** | Authentication, authorization, encryption |
| **Integrations** | Third-party APIs, external services |
| **Creative Solutions** | Novel problems need novel thinking |
| **Final Review** | Verification that code is correct |

---

## 4. Required Artifacts

### 4.1 For Every Change

| Artifact | Required | Description |
|----------|----------|-------------|
| Work Item ID | ✅ | Labs feature, issue, or punchlist link |
| Summary | ✅ | What was done and why |
| AI Disclosure | ✅ | What AI helped with |
| Human Confirmation | ✅ | Engineer confirms understanding |
| Tests | ✅ | Appropriate test coverage |
| Documentation | If needed | Updated docs reflecting changes |

### 4.2 PR Requirements

Every Pull Request must:

1. Link to a valid work item
2. Include an AI assistance disclosure
3. Include a human understanding confirmation
4. Pass all automated tests
5. Be reviewed by someone who understands the code

### 4.3 Review Requirements

Code reviews must verify:

1. Reviewer understands the implementation
2. Code meets requirements from work item
3. Risks and edge cases are addressed
4. Tests are adequate
5. Documentation is updated

---

## 5. Prohibited Practices

### 5.1 Blind Merging

Never merge code you don't understand. If AI generated code you can't explain, don't merge it.

### 5.2 Untraceable Changes

Never commit changes without a work item. Ad-hoc changes create unmaintainable code.

### 5.3 Broad AI Rewrites

AI should not rewrite large portions of the codebase without explicit approval and phased rollout.

### 5.4 Security Delegation

Never let AI write security-sensitive code (auth, encryption, permissions) without expert human review.

### 5.5 Test Skipping

AI-generated code is not exempt from testing. If anything, it requires more verification.

---

## 6. High-Caution Areas

These areas require extra scrutiny for AI-generated code:

| Area | Concern | Required Review |
|------|---------|-----------------|
| Authentication | Account takeover, session hijacking | Security expert |
| Authorization | Permission bypass | Security expert |
| Billing | Revenue leakage, fraud | Finance + engineering |
| Encryption | Data exposure | Security expert |
| Integrations | API misuse, data leaks | Integration owner |
| Data Migrations | Data loss, corruption | DBA + engineering |
| Infrastructure | Outages, costs | DevOps |

---

## 7. Repository Structure

All Buildly repositories should include:

```
.ai/
├── AGENT_POLICY.md              # AI usage policy
└── PROMPTS/
    └── universal-engineering-prompt.md

.github/
├── PULL_REQUEST_TEMPLATE.md     # PR template with AI disclosure
├── copilot-instructions.md      # IDE AI configuration
└── ISSUE_TEMPLATE/
    ├── feature_request.md
    ├── bug_report.md
    └── ai_task.md

devdocs/
├── features/
│   └── FEATURE_TEMPLATE.md
├── bugs/
│   └── BUG_TEMPLATE.md
└── reviews/
    └── REVIEW_TEMPLATE.md

ops/
└── standards/
    └── ai-engineering-standard.md   # This document
```

---

## 8. Tool Configuration

### 8.1 GitHub Copilot

Configure via `.github/copilot-instructions.md`:
- Prefer minimal diffs
- Avoid high-caution areas
- Suggest tests and docs

### 8.2 Other AI Tools

Any AI tool (Claude, Cursor, ChatGPT) should:
- Use the universal engineering prompt
- Follow repository constraints
- Produce structured output

---

## 9. Enforcement

### 9.1 Automated

- PR templates require work item links
- CI checks for required sections
- Automated tests must pass

### 9.2 Manual

- Code reviews verify understanding
- Team retrospectives assess AI usage
- Incidents review AI contribution

---

## 10. Metrics

Track AI effectiveness:

| Metric | Target | Purpose |
|--------|--------|---------|
| PR review time | Decrease | AI should make reviews easier |
| Bug escape rate | Decrease | AI shouldn't introduce more bugs |
| Test coverage | Increase | AI should help write more tests |
| Doc coverage | Increase | AI should help write more docs |
| Developer satisfaction | Increase | AI should make work better |

---

## 11. Training

All engineers should:

1. Read and understand this standard
2. Practice using AI prompts effectively
3. Learn to review AI-generated code critically
4. Know when NOT to use AI

---

## 12. Exceptions

This standard may be adjusted for:

- Experimental/prototype branches (with clear labeling)
- Internal tools (with team agreement)
- Emergencies (with post-hoc documentation)

All exceptions must be documented and limited in scope.

---

## 13. Amendments

This standard is versioned and reviewed quarterly. Propose changes via:
1. GitHub issue in the template repository
2. Discussion in engineering meetings
3. Approval by engineering leadership

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| AI assists, humans own | Confirmation in every PR |
| Traceability always | Work item required |
| Small, focused changes | Review minimal diffs |
| Human accountability | Understanding checks |

---

*For questions about this standard, contact the Buildly engineering team.*

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-17 | Buildly | Initial release |
