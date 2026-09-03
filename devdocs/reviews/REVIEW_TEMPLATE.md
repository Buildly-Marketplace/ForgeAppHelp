# Code Review: <PR_TITLE>

> **Review ID:** <REVIEW_ID>  
> **PR:** #<PR_NUMBER>  
> **Work Item:** <WORK_ITEM_ID>  
> **Reviewer:** <YOUR_NAME>  
> **Date:** YYYY-MM-DD

---

## Purpose

This review document enforces **human understanding** of code changes. No PR may be merged without a completed review demonstrating that the reviewer comprehends the implementation.

---

## Requirement Understanding

### What Was Requested
<!-- In your own words, explain what this change is supposed to do -->


### Why It Was Requested
<!-- Explain the business or technical motivation -->


### Acceptance Criteria
<!-- List the criteria that define "done" -->
- [ ] 
- [ ] 
- [ ] 

---

## Implementation Understanding

### How It Works
<!-- Explain the implementation approach in your own words -->


### Key Files & Their Roles
| File | Purpose | Key Changes |
|------|---------|-------------|
| | | |

### Data Flow
<!-- Describe how data moves through the system -->


### Key Decisions
<!-- Explain any non-obvious implementation choices -->
| Decision | Rationale |
|----------|-----------|
| | |

---

## Code Comprehension Check

**I can explain:**

- [ ] What each changed file does
- [ ] Why each change was necessary
- [ ] How the changes work together
- [ ] What would break if this code failed
- [ ] How to modify this code for similar future needs

**If AI was used:**

- [ ] I understand what the AI generated
- [ ] I verified the AI's output is correct
- [ ] I could have written this myself (even if slower)

---

## Risk Assessment

### Identified Risks
| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| | | | |

### Edge Cases Considered
- [ ] Empty/null inputs
- [ ] Maximum/minimum values
- [ ] Concurrent access
- [ ] Failure scenarios
- [ ] Permission boundaries

### Security Considerations
- [ ] No security implications
- [ ] Security reviewed: 

---

## Testing Review

### Test Coverage
- [ ] Unit tests cover new code
- [ ] Integration tests cover interactions
- [ ] Edge cases are tested
- [ ] Error paths are tested

### Test Quality
- [ ] Tests are clear and readable
- [ ] Tests actually verify the behavior
- [ ] Tests will catch regressions

### Manual Verification
<!-- What did you manually test? -->
- 

---

## Documentation Review

- [ ] Code is self-documenting
- [ ] Complex logic has comments
- [ ] Public APIs have docstrings
- [ ] README updated if needed
- [ ] devdocs updated if needed

---

## Work Item Mapping

### Traceability
| Requirement | Implementation | Test |
|-------------|----------------|------|
| <requirement from work item> | <file/function> | <test name> |

### Completeness
- [ ] All requirements from work item are addressed
- [ ] No scope creep beyond work item
- [ ] Work item can be closed after merge

---

## Review Decision

### Verdict
- [ ] ✅ **Approved** — Code is understood and ready to merge
- [ ] 🔄 **Changes Requested** — See notes below
- [ ] ❌ **Rejected** — Fundamental issues found

### Notes


### Required Changes (if any)
1. 
2. 
3. 

---

## Reviewer Attestation

I, **<REVIEWER_NAME>**, confirm:

- [ ] I have read and understood all changed code
- [ ] I can explain this code to another engineer
- [ ] I have verified the code meets the requirements
- [ ] I have assessed risks and edge cases
- [ ] I take shared responsibility for this code

**Signature:** ___________________  
**Date:** YYYY-MM-DD

---

*Template version: 1.0 — [Buildly AI Engineering Standard](../../ops/standards/ai-engineering-standard.md)*
