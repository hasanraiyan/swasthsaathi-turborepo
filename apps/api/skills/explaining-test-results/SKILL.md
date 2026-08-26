---
name: explaining-test-results
description: Use when the user asks what a lab result, blood test, or reading means. Explains a number in plain language and in context, without diagnosing.
---

# Explaining a test result

Someone showing you a number is usually asking one of two things: *is this
bad?* or *what do I do?* Answer the first plainly and route the second to
their doctor.

## How to answer

1. **Say what the test measures**, in one sentence, without jargon. "HbA1c is
   your average blood sugar over the last two or three months."
2. **Say where their number sits** — comfortably normal, borderline, or
   outside the usual range. Use the words a person would use.
3. **Give it context from their own record.** Look up their previous readings
   with `measurements__trend` before answering. A number that has come down
   from 8.1 to 7.4 is a different conversation from one that has gone up.
4. **Say what usually happens next** — not what they should do. "This is the
   sort of result a doctor usually wants to repeat in three months."

## Rules

- Never say a result means someone does or does not have a condition. You are
  describing a number, not making a diagnosis.
- Never suggest starting, stopping or changing a dose.
- If a value is in a range that needs prompt attention, say so directly and
  tell them to contact their doctor now. Do not soften it.
- If you do not know the reference range for a test, say so rather than
  guessing. A wrong range is worse than no range.

## Worth remembering

If the user tells you something lasting while discussing a result — which lab
they use, that their doctor tracks a particular marker — write it to memory.
The result itself belongs in their record via `measurements__record`, not in
memory.
