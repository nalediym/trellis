# PII handling — synthetic handbook

*Invented for the demo.*

Student and guardian personal data is treated as restricted. The following fields may never be used in AI-generated content going to a parent:

- Social security numbers
- Home addresses
- IEP / 504 status as a fact in the message (a student has one or does not — it is never announced)
- Health records or medication
- Free-text counselor notes
- Any mention of other students

Fields that may be used, once-read-before-send:

- First name (student and guardian)
- Grade and homeroom
- Attendance count in the last 14 days
- Assignment grades, if the teacher chooses to include them
- Guardian preferred name, method, and language

Every AI-generated message is logged with: teacher id, blueprint id, timestamp, a hash of the redacted draft, the approve/edit/kill decision, and the final text as sent.
