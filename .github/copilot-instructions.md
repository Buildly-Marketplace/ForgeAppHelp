# GitHub Copilot Instructions

> Repository-level instructions for GitHub Copilot and other AI assistants.

---

## General Guidelines

### Prefer Minimal Changes
- Make the smallest diff that solves the problem
- Don't refactor unrelated code
- Preserve existing formatting and patterns
- Only touch files directly relevant to the task

### Follow Existing Patterns
- Match the codebase's naming conventions
- Use established architectural patterns
- Respect existing abstractions
- Don't introduce new patterns without discussion

### Be Conservative
- When uncertain, ask or suggest options
- Prefer explicit over clever
- Avoid premature optimization
- Don't assume missing context

---

## High-Caution Areas

**Extra care required—suggest but don't auto-complete:**

### Authentication & Authorization
- Login/logout flows
- Session management
- Token handling
- Permission checks
- Role-based access control

### Billing & Payments
- Stripe integration
- Invoice generation
- Subscription logic
- Payment processing

### Security
- Input validation
- SQL query construction
- File uploads
- CORS configuration
- Secret handling
- Encryption/decryption

### Integrations
- Third-party API calls
- Webhook handlers
- External service connections
- OAuth flows

### Infrastructure
- Docker configurations
- CI/CD pipelines
- Environment variables
- Deployment scripts

---

## Code Generation

### Do
```js
/** Total price of every item in the cart, in minor units. */
export function calculateTotal(items) {
  return items.reduce((total, item) => total + item.priceCents, 0);
}
```

### Don't
```js
// Clever but unclear
const calc = (x) => x.reduce((a, i) => a + i.p, 0);
```

---

## Testing

When generating code, also suggest:
- Relevant unit tests
- Edge case tests
- Integration tests if applicable

### Test Template
```js
it('does the expected thing', () => {
  // Arrange
  const input = ...;
  const expected = ...;

  // Act
  const result = functionUnderTest(input);

  // Assert
  expect(result).toEqual(expected);
});
```

Component tests assert on the same `data-testid` hooks the E2E suite uses, so
a rename breaks a fast unit test before it breaks marketplace CI:

```jsx
it('reveals the panel when the primary action is clicked', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByTestId('primary-action'));

  expect(screen.getByTestId('panel')).toBeVisible();
});
```

---

## Documentation

Suggest documentation updates when:
- Adding new functions or classes
- Changing public APIs
- Modifying configuration
- Updating dependencies

### Doc Comment Format
```js
/**
 * Brief description of what the function does.
 *
 * @param {string} param1 - Description of param1
 * @param {number} param2 - Description of param2
 * @returns {boolean} Description of the return value
 * @throws {TypeError} When param1 is not a string
 */
function functionName(param1, param2) {
  // ...
}
```

---

## Commit Messages

Suggest commits in this format:
```
type(scope): brief description

- Detail about change
- Another detail

Work-Item: <ID>
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `style`

---

## Project Structure

```
src/           # Application source code
tests/         # Test files
ops/           # Operations and deployment
devdocs/       # Development documentation
.ai/           # AI agent configuration
.github/       # GitHub configuration
```

---

## Language-Specific

### JavaScript / TypeScript
- Prefer `const`; reach for `let` only when reassigning
- Use optional chaining `?.` and nullish coalescing `??`
- Keep modules small and export named symbols, not default grab-bags
- `async`/`await` over promise chains, and always handle the rejection
- In TypeScript, annotate exported signatures; let inference handle locals

### Components
- One component per file, named for the file
- Keep the `data-testid` hooks declared in `BUILDLY.yaml` intact -- E2E depends on them
- Derive state during render instead of syncing it in an effect
- An effect that sets state it also depends on is an infinite loop; drop the dependency or restructure

### HTML/CSS
- Use semantic HTML
- Prefer CSS classes over inline styles
- Keep accessibility in mind

### Docker
- Use specific version tags
- Minimize layer count
- Don't run as root

---

## The Buildly Standard

Remember:
- **AI assists, humans own**
- Every change needs a work item
- Small, focused, reviewable diffs
- Tests and docs are not optional
- When in doubt, ask

---

*These instructions implement the [Buildly AI Engineering Standard](ops/standards/ai-engineering-standard.md).*
