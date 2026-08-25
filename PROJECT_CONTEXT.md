# YouTube Clip Player — Project Context

## 1. Project purpose

Create a small, mobile-first web app that lets a user build and watch a sequence of selected time ranges from YouTube videos.

Example:

- Video A: 01:20 → 02:10
- Video B: 04:00 → 05:30
- Video A: 08:15 → 09:00

The app should play these ranges in order so that they feel like one continuous, virtual video.

The same YouTube video may appear multiple times with different start/end ranges.

This is intended as a small volunteer-built tool for a friend, not as a commercial service.

---

## 2. Core user scenario

The friend opens the app on a smartphone and performs all editing themselves.

Desired flow:

1. Open the web app.
2. Paste a YouTube URL.
3. Load the video.
4. Play or seek to the desired start point.
5. Tap an IN button to mark the start.
6. Play or seek to the desired end point.
7. Tap an OUT button to mark the end.
8. Add that clip to the clip list.
9. Repeat with the same or different YouTube videos.
10. Reorder or delete clips.
11. Tap Play All.
12. The app plays the selected ranges sequentially.

The person who created/hosts the app should not need to know which videos are being used.

---

## 3. Privacy requirement

This is a major product requirement.

The friend is expected to want their selected videos to remain private from the person who created or hosts the app.

The practical privacy target is:

> In normal use, the app owner should not receive or store the user's YouTube URLs, video IDs, clip timestamps, or clip list.

Absolute cryptographic prevention against a malicious future app update is NOT required.

The intended protection level is:

> The app owner would have to deliberately modify the application to collect this information. It should not be collected as part of normal operation.

### Required privacy rules

- Do not build a backend API for clip data.
- Do not store YouTube URLs, video IDs, timestamps, or playlists on a server.
- Store user-created clip data locally in the browser only.
- Use localStorage initially unless IndexedDB becomes clearly necessary.
- Do not use analytics.
- Do not use advertising.
- Do not use Sentry or similar remote error-reporting services.
- Do not add telemetry.
- Do not place clip/video information in query parameters or shared URLs.
- Do not send clip data to GitHub, the hosting provider, or any developer-controlled endpoint.
- YouTube playback will necessarily communicate with YouTube/Google. This is acceptable.
- Normal static-site hosting requests are acceptable, but video-selection data must not be intentionally included in those requests.

A future PRIVACY.md should explain this clearly to the user.

---

## 4. Product philosophy

Keep the project intentionally small.

Priorities, in order:

1. Verify the YouTube playback concept actually works well on smartphones.
2. Preserve privacy by keeping user data local.
3. Make the phone UI simple enough for a non-technical user.
4. Avoid unnecessary infrastructure and maintenance.
5. Add features only after the core playback experience is proven.

Do not over-engineer the first version.

---

## 5. Initial technical direction

Recommended stack:

- Vite
- TypeScript
- HTML
- CSS
- Vanilla browser APIs
- YouTube IFrame Player API
- localStorage
- GitHub repository
- Static hosting, likely GitHub Pages

Do NOT initially use:

- React
- Next.js
- Vue
- a backend
- a database
- authentication
- user accounts
- cloud sync

The app should remain a static client-side web application for as long as practical.

---

## 6. YouTube integration

Use the YouTube IFrame Player API.

The app will keep its own clip sequence rather than relying on a normal YouTube playlist.

Conceptual clip model:

    {
      videoId: string,
      startSeconds: number,
      endSeconds: number
    }

Example sequence:

    [
      { videoId: "A", startSeconds: 80,  endSeconds: 130 },
      { videoId: "B", startSeconds: 240, endSeconds: 330 },
      { videoId: "A", startSeconds: 495, endSeconds: 540 }
    ]

The same videoId can appear any number of times.

Playback concept:

1. Load the first clip's video at startSeconds.
2. Play until endSeconds.
3. Load the next clip.
4. Continue until the clip sequence ends.

The app should use one visible YouTube player and change the loaded video/range as needed.

---

## 7. Important technical risk

The main uncertainty is NOT general coding difficulty.

The main uncertainty is smartphone YouTube playback behavior.

The first technical prototype must specifically test:

- iPhone Safari behavior
- Android Chrome behavior
- whether A → B → A can continue smoothly
- whether switching videos requires another user gesture
- autoplay restrictions
- inline playback behavior
- timing accuracy near clip boundaries
- load delay between different videos
- whether endSeconds behaves consistently
- how seeking behaves on mobile
- what happens when the network is slow
- what happens when a video cannot be embedded

Do not invest heavily in UI until this has been tested.

---

## 8. MVP 0 — technical proof of concept

Goal:

Prove that the fundamental playback sequence works on smartphones.

Do not build the full editor yet.

The prototype may use hard-coded test clips or a very simple temporary input interface.

Minimum test sequence:

- Video A: range 1
- Video B: range 2
- Video A: range 3

Required behavior:

    A → B → A

Each item must play only its assigned time range.

### MVP 0 success criteria

- The sequence works on at least the target friend's smartphone.
- The first playback begins from an explicit user tap.
- Subsequent transitions are reasonably automatic.
- Any unavoidable limitations are understood.
- Failure cases can fall back to a visible "Play next" action if necessary.

Only after this passes should the proper mobile editor be built.

---

## 9. MVP 1 — mobile editor

After MVP 0 succeeds, build the basic user-facing app.

Suggested mobile workflow:

### Video input

- YouTube URL field
- Load Video button
- Embedded YouTube player

### Marking a clip

- Current playback time display
- IN button
- OUT button
- Start time display
- End time display
- Add Clip button

Because precise seeking on a phone can be difficult, include simple adjustment controls such as:

- -5 sec
- -1 sec
- +1 sec
- +5 sec

These can be applied to IN/OUT values.

### Clip list

Each clip should show:

- order number
- video identifier or a privacy-safe/local label
- start time
- end time
- duration
- move up
- move down
- delete

Avoid drag-and-drop as the only reorder mechanism on mobile.

Buttons should be large enough for touch use.

### Playback

Provide a prominent:

- Play All

During playback, show:

- current clip number / total clips
- current clip range
- overall elapsed time if practical
- previous / next controls as fallback
- return to edit mode

---

## 10. MVP 2 — local persistence

Persist the user's clip list locally.

Initial choice:

- localStorage

Persist:

- video IDs or source URLs as necessary
- start/end times
- clip order
- lightweight local UI state if useful

Do not persist this data remotely.

Provide an obvious way to clear/reset saved local data.

---

## 11. Later possibilities

Only consider these after the basic tool proves useful:

- better virtual timeline
- overall seek bar across all clips
- clip naming
- duplicate clip action
- better reordering
- PWA installation
- offline app shell
- multiple locally saved playlists
- export/import of playlist data as a local file
- privacy-preserving sharing design

Do not add server-based sharing by default.

---

## 12. Mobile UX principles

The primary target is smartphone use.

Design requirements:

- mobile-first
- one-column layout
- touch targets roughly 44 px or larger
- no hover-dependent controls
- text inputs at least 16 px to avoid iOS zoom behavior
- no tiny timeline handles for essential editing
- IN/OUT buttons should be easy to hit
- provide +/- second adjustment buttons
- avoid unnecessary modal dialogs
- minimize typing
- support ordinary portrait orientation first

Desktop support is useful but secondary.

---

## 13. Suggested repository structure

Initial structure may remain small:

    youtube-clip-player/
    ├── index.html
    ├── src/
    │   ├── main.ts
    │   ├── youtube.ts
    │   ├── player.ts
    │   ├── clips.ts
    │   ├── storage.ts
    │   └── style.css
    ├── README.md
    ├── PRIVACY.md
    ├── PROJECT_CONTEXT.md
    ├── package.json
    └── vite.config.ts

Do not create abstractions merely to match this structure. Fewer files are acceptable for MVP 0.

---

## 14. Development workflow

GitHub should be the source of truth.

Recommended AI role split:

### Main implementation agent
Use one primary coding agent, preferably Codex, to edit the repository.

### Secondary reviewer
Claude or another model may be used for occasional code review, UI critique, or independent reasoning.

Avoid having multiple agents independently implement the same feature at the same time unless intentionally comparing approaches.

Suggested workflow:

1. Define/update requirements in PROJECT_CONTEXT.md.
2. Give one narrowly scoped task to the coding agent.
3. Agent implements on a branch.
4. Review the diff.
5. Test on real smartphone hardware.
6. Record discovered limitations.
7. Merge when the milestone works.
8. Move to the next milestone.

---

## 15. Suggested first GitHub issues

1. MVP0: create Vite + TypeScript static app
2. MVP0: integrate YouTube IFrame Player API
3. MVP0: implement hard-coded A → B → A range playback
4. MVP0: test iPhone Safari
5. MVP0: test Android Chrome if available
6. Document mobile autoplay / transition limitations
7. MVP1: YouTube URL input
8. MVP1: IN / OUT controls
9. MVP1: clip list and reordering
10. MVP1: Play All mode
11. MVP2: localStorage persistence
12. Add PRIVACY.md
13. Deploy static build to GitHub Pages

---

## 16. Non-goals for the first version

The first version is NOT:

- a video downloader
- a video editor that creates a new media file
- a YouTube replacement
- a public social platform
- a cloud playlist service
- a multi-user application
- an account-based service

It is a local browser tool that controls the official YouTube embedded player.

---

## 17. Definition of first usable version

The first genuinely useful release should allow the friend to:

1. Open the app on a smartphone.
2. Paste a YouTube URL.
3. Mark a start and end time.
4. Add the clip.
5. Add more clips from the same or other YouTube videos.
6. Reorder/delete them.
7. Play them sequentially.
8. Close and reopen the browser without losing the list.
9. Do all of this without sending the clip list to the app owner.

---

## 18. Current project decision

Proceed in this order:

**First: MVP 0 technical validation.**

Do not begin with polished UI.

Prove that smartphone playback of:

    Video A range → Video B range → Video A range

is acceptable.

If successful, proceed to the mobile editor.

This file is the current project context and should be updated whenever a significant product, privacy, or architecture decision changes.
