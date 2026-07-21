---
id: STORY-015
title: Import "To Refine" work items
epic: E GitLab
status: not-started
depends_on: [STORY-014, STORY-005]
commit_prefix: story-015
---

## Goal

Pull GitLab work items whose **Status** property is "To Refine" into a session as
stories, instead of typing them by hand.

## Scope

- GraphQL query for a project's `workItems` filtered to Status = "To Refine",
  reading the Status widget (confirm exact widget/field name against the live API
  per STORY-014). Handle pagination.
- Map each work item → story: title, description, `external_ref` (work-item IID +
  web URL).
- Client: "Import from GitLab" on the Session page → preview the fetched items →
  select which to add. Avoid duplicates (dedupe on `external_ref`).
- Graceful handling when Status filtering isn't available on a given project
  (fallback message, not a crash).

## Acceptance criteria

- Importing lists the project's "To Refine" work items and adds the chosen ones
  as stories with a link back to GitLab.
- Re-importing does not create duplicates.
- Imported stories behave identically to manual ones in voting/reveal/history.

## Notes

Filtering by the Status **property** (not a label) is the crux — statuses aren't
exposed by the REST issues API the same way, which is why the project is on
GraphQL. Lock the query shape in STORY-014 before implementing here.
