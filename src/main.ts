import './style.css'

type TestClip = {
  label: 'A' | 'B'
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
    startSeconds: number
    endSeconds: number
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
      <h1>MVP 0 Playback Test</h1>
      <p class="intro">One player will attempt the fixed sequence A → B → A.</p>
    </header>

    <section class="player-panel" aria-label="YouTube test player">
      <div class="player-frame">
        <div id="youtube-player"></div>
      </div>

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
      <p class="config-note">
        Replace the placeholder IDs and time ranges in <code>TEST_CLIPS</code> at the top of
        <code>src/main.ts</code> before testing.
      </p>
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
let awaitingPlaybackAfterAutoTransition = false
let loadGeneration = 0

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

  if (state === 1 && awaitingPlaybackAfterAutoTransition) {
    awaitingPlaybackAfterAutoTransition = false
    addLog(`Clip ${currentClipIndex + 1} began playing after an automatic transition.`, 'automatic')
  }

  if (state === 0 && sequenceStarted && !boundaryHandled && player) {
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
        playerStateElement.textContent = 'Ready'
        playSequenceButton.disabled = false
        playSequenceButton.textContent = 'Play Test Sequence'
        addLog('YouTube player is ready. Playback requires the start button.', 'system')
      },
      onStateChange: (event) => handlePlayerStateChange(event.data),
      onError: (event) => {
        const detail = errorMessages[event.data] ?? `Unknown YouTube error (${event.data})`
        awaitingPlaybackAfterAutoTransition = false
        playerStateElement.textContent = 'Error'
        addLog(`Player error: ${detail}.`, 'system')
      },
    },
  })
}

renderSequence()
playSequenceButton.addEventListener('click', startSequence)
playNextButton.addEventListener('click', playNextManually)

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
  playerStateElement.textContent = 'API load failed'
  playSequenceButton.textContent = 'Player unavailable'
  addLog(message, 'system')
})
