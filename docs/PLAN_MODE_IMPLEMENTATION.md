# Plan Mode Implementation

## Overview
Plan mode allows Claude to explore the codebase, ask clarifying questions via a modal, and only implement changes after user approval. The entire flow (exploration → questions → answers → implementation) is displayed in a unified timeline.

## Key Features
- Claude explores codebase in `permissionMode: 'plan'` (tools allowed, no execution)
- Questions sent via `<QUESTIONS>` XML tags with JSON structure
- Modal displays with 3 input types: text, radio (single choice), checkbox (multiple choice)
- Modal closes immediately on "Yes" click
- Implementation happens in `permissionMode: 'bypassPermissions'` (execution allowed)
- Timeline merges 2 blocks (questions block + answers block) into single visual flow

## Files Changed

### `/src/components/ActionBar.tsx`
**Added:**
- `questions` state - stores questions from Claude
- `questionAnswers` state - stores user's answers
- `customInputs` state - stores custom text inputs
- `isProcessingAnswers` state - prevents double-click

**Key Functions:**
- `onQuestions` listener (lines 238-254) - receives questions from Claude via IPC
- Modal rendering (lines 1208-1559) - displays questions with text/radio/checkbox inputs
- "Yes" button handler (lines 1395-1465):
  - Closes modal immediately
  - Creates chat block for answers
  - Sends answers via `claude.sendPrompt()` with `planMode: false`

**Hardcoded Options:**
- "Choose what you believe is the best option." (`__CLAUDE_DECIDE__`)
- "Type something: ___________" (`__CUSTOM__`)

### `/src/components/StatusSheet.tsx`
**Added Helper Functions:**
- `hasQuestions(block)` - checks if block contains `<QUESTIONS>` tags
- `isAnswerBlock(block)` - checks if userPrompt starts with "Here are my answers"
- `stripQuestions(text)` - removes `<QUESTIONS>` XML from display
- `extractAnswers(prompt)` - parses user answers from prompt text

**Block Merging Logic (lines 897-941):**
- Skip answer blocks from rendering
- Skip implementation blocks (unless they're new question blocks)
- Find `answerBlock` at `actualIndex + 1` using `findIndex()`
- Set `isPlanModeWithAnswers` flag

**Timeline Rendering:**
- User prompt (hidden for answer blocks)
- Code editing - exploration (Block 1 messages)
- Waiting for user input (anthropic icon)
- User provided answers (user icon with bullet list)
- Implementing changes (Block 2 messages with tool usage)
- Git commit (Block 2 actions, only shown when status !== 'pending')
- Dev server restart (Block 2 actions, only shown when status !== 'pending')

**Key Fix:**
Implementation messages/actions come from `answerBlock`, not a separate third block. When `sendPrompt()` is called with answers, Claude's response gets added to Block 2.

### `/electron/services/ClaudeService.ts`
**Plan Mode Instructions (lines 268-291):**
Added system prompt telling Claude:
1. Use tools to explore codebase
2. Analyze what needs to be done
3. Output questions in strict JSON format inside `<QUESTIONS>` tags
4. Don't execute changes yet

**Question Format:**
```json
<QUESTIONS>
{"questions":[
  {"id":"q1","type":"text","question":"Question text?"},
  {"id":"q2","type":"radio","question":"Choice?","options":["A","B","C"]},
  {"id":"q3","type":"checkbox","question":"Multiple?","options":["X","Y","Z"]}
]}
</QUESTIONS>
```

### `/electron/preload.js`
**Added IPC Methods:**
- `claude.startSession()` - now accepts `planMode` parameter
- `claude.sendPrompt()` - now accepts `planMode` parameter
- `claude.onQuestions()` - listener for questions from Claude

### `/src/types/electron.d.ts`
**Added Types:**
- `planMode?: boolean` parameter to `startSession()` and `sendPrompt()`
- `onQuestions: (callback) => () => void` event listener

## Flow Diagram

```
User enables plan mode → sends prompt
          ↓
Claude explores (Block 1 created)
  - Uses tools (Read, Grep, Glob, Task)
  - Analyzes codebase
  - Sends <QUESTIONS> JSON
          ↓
Frontend receives questions → shows modal
          ↓
User answers → clicks Yes
          ↓
Modal closes immediately
          ↓
Block 2 created with answers
          ↓
Claude receives answers (planMode: false)
  - Implements changes
  - Messages/actions added to Block 2
          ↓
Timeline shows merged blocks:
  - Exploration
  - Waiting for input
  - User answers
  - Implementation
  - Git commit
  - Dev server restart
```

## Architecture Notes

### Why 2 Blocks, Not 3?
Initially expected 3 blocks:
1. Questions block
2. Answers block (user prompt only)
3. Implementation block (Claude's response)

But actually:
1. Questions block (Claude explores and asks)
2. Answers block (user prompt + Claude's implementation response)

When `sendPrompt()` is called, Claude's response messages/actions are added to the same block, not a new one.

### Block Skipping Logic
- Answer blocks: Always skipped (merged into question block)
- Implementation blocks: Skipped ONLY if they're not new question blocks
- Check `!hasQuestions(block)` to allow new plan mode sessions after previous ones

### Action Status Filtering
Git commit and dev server steps only show when `status !== 'pending'` to display progressively as actions start, not all at once.
