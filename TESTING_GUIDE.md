# 🧪 Testing Guide for OpenElara Cloud

## What We Just Built

You now have **automated testing infrastructure** that catches bugs before they reach production!

### ✅ What's Installed

- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **@testing-library/jest-dom** - DOM matchers (`toBeInTheDocument`, etc.)
- **@testing-library/user-event** - User interaction simulation

### 📁 Test Structure

```
src/
  lib/
    __tests__/           ← Unit tests for utilities/functions
      characters.test.ts
      councilMode.test.ts
  components/
    __tests__/           ← Component tests (future)
      MessageContent.test.tsx
```

---

## How to Run Tests

### Basic Commands

```powershell
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode (for GitHub Actions, etc.)
npm run test:ci
```

### Watch Mode (Recommended for Development!)

```powershell
npm run test:watch
```

This will:
1. Run all tests initially
2. Watch for file changes
3. Rerun only affected tests when you save
4. **Catch breaking changes instantly** as you code!

---

## What Tests Catch (Real Examples from Today!)

### Example 1: Vision Type Removal

When we removed `'vision'` from `ModelType`, tests would have caught if any code still referenced it.

```typescript
// models.ts - Before
export type ModelType = 'chat' | 'image' | 'video' | 'audio' | 'vision';

// ❌ If we had a test checking model types:
expect(getAllModelTypes()).toContain('vision'); // Would FAIL after change
```

### Example 2: Council Mode Token Limits

Our tests verified:
```typescript
it('should NOT enforce hard maxTokens on individual perspectives', async () => {
  // ... make API call ...
  
  // Check that calls don't have maxTokens hardcoded
  individualCalls.forEach(call => {
    expect(call[1]?.maxTokens).toBeUndefined(); // ✅ PASSES
  });
});
```

**If you accidentally added `maxTokens` back**, tests would **immediately fail** and tell you!

### Example 3: Character Persona Completeness

```typescript
it('should have complete persona with SELF-AWARENESS PROTOCOL', () => {
  expect(ELARA.persona).toContain('SELF-AWARENESS PROTOCOL');
  expect(ELARA.persona).toContain('TEACHER PROTOCOL');
  expect(ELARA.persona).toContain('EMPOWERMENT PROTOCOL');
});
```

**If someone removed a protocol section**, tests fail instantly.

---

## Test Types Explained

### 1. **Unit Tests** (What We Built)

Test individual functions/modules in isolation.

```typescript
// Example: Testing character emotional profiles
it('should have correct emotional profile', () => {
  expect(ELARA.emotionalProfile.baseline).toBe(65);
  expect(ELARA.emotionalProfile.sensitivity).toBe(1.4);
});
```

**When to use:** Testing utilities, pure functions, data transformations.

### 2. **Integration Tests**

Test how multiple parts work together.

```typescript
// Example: Council Mode calling API with correct parameters
it('should call API with all 4 personas', async () => {
  await executeCouncilMode({ userQuestion: 'Test' });
  
  // Check that API was called 5 times (4 perspectives + 1 synthesis)
  expect(mockChat).toHaveBeenCalledTimes(5);
});
```

**When to use:** Testing workflows, API interactions, multi-step processes.

### 3. **Component Tests** (Future)

Test React components.

```typescript
// Example: Testing MessageContent component
it('should render markdown correctly', () => {
  render(<MessageContent content="**Bold text**" role="assistant" />);
  
  expect(screen.getByText(/Bold text/i)).toBeInTheDocument();
});
```

**When to use:** Testing UI behavior, user interactions, component logic.

---

## Writing Your Own Tests

### Basic Test Structure

```typescript
describe('Feature Name', () => {
  // Setup runs before each test
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });
  
  it('should do something specific', () => {
    // Arrange - Set up test data
    const input = 'test';
    
    // Act - Execute the code
    const result = myFunction(input);
    
    // Assert - Check results
    expect(result).toBe('expected');
  });
});
```

### Common Matchers

```typescript
// Equality
expect(value).toBe(42);                    // Exact match
expect(value).toEqual({ name: 'Elara' }); // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeLessThan(100);
expect(value).toBeCloseTo(0.3, 5); // Floating point

// Strings
expect(str).toContain('substring');
expect(str).toMatch(/regex/);

// Arrays
expect(array).toContain('item');
expect(array).toHaveLength(5);

// Objects
expect(obj).toHaveProperty('key');
expect(obj).toMatchObject({ name: 'Elara' });
```

---

## Testing Best Practices

### ✅ DO

1. **Test behavior, not implementation**
   ```typescript
   // ✅ Good - Tests what user sees
   expect(result).toContain('Synthesis:');
   
   // ❌ Bad - Tests internal variable names
   expect(internalCounter).toBe(5);
   ```

2. **Use descriptive test names**
   ```typescript
   // ✅ Good
   it('should return Elara when no character is selected')
   
   // ❌ Bad
   it('test1')
   ```

3. **One assertion per test (usually)**
   ```typescript
   // ✅ Good - Focused
   it('should have SELF-AWARENESS PROTOCOL', () => {
     expect(ELARA.persona).toContain('SELF-AWARENESS PROTOCOL');
   });
   
   it('should have TEACHER PROTOCOL', () => {
     expect(ELARA.persona).toContain('TEACHER PROTOCOL');
   });
   ```

4. **Mock external dependencies**
   ```typescript
   jest.mock('@/lib/api');  // Don't make real API calls in tests!
   ```

### ❌ DON'T

1. **Don't test implementation details**
2. **Don't make real network requests**
3. **Don't depend on test execution order**
4. **Don't test third-party libraries** (trust they work)

---

## Coverage Reports

```powershell
npm run test:coverage
```

This generates a report showing:
- **Lines covered** - How many lines of code were executed
- **Branches covered** - How many if/else paths were tested
- **Functions covered** - How many functions were called
- **Statements covered** - How many statements ran

**Coverage report location:** `coverage/lcov-report/index.html`

Open in browser to see visual coverage!

---

## Continuous Integration (CI)

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run test:ci
```

**Tests run automatically on every commit!**

---

## What to Test (Priorities)

### High Priority
1. ✅ **Core utilities** (characters, models, API client)
2. ✅ **Council Mode workflow** (we did this!)
3. ⏳ **Deep Thought engine** (todo)
4. ⏳ **Knowledge/RAG system** (todo)

### Medium Priority
5. ⏳ **Authentication flows**
6. ⏳ **Media generation**
7. ⏳ **Storage quota checks**

### Low Priority
8. ⏳ **UI components** (visual behavior)
9. ⏳ **Styling/CSS** (snapshot tests)

---

## Debugging Failed Tests

### 1. Read the Error Message

```
Expected: "aeron"
Received: "elara"

at Object.toBe (src/lib/__tests__/characters.test.ts:137:25)
```

- **What failed:** Expected "aeron", got "elara"
- **Where:** Line 137 in characters.test.ts
- **Why:** `getActiveCharacter()` doesn't use localStorage as expected

### 2. Add Debug Logging

```typescript
it('should return selected character', () => {
  localStorage.setItem('selectedCharacter', 'aeron');
  const active = getActiveCharacter();
  
  console.log('Active character:', active.id); // Debug output
  
  expect(active.id).toBe('aeron');
});
```

### 3. Use `.only` to Run One Test

```typescript
it.only('this test only', () => {
  // Only this test runs - faster debugging!
});
```

### 4. Skip Tests Temporarily

```typescript
it.skip('broken test to fix later', () => {
  // Test is skipped
});
```

---

## Next Steps

### Add More Tests

Create tests for:
- **Deep Thought** - Verify multi-turn workflow
- **Knowledge ingestion** - Test RAG functionality
- **Token budgets** - Verify limits work correctly
- **File conversion** - Test markdown extraction

### Integration with IDE

Most IDEs show test results inline:
- ✅ Green checkmarks for passing tests
- ❌ Red X for failures
- Click to jump to test/code

### Test-Driven Development (TDD)

1. **Write test first** (it fails - red)
2. **Write minimal code** to make it pass (green)
3. **Refactor** code (test still passes)
4. Repeat!

---

## Questions?

**"When should I run tests?"**
→ Every time before committing! Use `npm run test:watch` while coding.

**"Do I need 100% coverage?"**
→ No! Aim for **critical paths** covered. 70-80% is good.

**"Tests are slow, help?"**
→ Use `.only` to run specific tests. Mock slow operations (API calls, file I/O).

**"Test failed after I changed X. What now?"**
→ **This is success!** Tests caught a breaking change. Update code or test as needed.

---

## Summary

You now have:
✅ **Automated testing** that runs in seconds
✅ **26 passing tests** covering characters and council mode
✅ **Watch mode** for instant feedback
✅ **Coverage reports** showing what's tested
✅ **CI-ready** commands for deployment pipelines

**Tests prevent:**
- ❌ Breaking persona protocols when editing
- ❌ Reintroducing token limits after removing them
- ❌ Deploying broken features to production
- ❌ Regression bugs (old bugs coming back)

🎉 **You're now a testing-enabled developer!**
