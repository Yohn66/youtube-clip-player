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
  cueVideoById: (options: {
    videoId: string
    startSeconds?: number
  }) => void
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
      <p class="eyebrow">YouTube クリッププレイヤー</p>
      <h1>モバイル動画編集</h1>
      <p class="intro">YouTube動画を読み込んでクリップを作成できます。固定のA → B → A再生テストも実行できます。</p>
    </header>

    <section class="player-panel" aria-label="YouTubeテストプレイヤー">
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
          動画を読み込む
        </button>
        <p id="url-message" class="url-message" aria-live="polite"></p>
      </form>

      <div class="player-frame">
        <div id="youtube-player"></div>
      </div>

      <section class="editor-controls" aria-labelledby="editor-controls-heading">
        <div class="editor-time-row">
          <h2 id="editor-controls-heading">現在位置</h2>
          <output id="editor-current-time" class="editor-time-value">--:--.-</output>
        </div>

        <div class="mark-controls">
          <div class="mark-control">
            <button id="mark-in" class="mark-button" type="button" disabled>開始時間を設定</button>
            <div>
              <span>開始</span>
              <output id="draft-in" class="mark-time" aria-live="polite">--:--.-</output>
            </div>
            <div class="adjustment-controls" role="group" aria-label="開始位置を調整">
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-5" disabled>-5</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-1" disabled>-1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="1" disabled>+1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="5" disabled>+5</button>
            </div>
          </div>
          <div class="mark-control">
            <button id="mark-out" class="mark-button" type="button" disabled>終了時間を設定</button>
            <div>
              <span>終了</span>
              <output id="draft-out" class="mark-time" aria-live="polite">--:--.-</output>
            </div>
            <div class="adjustment-controls" role="group" aria-label="終了位置を調整">
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="-5" disabled>-5</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="-1" disabled>-1</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="1" disabled>+1</button>
              <button class="adjustment-button" type="button" data-adjust="out" data-delta="5" disabled>+5</button>
            </div>
          </div>
        </div>

        <div class="add-clip-controls">
          <p id="edit-mode-indicator" class="edit-mode-indicator" aria-live="polite" hidden></p>
          <button id="add-clip" class="primary-button add-clip-button" type="button" disabled>
            クリップを追加
          </button>
          <button id="cancel-edit" class="secondary-button cancel-edit-button" type="button" hidden>
            キャンセル
          </button>
          <p id="add-clip-message" class="add-clip-message" aria-live="polite"></p>
          <p id="clip-count" class="clip-count" aria-live="polite">クリップ数: 0</p>
        </div>
      </section>

      <div class="controls">
        <button id="play-sequence" class="primary-button" type="button" disabled>
          YouTubeプレイヤーを読み込み中…
        </button>
        <button id="play-next" class="secondary-button" type="button" disabled>
          次を再生
        </button>
      </div>
    </section>

    <section class="clip-list-panel" aria-labelledby="clip-list-heading">
      <h2 id="clip-list-heading">クリップ一覧</h2>
      <ol id="clip-list" class="clip-list"></ol>
    </section>

    <section class="status-panel" aria-labelledby="status-heading">
      <h2 id="status-heading">現在の状態</h2>
      <dl class="status-grid">
        <div><dt>クリップ</dt><dd id="clip-number">未開始</dd></div>
        <div><dt>videoId</dt><dd id="video-id">—</dd></div>
        <div><dt>範囲</dt><dd id="clip-range">—</dd></div>
        <div><dt>現在位置</dt><dd id="current-position">—</dd></div>
        <div><dt>プレイヤー状態</dt><dd id="player-state">APIを読み込み中</dd></div>
        <div><dt>最後の切り替え</dt><dd id="transition-type">—</dd></div>
      </dl>
    </section>

    <section class="sequence-panel" aria-labelledby="sequence-heading">
      <h2 id="sequence-heading">固定テストシーケンス</h2>
      <ol id="sequence-list"></ol>
    </section>

    <section class="log-panel" aria-labelledby="log-heading">
      <div class="log-heading-row">
        <h2 id="log-heading">イベントログ</h2>
        <span aria-live="polite" id="log-summary">プレイヤー待機中</span>
      </div>
      <ol id="event-log" class="event-log" aria-live="polite"></ol>
    </section>
  </main>
`

const videoLoaderForm = document.querySelector<HTMLFormElement>('#video-loader')!
const youtubeUrlInput = document.querySelector<HTMLInputElement>('#youtube-url')!
const loadVideoButton = document.querySelector<HTMLButtonElement>('#load-video')!
const urlMessageElement = document.querySelector<HTMLElement>('#url-message')!
const playerFrameElement = document.querySelector<HTMLElement>('.player-frame')!
const editorCurrentTimeElement = document.querySelector<HTMLOutputElement>('#editor-current-time')!
const markInButton = document.querySelector<HTMLButtonElement>('#mark-in')!
const markOutButton = document.querySelector<HTMLButtonElement>('#mark-out')!
const draftInElement = document.querySelector<HTMLOutputElement>('#draft-in')!
const draftOutElement = document.querySelector<HTMLOutputElement>('#draft-out')!
const inAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="in"]')
const outAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="out"]')
const editModeIndicatorElement = document.querySelector<HTMLElement>('#edit-mode-indicator')!
const addClipButton = document.querySelector<HTMLButtonElement>('#add-clip')!
const cancelEditButton = document.querySelector<HTMLButtonElement>('#cancel-edit')!
const addClipMessageElement = document.querySelector<HTMLElement>('#add-clip-message')!
const clipCountElement = document.querySelector<HTMLElement>('#clip-count')!
const clipListElement = document.querySelector<HTMLOListElement>('#clip-list')!
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
let editingClipId: string | null = null
let highlightedClipId: string | null = null
let highlightTimeoutId: number | undefined

const clips: Clip[] = []
const videoLabels = new Map<string, string>()

const UNSET_TIME = '--:--.-'
const CLIP_HIGHLIGHT_DURATION_MS = 4000

const stateNames: Record<PlayerState, string> = {
  [-1]: '未開始',
  [0]: '終了',
  [1]: '再生中',
  [2]: '一時停止',
  [3]: '読み込み中',
  [5]: '再生準備完了',
}

const errorMessages: Record<number, string> = {
  2: '動画IDまたはリクエストが無効です',
  5: 'HTML5プレイヤーでエラーが発生しました',
  100: '動画が見つからないか、非公開です',
  101: '動画の所有者が埋め込みを許可していません',
  150: '動画の所有者が埋め込みを許可していません',
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

function renderEditMode(): void {
  if (editingClipId === null) {
    editModeIndicatorElement.hidden = true
    editModeIndicatorElement.textContent = ''
    addClipButton.textContent = 'クリップを追加'
    cancelEditButton.hidden = true
    playSequenceButton.disabled = !playerReady
    return
  }

  const clipIndex = clips.findIndex((clip) => clip.id === editingClipId)
  editModeIndicatorElement.hidden = false
  editModeIndicatorElement.textContent =
    clipIndex === -1 ? '編集中のクリップはありません' : `クリップ ${clipIndex + 1} を編集中`
  addClipButton.textContent = '変更を保存'
  cancelEditButton.hidden = false
  playSequenceButton.disabled = true
}

function updateRenderedClipHighlight(): void {
  const activeHighlightId = editingClipId ?? highlightedClipId
  clipListElement.querySelectorAll<HTMLElement>('[data-clip-id]').forEach((element) => {
    element.classList.toggle('clip-list-item-highlighted', element.dataset.clipId === activeHighlightId)
  })
}

function clearClipHighlight(): void {
  if (highlightTimeoutId !== undefined) window.clearTimeout(highlightTimeoutId)
  highlightTimeoutId = undefined
  highlightedClipId = null
  updateRenderedClipHighlight()
}

function highlightClip(clipId: string): void {
  if (editingClipId !== null) {
    updateRenderedClipHighlight()
    return
  }

  if (!clips.some((clip) => clip.id === clipId)) {
    clearClipHighlight()
    return
  }

  if (highlightTimeoutId !== undefined) window.clearTimeout(highlightTimeoutId)
  highlightedClipId = clipId
  updateRenderedClipHighlight()
  highlightTimeoutId = window.setTimeout(() => {
    if (highlightedClipId === clipId) clearClipHighlight()
  }, CLIP_HIGHLIGHT_DURATION_MS)
}

function highlightEditingClip(clipId: string): void {
  if (highlightTimeoutId !== undefined) window.clearTimeout(highlightTimeoutId)
  highlightTimeoutId = undefined
  highlightedClipId = clipId
  updateRenderedClipHighlight()
}

function scrollToClip(clipId: string): void {
  window.requestAnimationFrame(() => {
    const clipElement = Array.from(
      clipListElement.querySelectorAll<HTMLElement>('[data-clip-id]'),
    ).find((element) => element.dataset.clipId === clipId)
    if (!clipElement) return

    highlightClip(clipId)
    clipElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function cancelClipEdit(scrollBackToClip: boolean): void {
  const editedClipId = editingClipId
  editingClipId = null
  clearAddClipValidation()
  resetDraftMarks()

  if (scrollBackToClip) {
    renderClipList()
    if (editedClipId !== null) scrollToClip(editedClipId)
    return
  }

  clearClipHighlight()
  renderEditMode()
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

function getVideoLabel(videoId: string): string {
  const existingLabel = videoLabels.get(videoId)
  if (existingLabel) return existingLabel

  const label = `動画 ${videoLabels.size + 1}`
  videoLabels.set(videoId, label)
  return label
}

function moveClip(index: number, offset: -1 | 1): void {
  const targetIndex = index + offset
  const clip = clips[index]
  if (!clip || targetIndex < 0 || targetIndex >= clips.length) return

  clips.splice(index, 1)
  clips.splice(targetIndex, 0, clip)
  renderClipList()
  highlightClip(clip.id)
}

function deleteClip(index: number): void {
  const clip = clips[index]
  if (!clip) return

  clips.splice(index, 1)
  if (highlightedClipId === clip.id) clearClipHighlight()
  renderClipList()
}

function renderClipList(): void {
  clipCountElement.textContent = `クリップ数: ${clips.length}`
  clipListElement.innerHTML = ''
  renderEditMode()

  if (clips.length === 0) {
    const emptyItem = document.createElement('li')
    emptyItem.className = 'clip-list-empty'
    emptyItem.textContent = 'クリップはまだありません'
    clipListElement.append(emptyItem)
    return
  }

  clips.forEach((clip, index) => {
    const item = document.createElement('li')
    const durationSeconds = clip.endSeconds - clip.startSeconds
    const orderNumber = index + 1

    item.className = 'clip-list-item'
    item.dataset.clipId = clip.id
    item.innerHTML = `
      <div class="clip-list-item-heading">
        <span class="clip-order" aria-label="クリップ ${orderNumber}">${orderNumber}</span>
        <strong>${getVideoLabel(clip.videoId)}</strong>
      </div>
      <dl class="clip-times">
        <div><dt>開始</dt><dd>${formatEditorTime(clip.startSeconds)}</dd></div>
        <div><dt>終了</dt><dd>${formatEditorTime(clip.endSeconds)}</dd></div>
        <div><dt>長さ</dt><dd>${formatEditorTime(durationSeconds)}</dd></div>
      </dl>
      <div class="clip-actions">
        <button class="clip-action-button edit-clip-button" type="button" data-action="edit" aria-label="クリップ ${orderNumber} を編集">編集</button>
        <button class="clip-action-button" type="button" data-action="up" aria-label="クリップ ${orderNumber} を上へ移動" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="clip-action-button" type="button" data-action="down" aria-label="クリップ ${orderNumber} を下へ移動" ${index === clips.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="clip-action-button delete-clip-button" type="button" data-action="delete">削除</button>
      </div>
    `

    item.addEventListener('click', () => highlightClip(clip.id))
    item.querySelector<HTMLButtonElement>('[data-action="edit"]')?.addEventListener('click', (event) => {
      event.stopPropagation()
      startEditingClip(clip.id)
    })
    item.querySelector<HTMLButtonElement>('[data-action="up"]')?.addEventListener('click', (event) => {
      event.stopPropagation()
      moveClip(index, -1)
    })
    item.querySelector<HTMLButtonElement>('[data-action="down"]')?.addEventListener('click', (event) => {
      event.stopPropagation()
      moveClip(index, 1)
    })
    item.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', (event) => {
      event.stopPropagation()
      deleteClip(index)
    })

    clipListElement.append(item)
  })

  updateRenderedClipHighlight()
}

function startEditingClip(clipId: string): void {
  const clipIndex = clips.findIndex((clip) => clip.id === clipId)
  const clip = clips[clipIndex]
  if (!clip) {
    addClipMessageElement.textContent = '選択したクリップはもうありません。'
    return
  }

  if (!player || !playerReady) {
    addClipMessageElement.textContent = 'YouTubeプレイヤーを読み込み中です。もう一度お試しください。'
    return
  }

  editingClipId = clip.id
  highlightEditingClip(clip.id)
  editorVideoId = clip.videoId
  manualVideoActive = true
  currentPlaybackSeconds = clip.startSeconds
  draftInSeconds = clip.startSeconds
  draftOutSeconds = clip.endSeconds
  editorCurrentTimeElement.textContent = formatEditorTime(currentPlaybackSeconds)
  draftInElement.textContent = formatEditorTime(draftInSeconds)
  draftOutElement.textContent = formatEditorTime(draftOutSeconds)
  markInButton.disabled = false
  markOutButton.disabled = false
  inAdjustmentButtons.forEach((button) => (button.disabled = false))
  outAdjustmentButtons.forEach((button) => (button.disabled = false))
  sequenceStarted = false
  currentClipIndex = -1
  boundaryHandled = false
  activeClipHasPlayed = false
  awaitingPlaybackAfterAutoTransition = false
  loadGeneration += 1
  playNextButton.disabled = true

  clearAddClipValidation()
  renderEditMode()
  clipNumberElement.textContent = '手動読み込み動画'
  videoIdElement.textContent = clip.videoId
  clipRangeElement.textContent = '動画全体'
  currentPositionElement.textContent = 'プレイヤーで操作'
  transitionTypeElement.textContent = 'クリップ編集'

  player.cueVideoById({ videoId: clip.videoId, startSeconds: clip.startSeconds })
  addLog(`クリップ ${clipIndex + 1} を編集中です。`, 'manual')
  window.requestAnimationFrame(() => {
    if (editingClipId === clip.id) {
      playerFrameElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

function saveDraftClip(): void {
  if (editingClipId === null) return

  const clip = clips.find((candidate) => candidate.id === editingClipId)
  if (!clip) {
    addClipMessageElement.textContent = '編集中のクリップはもうありません。'
    return
  }

  if (
    !manualVideoActive ||
    editorVideoId !== clip.videoId ||
    player?.getVideoData().video_id !== clip.videoId
  ) {
    addClipMessageElement.textContent = '読み込まれた動画が編集中のクリップと一致しません。'
    return
  }

  if (draftInSeconds === undefined || draftOutSeconds === undefined) {
    addClipMessageElement.textContent = '開始と終了を設定してから保存してください。'
    return
  }

  if (draftOutSeconds <= draftInSeconds) {
    addClipMessageElement.textContent = '終了は開始より後に設定してください。'
    return
  }

  clip.startSeconds = draftInSeconds
  clip.endSeconds = draftOutSeconds

  const editedClipId = clip.id
  editingClipId = null
  clearAddClipValidation()
  resetDraftMarks()
  renderClipList()
  scrollToClip(editedClipId)
}

function submitDraftClip(): void {
  if (editingClipId === null) {
    addDraftClip()
    return
  }

  saveDraftClip()
}

function addDraftClip(): void {
  if (!manualVideoActive || !editorVideoId || player?.getVideoData().video_id !== editorVideoId) {
    addClipMessageElement.textContent = '動画を読み込んでからクリップを追加してください。'
    return
  }

  if (draftInSeconds === undefined || draftOutSeconds === undefined) {
    addClipMessageElement.textContent = '開始と終了を設定してからクリップを追加してください。'
    return
  }

  if (draftOutSeconds <= draftInSeconds) {
    addClipMessageElement.textContent = '終了は開始より後に設定してください。'
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
  resetDraftMarks()
  renderClipList()
}

function loadEnteredVideo(event: SubmitEvent): void {
  event.preventDefault()

  const videoId = extractYouTubeVideoId(youtubeUrlInput.value)
  if (!videoId) {
    youtubeUrlInput.setAttribute('aria-invalid', 'true')
    urlMessageElement.textContent = 'YouTubeのwatch URLまたはyoutu.be URLを入力してください。'
    youtubeUrlInput.focus()
    return
  }

  if (!player) {
    urlMessageElement.textContent = 'YouTubeプレイヤーを読み込み中です。もう一度お試しください。'
    return
  }

  if (editingClipId !== null) cancelClipEdit(false)

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

  clipNumberElement.textContent = '手動読み込み動画'
  videoIdElement.textContent = videoId
  clipRangeElement.textContent = '動画全体'
  currentPositionElement.textContent = 'プレイヤーで操作'
  transitionTypeElement.textContent = '動画読み込み'

  player.loadVideoById({ videoId, startSeconds: 0 })
  addLog(`URL入力欄から動画 ${videoId} を読み込みました。`, 'manual')
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
        <span><strong>動画 ${clip.label}</strong><code>${clip.videoId}</code></span>
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
    badge.textContent =
      transition === 'automatic' ? '自動' : transition === 'manual' ? '手動' : 'システム'
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

function updateClipStatus(transition: '開始ボタン' | '自動' | '手動'): void {
  const clip = TEST_CLIPS[currentClipIndex]
  clipNumberElement.textContent = `${currentClipIndex + 1} / ${TEST_CLIPS.length}（動画 ${clip.label}）`
  videoIdElement.textContent = clip.videoId
  clipRangeElement.textContent = `${formatSeconds(clip.startSeconds)} → ${formatSeconds(clip.endSeconds)}`
  currentPositionElement.textContent = formatSeconds(clip.startSeconds)
  transitionTypeElement.textContent = transition
}

function validateTestClips(): string[] {
  const problems: string[] = []

  if (TEST_CLIPS.some((clip) => clip.videoId.startsWith('REPLACE_WITH_'))) {
    problems.push('再生前にTEST_CLIPS内の仮動画IDを2つとも置き換えてください。')
  }

  if (TEST_CLIPS.some((clip) => clip.startSeconds < 0 || clip.endSeconds <= clip.startSeconds)) {
    problems.push('すべてのクリップでendSecondsをstartSecondsより大きくしてください。')
  }

  if (
    TEST_CLIPS.length !== 3 ||
    TEST_CLIPS[0].label !== 'A' ||
    TEST_CLIPS[1].label !== 'B' ||
    TEST_CLIPS[2].label !== 'A' ||
    TEST_CLIPS[0].videoId !== TEST_CLIPS[2].videoId ||
    TEST_CLIPS[0].videoId === TEST_CLIPS[1].videoId
  ) {
    problems.push('TEST_CLIPSにはA → B → Aの順で3つのクリップを設定してください。')
  }

  return problems
}

function loadClip(index: number, transition: 'start' | 'automatic' | 'manual'): void {
  if (!player) return

  if (index >= TEST_CLIPS.length) {
    sequenceStarted = false
    awaitingPlaybackAfterAutoTransition = false
    playNextButton.disabled = true
    transitionTypeElement.textContent = transition === 'manual' ? '手動 — 完了' : '自動 — 完了'
    addLog(
      'テストシーケンスが完了しました。',
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
    transition === 'start' ? '開始ボタン' : transition === 'automatic' ? '自動' : '手動'

  updateClipStatus(transitionLabel)
  playNextButton.disabled = false
  player.loadVideoById({
    videoId: clip.videoId,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
  })
  addLog(
    `クリップ ${index + 1}（動画 ${clip.label}、${formatSeconds(clip.startSeconds)}–${formatSeconds(clip.endSeconds)}）を読み込みました。`,
    transition === 'start' ? 'manual' : transition,
  )

  if (transition === 'automatic') {
    window.setTimeout(() => {
      if (
        thisGeneration === loadGeneration &&
        awaitingPlaybackAfterAutoTransition &&
        player?.getPlayerState() !== 1
      ) {
        addLog('自動再生が始まりませんでした。「次を再生」を押してください。', 'system')
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
  playerStateElement.textContent = stateNames[state] ?? `不明（${state}）`

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
    addLog(`自動切り替え後にクリップ ${currentClipIndex + 1} の再生が始まりました。`, 'automatic')
  }

  if (state === 0 && sequenceStarted && activeClipHasPlayed && !boundaryHandled && player) {
    const activeClip = TEST_CLIPS[currentClipIndex]
    const endedVideoId = player.getVideoData().video_id

    // Ignore a late ENDED event from the previous video after the next clip has loaded.
    if (!endedVideoId || endedVideoId === activeClip.videoId) {
      addLog(`クリップ ${currentClipIndex + 1} の終了を検出し、次へ進みます。`, 'automatic')
      advanceToNext('automatic')
    }
  }
}

function startSequence(): void {
  const problems = validateTestClips()
  if (problems.length > 0) {
    playerStateElement.textContent = 'テストデータが必要です'
    problems.forEach((problem) => addLog(problem, 'system'))
    return
  }

  sequenceStarted = true
  manualVideoActive = false
  markInButton.disabled = false
  markOutButton.disabled = false
  currentClipIndex = -1
  addLog('テストシーケンスをクリップ 1 から開始します。', 'manual')
  loadClip(0, 'start')
}

function playNextManually(): void {
  if (!player || !sequenceStarted) return

  if (awaitingPlaybackAfterAutoTransition && player.getPlayerState() !== 1) {
    awaitingPlaybackAfterAutoTransition = false
    transitionTypeElement.textContent = '手動フォールバック'
    addLog(`「次を再生」でクリップ ${currentClipIndex + 1} を開始します。`, 'manual')
    player.playVideo()
    return
  }

  boundaryHandled = false
  addLog(`「次を再生」でクリップ ${currentClipIndex + 1} から次へ進みます。`, 'manual')
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
    script.onerror = () => reject(new Error('YouTube IFrame Player APIを読み込めませんでした。'))
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
        playerStateElement.textContent = '準備完了'
        loadVideoButton.disabled = false
        addClipButton.disabled = false
        playSequenceButton.disabled = false
        playSequenceButton.textContent = 'テストシーケンスを再生'
        addLog('YouTubeプレイヤーの準備ができました。再生には開始ボタンを押してください。', 'system')
      },
      onStateChange: (event) => handlePlayerStateChange(event.data),
      onError: (event) => {
        const detail = errorMessages[event.data] ?? `不明なYouTubeエラー（${event.data}）`
        manualVideoActive = false
        awaitingPlaybackAfterAutoTransition = false
        playerStateElement.textContent = 'エラー'
        addLog(`プレイヤーエラー: ${detail}。`, 'system')
      },
    },
  })
}

renderSequence()
renderClipList()
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
addClipButton.addEventListener('click', submitDraftClip)
cancelEditButton.addEventListener('click', () => cancelClipEdit(true))
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
    addLog(`クリップ ${currentClipIndex + 1} が設定した終了位置に達したため、次へ進みます。`, 'automatic')
    advanceToNext('automatic')
  }
}, 200)

loadYouTubeApi().then(initializePlayer).catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'YouTube IFrame Player APIを読み込めませんでした。'
  playerReady = false
  playerStateElement.textContent = 'APIの読み込みに失敗'
  loadVideoButton.disabled = true
  addClipButton.disabled = true
  playSequenceButton.textContent = 'プレイヤーを利用できません'
  addLog(message, 'system')
})
