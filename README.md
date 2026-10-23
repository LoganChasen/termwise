# Termwise

Your whole semester in one place.

Termwise is a personal dashboard for school that runs on your own computer. It pulls your assignments from Canvas, reads your syllabi, and shows:

- **Updates:** what changed since you last looked (new assignments, moved due dates, newly posted grades, tests coming up).
- **Assignments:** everything due, soonest first.
- **Heat map:** a semester calendar colored by how much work each day really holds, so you see crunch weeks coming.
- **Courses:** current grades, class times and office hours, plus a grade calculator ("what do I need on the final?").
- **Semester Wrapped:** an end-of-term recap.

## How it gets your data (no Canvas API token)

Many schools, including Emory, don't let students create Canvas API tokens. Termwise only uses what every student already has:

1. **Your Canvas Calendar Feed:** a private link Canvas gives every student (Calendar, then "Calendar Feed"). It contains every assignment and due date.
2. **Your syllabi:** uploaded once per semester. Termwise uses the Claude API to pull out exam dates, grading weights, class times and office hours, and you review everything before it's saved.
3. **Your grades:** copy your Canvas Grades page and paste it in.

Everything is stored locally on your machine. Only syllabus and grade-paste text is sent to the Claude API for extraction.

## Status

Under construction.

## License

MIT. See [LICENSE](LICENSE).
