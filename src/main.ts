import './style.css'

type TestClip = {
  label: 'A' | 'B'
  videoId: string
  startSeconds: number
  endSeconds: number
}

type Clip = {
  id: string
  videoId: string
  startSeconds: number
  endSeconds: number
}

// MVP 0 test data: replace only the values in this block when test videos are chosen.
// Keep the first and third videoId values identical so the sequence remains A -> B -> A.
const TEST_CLIPS: readonly TestClip[] = [
  {
    label: 'A',
    videoId: 'eQKxk6zU4rA',
    startSeconds: 10,
    endSeconds: 20,
  },
  {
    label: 'B',
    videoId: 'XlmVP-V2E0U',
    startSeconds: 10,
    endSeconds: 20,
  },
  {
    label: 'A',
    videoId: 'eQKxk6zU4rA',
    startSeconds: 30,
    endSeconds: 40,
  },
]

type PlayerState = -1 | 0 | 1 | 2 | 3 | 5

type YouTubePlayer = {
  loadVideoById: (options: {
    videoId: string
    startSeconds?: number
    endSeconds?: number
  }) => void
  playVideo: () => void
  getCurrentTime: () => number
  getPlayerState: () => PlayerState
  getVideoData: () => { video_id?: string }
}

type YouTubeNamespace = {
  Player: new (
    elementId: string,
    options: {
      width: string
      height: string
      playerVars: {
        controls: number
        enablejsapi: number
        origin: string
        playsinline: number
        rel: number
      }
      events: {
        onReady: () => void
        onStateChange: (event: { data: PlayerState }) => void
        onError: (event: { data: number }) => void
      }
    },
  ) => YouTubePlayer
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <main class="test-shell">
    <header class="page-header">
      <p class="eyebrow">YouTube Clip Player</p>
      <h1>Mobile Video Editor</h1>
      <p class="intro">Load a YouTube video, or run the proven fixed A → B → A playback test.</p>
    </header>

    <section class="player-panel" aria-label="YouTube test player">
      <form id="video-loader" class="video-loader" novalidate>
        <label for="youtube-url">YouTube URL</label>
        <input
          id="youtube-url"
          name="youtube-url"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="https://www.youtube.com/watch?v=…"
          aria-describedby="url-message"
        />
        <button id="load-video" class="primary-button" type="submit" disabled>
          Load Video
        </button>
        <p id="url-message" class="url-message" aria-live="polite"></p>
      </form>

      <div class="player-frame">
        <div id="youtube-player"></div>
      </div>

      <section class="editor-controls" aria-labelledby="editor-controls-heading">
        <div class="editor-time-row">
          <h2 id="editor-controls-heading">Current time</h2>
          <output id="editor-current-time" class="editor-time-value">--:--.-</output>
        </div>

        <div class="mark-controls">
          <div class="mark-control">
            <button id="mark-in" class="mark-button" type="button" disabled>IN</button>
            <div>
              <span>IN time</span>
              <output id="draft-in" class="mark-time" aria-live="polite">--:--.-</output>
            </div>
            <div class="adjustment-controls" role="group" aria-label="Adjust IN time">
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-5" disabled>-5</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-1" disabled>-1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="1" disabled>+1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="5" disabled>+5</button>
            </div>
          </div>
          <div class="mark-control">
            <button id="mark-out" class="mark-button" type="button" disabled>OUT</button>
            <div>
              <span>OUT time</span>
              <output id="draft-out" class="mark-time" aria-live="polite">--:--.-</output>
            </div>
            <div class="adjustment-controls" role="group" aria-label="Adjust OUT time">
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="-5" disabled>-5</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="-1" disabled>-1</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="1" disabled>+1</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="5" disabled>+5</button>
            </div>
          </div>
        </div>

        <div class="add-clip-controls">
          <button id="add-clip" class="primary-button add-clip-button" type="button" disabled>
            Add Clip
          </button>
          <p id="add-clip-message" class="add-clip-message" aria-live="polite"></p>
          <p id="clip-count" class="clip-count" aria-live="polite">0 clips added</p>
        </div>
      </section>

      <div class="controls">
        <button id="play-sequence" class="primary-button" type="button" disabled>
          Loading YouTube Player…
        </button>
        <button id="play-next" class="secondary-button" type="button" disabled>
          Play Next
        </button>
      </div>
    </section>

    <section class="status-panel" aria-labelledby="status-heading">
      <h2 id="status-heading">Current status</h2>
      <dl class="status-grid">
        <div><dt>Clip</dt><dd id="clip-number">Not started</dd></div>
        <div><dt>videoId</dt><dd id="video-id">—</dd></div>
        <div><dt>Range</dt><dd id="clip-range">—</dd></div>
        <div><dt>Position</dt><dd id="current-position">—</dd></div>
        <div><dt>Player state</dt><dd id="player-state">Loading API</dd></div>
        <div><dt>Last transition</dt><dd id="transition-type">—</dd></div>
      </dl>
    </section>

    <section class="sequence-panel" aria-labelledby="sequence-heading">
      <h2 id="sequence-heading">Fixed test sequence</h2>
      <ol id="sequence-list"></ol>
    </section>

    <section class="log-panel" aria-labelledby="log-heading">
      <div class="log-heading-row">
        <h2 id="log-heading">Event log</h2>
        <span aria-live="polite" id="log-summary">Waiting for player</span>
      </div>
      <ol id="event-log" class="event-log" aria-live="polite"></ol>
    </section>
  </main>
`

const videoLoaderForm = document.querySelector<HTMLFormElement>('#video-loader')!
const youtubeUrlInput = document.querySelector<HTMLInputElement>('#youtube-url')!
const loadVideoButton = document.querySelector<HTMLButtonElement>('#load-video')!
const urlMessageElement = document.querySelector<HTMLElement>('#url-message')!
const editorCurrentTimeElement = document.querySelector<HTMLOutputElement>('#editor-current-time')!
const markInButton = document.querySelector<HTMLButtonElement>('#mark-in')!
const markOutButton = document.querySelector<HTMLButtonElement>('#mark-out')!
const draftInElement = document.querySelector<HTMLOutputElement>('#draft-in')!
const draftOutElement = document.querySelector<HTMLOutputElement>('#draft-out')!
const inAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="in"]')
const outAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="out"]')
const addClipButton = document.querySelector<HTMLButtonElement>('#add-clip')!
const addClipMessageElement = document.querySelector<HTMLElement>('#add-clip-message')!
const clipCountElement = document.querySelector<HTMLElement>('#clip-count')!
const playSequenceButton = document.querySelector<HTMLButtonElement>('#play-sequence')!
const playNextButton = document.querySelector<HTMLButtonElement>('#play-next')!
const clipNumberElement = document.querySelector<HTMLElement>('#clip-number')!
const videoIdElement = document.querySelector<HTMLElement>('#video-id')!
const clipRangeElement = document.querySelector<HTMLElement>('#clip-range')!
const currentPositionElement = document.querySelector<HTMLElement>('#current-position')!
const playerStateElement = document.querySelector<HTMLElement>('#player-state')!
const transitionTypeElement = document.querySelector<HTMLElement>('#transition-type')!
const sequenceListElement = document.querySelector<HTMLOListElement>('#sequence-list')!
const eventLogElement = document.querySelector<HTMLOListElement>('#event-log')!
const logSummaryElement = document.querySelector<HTMLElement>('#log-summary')!

let player: YouTubePlayer | undefined
let currentClipIndex = -1
let sequenceStarted = false
let boundaryHandled = false
let activeClipHasPlayed = false
let awaitingPlaybackAfterAutoTransition = false
let loadGeneration = 0
let playerReady = false
let editorVideoId: string | undefined
let currentPlaybackSeconds: number | undefined
let draftInSeconds: number | undefined
let draftOutSeconds: number | undefined
let manualVideoActive = false
let nextClipId = 1

const clips: Clip[] = []

const UNSET_TIME = '--:--.-'

const stateNames: Record<PlayerState, string> = {
  [-1]: 'Unstarted',
  [0]: 'Ended',
  [1]: 'Playing',
  [2]: 'Paused',
  [3]: 'Buffering',
  [5]: 'Cued',
}

const errorMessages: Record<number, string> = {
  2: 'Invalid video ID or request',
  5: 'HTML5 player error',
  100: 'Video not found or private',
  101: 'Embedding is not allowed by the video owner',
  150: 'Embedding is not allowed by the video owner',
}

function extractYouTubeVideoId(value: string): string | undefined {
  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    return undefined
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined

  const hostname = url.hostname.toLowerCase()
  let videoId: string | null | undefined

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0]
  } else if (
    (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'm.youtube.com') &&
    url.pathname === '/watch'
  ) {
    videoId = url.searchParams.get('v')
  }

  return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : undefined
}

function clearUrlValidation(): void {
  youtubeUrlInput.removeAttribute('aria-invalid')
  urlMessageElement.textContent = ''
}

function formatEditorTime(value: number): string {
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  const tenths = Math.floor((value % 1) * 10)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

function resetDraftMarks(): void {
  draftInSeconds = undefined
  draftOutSeconds = undefined
  draftInElement.textContent = UNSET_TIME
  draftOutElement.textContent = UNSET_TIME
  inAdjustmentButtons.forEach((button) => (button.disabled = true))
  outAdjustmentButtons.forEach((button) => (button.disabled = true))
}

function clearAddClipValidation(): void {
  addClipMessageElement.textContent = ''
}

function readEditorPlaybackTime(): number | undefined {
  if (!player || !playerReady) return undefined

  const seconds = player.getCurrentTime()
  if (!Number.isFinite(seconds) || seconds < 0) return undefined

  currentPlaybackSeconds = seconds
  editorCurrentTimeElement.textContent = formatEditorTime(seconds)
  return seconds
}

function markDraftIn(): void {
  const seconds = readEditorPlaybackTime()
  if (seconds === undefined) return

  draftInSeconds = seconds
  draftInElement.textContent = formatEditorTime(draftInSeconds)
  inAdjustmentButtons.forEach((button) => (button.disabled = false))
  clearAddClipValidation()
}

function markDraftOut(): void {
  const seconds = readEditorPlaybackTime()
  if (seconds === undefined) return

  draftOutSeconds = seconds
  draftOutElement.textContent = formatEditorTime(draftOutSeconds)
  outAdjustmentButtons.forEach((button) => (button.disabled = false))
  clearAddClipValidation()
}

function adjustDraftIn(deltaSeconds: number): void {
  if (draftInSeconds === undefined) return

  draftInSeconds = Math.max(0, draftInSeconds + deltaSeconds)
  draftInElement.textContent = formatEditorTime(draftInSeconds)
  clearAddClipValidation()
}

function adjustDraftOut(deltaSeconds: number): void {
  if (draftOutSeconds === undefined) return

  draftOutSeconds = Math.max(0, draftOutSeconds + deltaSeconds)
  draftOutElement.textContent = formatEditorTime(draftOutSeconds)
  clearAddClipValidation()
}

function addDraftClip(): void {
  if (!manualVideoActive || !editorVideoId || player?.getVideoData().video_id !== editorVideoId) {
    addClipMessageElement.textContent = 'Load a YouTube video before adding a clip.'
    return
  }

  if (draftInSeconds === undefined || draftOutSeconds === undefined) {
    addClipMessageElement.textContent = 'Set both IN and OUT times before adding a clip.'
    return
  }

  if (draftOutSeconds <= draftInSeconds) {
    addClipMessageElement.textContent = 'OUT time must be later than IN time.'
    return
  }

  clips.push({
    id: `clip-${nextClipId}`,
    videoId: editorVideoId,
    startSeconds: draftInSeconds,
    endSeconds: draftOutSeconds,
  })
  nextClipId += 1

  clearAddClipValidation()
  clipCountElement.textContent = `${clips.length} ${clips.length === 1 ? 'clip' : 'clips'} added`
  resetDraftMarks()
}

function loadEnteredVideo(event: SubmitEvent): void {
  event.preventDefault()

  const videoId = extractYouTubeVideoId(youtubeUrlInput.value)
  if (!videoId) {
    youtubeUrlInput.setAttribute('aria-invalid', 'true')
    urlMessageElement.textContent = 'Enter a YouTube watch or youtu.be URL.'
    youtubeUrlInput.focus()
    return
  }

  if (!player) {
    urlMessageElement.textContent = 'The YouTube player is still loading. Please try again.'
    return
  }

  clearUrlValidation()
  clearAddClipValidation()
  if (editorVideoId !== videoId) resetDraftMarks()
  editorVideoId = videoId
  manualVideoActive = true
  currentPlaybackSeconds = 0
  editorCurrentTimeElement.textContent = formatEditorTime(currentPlaybackSeconds)
  markInButton.disabled = false
  markOutButton.disabled = false
  sequenceStarted = false
  currentClipIndex = -1
  boundaryHandled = false
  activeClipHasPlayed = false
  awaitingPlaybackAfterAutoTransition = false
  loadGeneration += 1
  playNextButton.disabled = true

  clipNumberElement.textContent = 'Manual video'
  videoIdElement.textContent = videoId
  clipRangeElement.textContent = 'Full video'
  currentPositionElement.textContent = 'Use player controls'
  transitionTypeElement.textContent = 'Load Video'

  player.loadVideoById({ videoId, startSeconds: 0 })
  addLog(`Loaded video ${videoId} from the URL field.`, 'manual')
}

function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  const tenths = Math.floor((value % 1) * 10)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

function renderSequence(): void {
  sequenceListElement.innerHTML = TEST_CLIPS.map(
    (clip, index) => `
      <li>
        <span class="sequence-marker">${index + 1}</span>
        <span><strong>Video ${clip.label}</strong><code>${clip.videoId}</code></span>
        <span>${formatSeconds(clip.startSeconds)} → ${formatSeconds(clip.endSeconds)}</span>
      </li>
    `,
  ).join('')
}

function addLog(message: string, transition?: 'automatic' | 'manual' | 'system'): void {
  const item = document.createElement('li')
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())

  if (transition) {
    const badge = document.createElement('span')
    badge.className = `log-badge ${transition}`
    badge.textContent = transition
    item.append(badge)
  }

  const text = document.createElement('span')
  text.textContent = `${time} — ${message}`
  item.append(text)
  eventLogElement.prepend(item)

  while (eventLogElement.children.length > 30) {
    eventLogElement.lastElementChild?.remove()
  }

  logSummaryElement.textContent = message
}

function updateClipStatus(transition: 'Start button' | 'Automatic' | 'Manual'): void {
  const clip = TEST_CLIPS[currentClipIndex]
  clipNumberElement.textContent = `${currentClipIndex + 1} / ${TEST_CLIPS.length} (Video ${clip.label})`
  videoIdElement.textContent = clip.videoId
  clipRangeElement.textContent = `${formatSeconds(clip.startSeconds)} → ${formatSeconds(clip.endSeconds)}`
  currentPositionElement.textContent = formatSeconds(clip.startSeconds)
  transitionTypeElement.textContent = transition
}

function validateTestClips(): string[] {
  const problems: string[] = []

  if (TEST_CLIPS.some((clip) => clip.videoId.startsWith('REPLACE_WITH_'))) {
    problems.push('Replace both placeholder video IDs in TEST_CLIPS before playback.')
  }

  if (TEST_CLIPS.some((clip) => clip.startSeconds < 0 || clip.endSeconds <= clip.startSeconds)) {
    problems.push('Every clip must have an endSeconds value greater than startSeconds.')
  }

  if (
    TEST_CLIPS.length !== 3 ||
    TEST_CLIPS[0].label !== 'A' ||
    TEST_CLIPS[1].label !== 'B' ||
    TEST_CLIPS[2].label !== 'A' ||
    TEST_CLIPS[0].videoId !== TEST_CLIPS[2].videoId ||
    TEST_CLIPS[0].videoId === TEST_CLIPS[1].videoId
  ) {
    problems.push('TEST_CLIPS must contain three clips in A → B → A order.')
  }

  return problems
}

function loadClip(index: number, transition: 'start' | 'automatic' | 'manual'): void {
  if (!player) return

  if (index >= TEST_CLIPS.length) {
    sequenceStarted = false
    awaitingPlaybackAfterAutoTransition = false
    playNextButton.disabled = true
    transitionTypeElement.textContent = transition === 'manual' ? 'Manual — complete' : 'Automatic — complete'
    addLog(
      'Test sequence completed.',
      transition === 'manual' ? 'manual' : 'automatic',
    )
    return
  }

  currentClipIndex = index
  boundaryHandled = false
  activeClipHasPlayed = false
  awaitingPlaybackAfterAutoTransition = transition === 'automatic'
  loadGeneration += 1
  const thisGeneration = loadGeneration
  const clip = TEST_CLIPS[index]
  const transitionLabel =
    transition === 'start' ? 'Start button' : transition === 'automatic' ? 'Automatic' : 'Manual'

  updateClipStatus(transitionLabel)
  playNextButton.disabled = false
  player.loadVideoById({
    videoId: clip.videoId,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
  })
  addLog(
    `Loaded clip ${index + 1}: Video ${clip.label}, ${formatSeconds(clip.startSeconds)}–${formatSeconds(clip.endSeconds)}.`,
    transition === 'start' ? 'manual' : transition,
  )

  if (transition === 'automatic') {
    window.setTimeout(() => {
      if (
        thisGeneration === loadGeneration &&
        awaitingPlaybackAfterAutoTransition &&
        player?.getPlayerState() !== 1
      ) {
        addLog('Automatic playback has not started. Tap Play Next to continue.', 'system')
      }
    }, 1800)
  }
}

function advanceToNext(transition: 'automatic' | 'manual'): void {
  if (!sequenceStarted || boundaryHandled) return
  boundaryHandled = true
  loadClip(currentClipIndex + 1, transition)
}

function handlePlayerStateChange(state: PlayerState): void {
  playerStateElement.textContent = stateNames[state] ?? `Unknown (${state})`

  if (
    state === 1 &&
    sequenceStarted &&
    player &&
    player.getVideoData().video_id === TEST_CLIPS[currentClipIndex]?.videoId
  ) {
    activeClipHasPlayed = true
  }

  if (state === 1 && awaitingPlaybackAfterAutoTransition) {
    awaitingPlaybackAfterAutoTransition = false
    addLog(`Clip ${currentClipIndex + 1} began playing after an automatic transition.`, 'automatic')
  }

  if (state === 0 && sequenceStarted && activeClipHasPlayed && !boundaryHandled && player) {
    const activeClip = TEST_CLIPS[currentClipIndex]
    const endedVideoId = player.getVideoData().video_id

    // Ignore a late ENDED event from the previous video after the next clip has loaded.
    if (!endedVideoId || endedVideoId === activeClip.videoId) {
      addLog(`Clip ${currentClipIndex + 1} reported ENDED; advancing.`, 'automatic')
      advanceToNext('automatic')
    }
  }
}

function startSequence(): void {
  const problems = validateTestClips()
  if (problems.length > 0) {
    playerStateElement.textContent = 'Test data required'
    problems.forEach((problem) => addLog(problem, 'system'))
    return
  }

  sequenceStarted = true
  manualVideoActive = false
  markInButton.disabled = false
  markOutButton.disabled = false
  currentClipIndex = -1
  addLog('Play Test Sequence pressed. Starting from clip 1.', 'manual')
  loadClip(0, 'start')
}

function playNextManually(): void {
  if (!player || !sequenceStarted) return

  if (awaitingPlaybackAfterAutoTransition && player.getPlayerState() !== 1) {
    awaitingPlaybackAfterAutoTransition = false
    transitionTypeElement.textContent = 'Manual fallback'
    addLog(`Play Next pressed to start clip ${currentClipIndex + 1}.`, 'manual')
    player.playVideo()
    return
  }

  boundaryHandled = false
  addLog(`Play Next pressed; advancing from clip ${currentClipIndex + 1}.`, 'manual')
  advanceToNext('manual')
}

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)

  return new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!)

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    )
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('YouTube IFrame Player API failed to load.'))
    document.head.append(script)
  })
}

function initializePlayer(yt: YouTubeNamespace): void {
  player = new yt.Player('youtube-player', {
    width: '100%',
    height: '100%',
    playerVars: {
      controls: 1,
      enablejsapi: 1,
      origin: window.location.origin,
      playsinline: 1,
      rel: 0,
    },
    events: {
      onReady: () => {
        playerReady = true
        playerStateElement.textContent = 'Ready'
        loadVideoButton.disabled = false
        addClipButton.disabled = false
        playSequenceButton.disabled = false
        playSequenceButton.textContent = 'Play Test Sequence'
        addLog('YouTube player is ready. Playback requires the start button.', 'system')
      },
      onStateChange: (event) => handlePlayerStateChange(event.data),
      onError: (event) => {
        const detail = errorMessages[event.data] ?? `Unknown YouTube error (${event.data})`
        manualVideoActive = false
        awaitingPlaybackAfterAutoTransition = false
        playerStateElement.textContent = 'Error'
        addLog(`Player error: ${detail}.`, 'system')
      },
    },
  })
}

renderSequence()
videoLoaderForm.addEventListener('submit', loadEnteredVideo)
youtubeUrlInput.addEventListener('input', clearUrlValidation)
markInButton.addEventListener('click', markDraftIn)
markOutButton.addEventListener('click', markDraftOut)
inAdjustmentButtons.forEach((button) => {
  button.addEventListener('click', () => adjustDraftIn(Number(button.dataset.delta)))
})
outAdjustmentButtons.forEach((button) => {
  button.addEventListener('click', () => adjustDraftOut(Number(button.dataset.delta)))
})
addClipButton.addEventListener('click', addDraftClip)
playSequenceButton.addEventListener('click', startSequence)
playNextButton.addEventListener('click', playNextManually)

window.setInterval(() => {
  if (!editorVideoId && !sequenceStarted) return
  readEditorPlaybackTime()
}, 100)

window.setInterval(() => {
  if (!player || !sequenceStarted || currentClipIndex < 0) return

  const currentTime = player.getCurrentTime()
  const activeClip = TEST_CLIPS[currentClipIndex]
  currentPositionElement.textContent = formatSeconds(currentTime)

  // A previous video's state can briefly remain visible while the next one loads.
  if (player.getVideoData().video_id !== activeClip.videoId) return

  // endSeconds is supplied to YouTube as well; this check provides a second boundary signal.
  if (player.getPlayerState() === 1 && currentTime >= activeClip.endSeconds - 0.15) {
    addLog(`Clip ${currentClipIndex + 1} reached its configured end; advancing.`, 'automatic')
    advanceToNext('automatic')
  }
}, 200)

loadYouTubeApi().then(initializePlayer).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'YouTube IFrame Player API failed to load.'
  playerReady = false
  playerStateElement.textContent = 'API load failed'
  loadVideoButton.disabled = true
  addClipButton.disabled = true
  playSequenceButton.textContent = 'Player unavailable'
  addLog(message, 'system')
})
