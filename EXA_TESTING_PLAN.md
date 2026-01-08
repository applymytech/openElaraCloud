# Exa Integration - Testing & Verification Plan

## Critical: Exa is the App's Brain

Exa powers **Power Knowledge** - the system that lets the LLM get live, current information instead of relying on training data. This must work perfectly.

---

## ✅ What's Already Implemented

### Core Functions ([src/lib/exa.ts](../src/lib/exa.ts))

1. **powerSearch()** - Web search with highlights
2. **powerRead()** - URL crawling with live content
3. **powerSimilar()** - Find similar pages
4. **powerAnswer()** - AI-generated answers with sources (MOST IMPORTANT)
5. **startDeepResearch()** - Long-running research tasks
6. **pollResearchStatus()** - Check research progress

### Key Features

- ✅ BYOK (users provide their own Exa key)
- ✅ Live crawl prioritization (`livecrawl: 'always'`)
- ✅ Error handling with clear messages
- ✅ Result formatting for LLM consumption

---

## 🧪 Testing Checklist

### Phase 1: API Key Configuration

- [ ] **Test 1.1**: Add Exa key in Account → API Keys
  - Verify key saves to localStorage
  - Verify `isExaConfigured()` returns true
  - Verify no errors in console

- [ ] **Test 1.2**: Try using Exa without key
  - Should show clear error: "Exa.ai API key not configured"
  - Should direct user to Settings → API Keys

- [ ] **Test 1.3**: Invalid key handling
  - Enter invalid key
  - Attempt Power Knowledge operation
  - Should show API error from Exa

### Phase 2: Power Answer (Critical Path)

**This is the primary tool for Deep Thought!**

- [ ] **Test 2.1**: Simple factual query
  ```typescript
  await powerAnswer("What are the latest developments in quantum computing?")
  ```
  - Should return `{ success: true, answer: "...", sourceUrls: [...] }`
  - Answer should cite recent sources
  - URLs should be valid and relevant

- [ ] **Test 2.2**: Live crawl verification
  ```typescript
  await powerAnswer("Today's date", { livecrawl: 'always' })
  ```
  - Should return actual current date (not training data)
  - Verifies live crawl is working

- [ ] **Test 2.3**: Number of results
  ```typescript
  await powerAnswer("AI news", { numResults: 5 })
  ```
  - Should use 5 sources (not default 10)
  - Check response includes proper citations

- [ ] **Test 2.4**: Date filtering
  ```typescript
  await powerAnswer("quantum computing", { 
    startDate: "2026-01-01" 
  })
  ```
  - Should only return results from 2026 onwards
  - Verify publishedDate fields

- [ ] **Test 2.5**: Domain filtering
  ```typescript
  await powerAnswer("AI research", {
    includeDomains: ["arxiv.org", "nature.com"]
  })
  ```
  - Should only cite papers from specified domains
  - Verify source URLs match

- [ ] **Test 2.6**: Error handling
  ```typescript
  await powerAnswer("")  // Empty query
  ```
  - Should return `{ success: false, error: "..." }`
  - Error message should be clear

### Phase 3: Power Search

- [ ] **Test 3.1**: Basic search
  ```typescript
  await powerSearch("AI alignment")
  ```
  - Should return array of results
  - Each result should have: title, url, score, text, highlights

- [ ] **Test 3.2**: Live crawl in search
  ```typescript
  await powerSearch("breaking news", { livecrawl: 'always' })
  ```
  - Should use live crawl for fresh results
  - Compare with `livecrawl: 'never'` to see difference

- [ ] **Test 3.3**: Highlights extraction
  ```typescript
  const result = await powerSearch("machine learning")
  console.log(result.results[0].highlights)
  ```
  - Should return relevant text snippets
  - Highlights should match query

### Phase 4: Power Read (URL Crawling)

- [ ] **Test 4.1**: Crawl a known URL
  ```typescript
  await powerRead("https://en.wikipedia.org/wiki/Artificial_intelligence")
  ```
  - Should return extracted text content
  - Should handle large pages

- [ ] **Test 4.2**: Live vs cached
  ```typescript
  await powerRead(url, { livecrawl: 'always' })
  await powerRead(url, { livecrawl: 'never' })
  ```
  - Compare results
  - Live should be more current

- [ ] **Test 4.3**: Invalid URL handling
  ```typescript
  await powerRead("https://thisdoesnotexist.fake")
  ```
  - Should return error gracefully
  - Should not crash app

### Phase 5: Power Similar

- [ ] **Test 5.1**: Find similar pages
  ```typescript
  await powerSimilar("https://arxiv.org/abs/2103.14030")
  ```
  - Should return related research papers
  - Results should be semantically similar

### Phase 6: Deep Research (Advanced)

- [ ] **Test 6.1**: Start research task
  ```typescript
  const taskId = await startDeepResearch("Comprehensive analysis of quantum computing")
  ```
  - Should return task ID
  - Should start processing

- [ ] **Test 6.2**: Poll research status
  ```typescript
  const status = await pollResearchStatus(taskId)
  ```
  - Should return status: 'running', 'completed', or 'failed'
  - Should eventually complete

- [ ] **Test 6.3**: Long-running research
  ```typescript
  const result = await startDeepResearch("Multi-hour research query")
  ```
  - Should handle long polling
  - Should timeout after 5 minutes (MAX_POLL_ATTEMPTS)

### Phase 7: Integration with Chat

- [ ] **Test 7.1**: Power Knowledge in chat
  - Open chat
  - Click "⚡ Power Knowledge"
  - Ask: "What's happening with AI in 2026?"
  - Verify response cites current sources

- [ ] **Test 7.2**: Multiple queries in conversation
  - Ask question 1 → Get answer with sources
  - Ask follow-up question 2 → Get new answer with sources
  - Verify context is maintained

- [ ] **Test 7.3**: Error handling in chat
  - Remove Exa key
  - Try Power Knowledge
  - Should show user-friendly error in chat

### Phase 8: Deep Thought Tool Calling

**When Deep Thought is implemented:**

- [ ] **Test 8.1**: LLM calls `search_web`
  ```typescript
  // System tells LLM about tools
  // LLM decides to call search_web("quantum computing")
  // Verify it gets live results
  ```

- [ ] **Test 8.2**: LLM calls `read_url`
  ```typescript
  // LLM finds URL from search
  // LLM calls read_url("https://...")
  // Verify it gets full content
  ```

- [ ] **Test 8.3**: Multi-turn research
  ```typescript
  // Turn 1: search_web("topic") → Gets overview
  // Turn 2: read_url("interesting-link") → Gets details
  // Turn 3: search_web("deeper-question") → Drills down
  // Verify accumulated knowledge
  ```

---

## 🎯 Success Criteria

### Must Pass

1. ✅ **powerAnswer returns live, current data** (not training data)
2. ✅ **livecrawl='always' actually uses live crawls**
3. ✅ **Error messages are clear and actionable**
4. ✅ **API key configuration works reliably**
5. ✅ **Results are properly formatted for LLM consumption**

### Should Pass

6. ✅ Date filtering works correctly
7. ✅ Domain filtering respects includeDomains/excludeDomains
8. ✅ Highlights are relevant and useful
9. ✅ Large pages don't crash the system
10. ✅ Polling doesn't hang forever

### Nice to Have

11. ✅ Deep Research completes complex queries
12. ✅ Cache vs live performance is noticeable
13. ✅ Similar pages are genuinely related

---

## 🐛 Common Issues to Watch For

### Issue 1: Cached Results Instead of Live

**Symptom**: `powerAnswer("today's date")` returns old date

**Fix**: Ensure `livecrawl: 'always'` is being passed:
```typescript
// ❌ Wrong
await powerAnswer(query)

// ✅ Right
await powerAnswer(query, { livecrawl: 'always' })
```

### Issue 2: API Key Not Found

**Symptom**: "Exa.ai API key not configured" even after adding key

**Fix**: Check localStorage:
```javascript
localStorage.getItem('elara_apikey_exa')
```

If null, key didn't save. Check `saveAPIKey()` implementation.

### Issue 3: CORS Errors

**Symptom**: Browser blocks Exa API requests

**Fix**: Exa API should allow CORS. If not, check:
- Exa dashboard → API settings
- Browser console for exact error

### Issue 4: Rate Limiting

**Symptom**: 429 errors after several requests

**Fix**: This is expected with free tier. Show clear error:
```typescript
if (response.status === 429) {
  return { 
    success: false, 
    error: 'Exa.ai rate limit exceeded. Please wait before trying again.' 
  };
}
```

### Issue 5: Large Response Truncation

**Symptom**: Long articles cut off mid-sentence

**Fix**: Check `powerRead` implementation - ensure it returns full text:
```typescript
answer: content?.text || 'No content extracted'
```

---

## 📊 Performance Benchmarks

Test with these queries and record performance:

| Query | Expected Time | Acceptable Max |
|-------|--------------|----------------|
| Simple factual | 2-4 seconds | 8 seconds |
| powerAnswer with 10 sources | 5-8 seconds | 15 seconds |
| powerRead large page | 3-6 seconds | 12 seconds |
| powerSearch | 1-3 seconds | 6 seconds |
| Deep Research | 30-120 seconds | 5 minutes |

---

## 🔄 End-to-End Test Script

```typescript
// tests/exa.e2e.test.ts

import { powerAnswer, powerSearch, powerRead, powerSimilar } from '@/lib/exa';

async function runExaTests() {
  console.log('🧪 Starting Exa E2E Tests...\n');
  
  // Test 1: Power Answer (most important)
  console.log('Test 1: Power Answer');
  const answer = await powerAnswer("What is quantum computing?", { 
    livecrawl: 'always',
    numResults: 5 
  });
  console.assert(answer.success, 'Power Answer failed');
  console.assert(answer.answer?.length > 100, 'Answer too short');
  console.assert(answer.sourceUrls?.length > 0, 'No sources returned');
  console.log('✅ Power Answer: PASS\n');
  
  // Test 2: Power Search
  console.log('Test 2: Power Search');
  const search = await powerSearch("AI breakthroughs", { 
    livecrawl: 'always' 
  });
  console.assert(search.success, 'Power Search failed');
  console.assert(search.results?.length > 0, 'No results returned');
  console.log('✅ Power Search: PASS\n');
  
  // Test 3: Power Read
  console.log('Test 3: Power Read');
  const read = await powerRead("https://en.wikipedia.org/wiki/Artificial_intelligence", {
    livecrawl: 'always'
  });
  console.assert(read.success, 'Power Read failed');
  console.assert(read.answer?.length > 500, 'Content too short');
  console.log('✅ Power Read: PASS\n');
  
  // Test 4: Live vs Cached
  console.log('Test 4: Live Crawl Verification');
  const liveAnswer = await powerAnswer("Today's date", { livecrawl: 'always' });
  const cachedAnswer = await powerAnswer("Today's date", { livecrawl: 'never' });
  console.log('Live:', liveAnswer.answer);
  console.log('Cached:', cachedAnswer.answer);
  console.log('✅ Live Crawl: VERIFY MANUALLY\n');
  
  console.log('🎉 All Exa tests complete!');
}

// Run tests
runExaTests().catch(console.error);
```

---

## 🚀 Integration with Deep Thought

When Deep Thought is implemented, Exa tools should be:

1. **Simple Tool Names**
   - `search_web` → `powerAnswer()`
   - `read_url` → `powerRead()`

2. **Always Live**
   - All tools force `livecrawl: 'always'`
   - No option for cached (defeat the purpose)

3. **RAG-Assisted Discovery**
   - Tool definitions stored in RAG
   - LLM retrieves relevant tools based on query
   - Prevents tool hallucination

4. **Error Recovery**
   - If Exa fails, LLM gets clear error
   - LLM can retry or use different approach
   - No silent failures

---

## 📝 Testing Schedule

### Week 1: Core Functionality
- Day 1-2: API key configuration tests
- Day 3-4: Power Answer comprehensive testing
- Day 5: Power Search and Power Read

### Week 2: Advanced Features
- Day 1-2: Deep Research and polling
- Day 3: Integration with chat interface
- Day 4-5: Performance optimization

### Week 3: Deep Thought Integration
- Day 1-2: Tool calling infrastructure
- Day 3-4: RAG-assisted tool discovery
- Day 5: End-to-end agentic workflows

---

## ✅ Sign-Off Criteria

Before considering Exa integration complete:

- [ ] All Phase 1-4 tests pass
- [ ] Live crawl demonstrably works (not cached data)
- [ ] Error handling is user-friendly
- [ ] Performance is acceptable (< 8s for most queries)
- [ ] API key management is reliable
- [ ] Integration with chat UI works smoothly
- [ ] Documentation is complete and accurate

---

**Last Updated**: January 8, 2026  
**Status**: Implementation Complete, Testing Required  
**Priority**: CRITICAL - This is the app's intelligence layer
