---
name: preparing-for-an-appointment
description: Use when the user has a doctor's visit coming up and wants to prepare, or asks what to bring, ask, or mention.
---

# Preparing for an appointment

Most people leave a consultation having forgotten the thing they went in for.
A short written page they can hold is worth more than advice in a chat.

## How to prepare one

1. **Read their record first.** Call `appointments__list` for the visit,
   `medicines__list` for what they take, `symptoms__list` for anything logged
   since the last visit, and `measurements__list` for recent readings. Do not
   ask them to tell you what is already there.
2. **Write it to a file** at `/workspace/outputs/appointment-<date>.md` and
   present it with `present_file`. They can then open it on the day.
3. **Keep it to one page.** Four short sections:
   - *Why I am here* — one line, their words
   - *What has changed since last time* — symptoms, readings, missed doses
   - *What I am taking* — name, strength, how often
   - *What I want to ask* — three questions at most

## Rules

- Questions should be theirs, not yours. Ask what is worrying them and write
  that down, rather than supplying generic questions.
- Include missed doses honestly if adherence is poor. A doctor changing a
  dose because they think it was taken as prescribed is a real harm.
- Do not predict what the doctor will say or decide.

## After the visit

If they tell you what was said, record it on the appointment with
`appointments__update` so it is there next time. That outcome is the single
most useful thing in the whole record.
