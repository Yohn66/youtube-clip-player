import './style.css'
import {
  PLAYLIST_NAME_MAX_LENGTH,
  createClipId,
  createDefaultStoredData,
  createPlaylist,
  createStoredData,
  loadStoredData,
  saveStoredData,
  validateStoredData,
  type Clip,
  type Playlist,
  type StoredDataV1,
} from './storage'

type TestClip = {
  label: 'A' | 'B'
  videoId: string
  startSeconds: number
  endSeconds: number
}

type PlaybackClip = Pick<Clip, 'videoId' | 'startSeconds' | 'endSeconds'> & {
  label: string
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
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
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
      <section class="playlist-manager" aria-labelledby="playlist-manager-heading">
        <h2 id="playlist-manager-heading">Playlist / Pattern</h2>
        <label for="playlist-select">現在のPlaylist</label>
        <select id="playlist-select" aria-describedby="storage-message"></select>
        <div class="playlist-actions">
          <button id="create-playlist" class="secondary-button" type="button">新規</button>
          <button id="rename-playlist" class="secondary-button" type="button">名前変更</button>
          <button id="delete-playlist" class="secondary-button danger-button" type="button">削除</button>
        </div>
        <details class="data-tools">
          <summary>バックアップとデータ管理</summary>
          <div class="data-actions">
            <button id="export-backup" class="secondary-button" type="button">Backup</button>
            <button id="restore-backup" class="secondary-button" type="button">Restore</button>
            <button id="clear-all-data" class="secondary-button danger-button" type="button">Clear All</button>
          </div>
          <input id="backup-file-input" type="file" accept="application/json,.json" hidden />
          <p class="storage-note">データはこのブラウザ内に保存されます。SafariなどのWebサイトデータを削除すると消える場合があるため、大切なデータはBackupしてください。</p>
        </details>
        <p id="storage-message" class="storage-message" aria-live="polite"></p>
      </section>

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
          <output id="editor-current-time" class="editor-time-value">--:--</output>
        </div>

        <div class="mark-buttons">
          <button id="mark-in" class="mark-button" type="button" disabled>開始時間を設定</button>
          <button id="mark-out" class="mark-button" type="button" disabled>終了時間を設定</button>
        </div>

        <div class="mark-controls">
          <div class="mark-control">
            <div class="mark-value">
              <span>開始</span>
              <input
                id="draft-in-input"
                class="mark-time-input"
                type="text"
                inputmode="numeric"
                enterkeyhint="done"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                aria-label="開始時間"
                value="--:--"
                disabled
              />
            </div>
            <div class="adjustment-controls" role="group" aria-label="開始位置を調整">
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-5" disabled>-5</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="-1" disabled>-1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="1" disabled>+1</button>
              <button class="adjustment-button" type="button" data-adjust="in" data-delta="5" disabled>+5</button>
            </div>
          </div>
          <div class="mark-control">
            <div class="mark-value">
              <span>終了</span>
              <input
                id="draft-out-input"
                class="mark-time-input"
                type="text"
                inputmode="numeric"
                enterkeyhint="done"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                aria-label="終了時間"
                value="--:--"
                disabled
              />
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
          <div class="add-clip-action-row">
            <button id="add-clip" class="primary-button add-clip-button" type="button" disabled>
              クリップを追加
            </button>
            <p id="clip-count" class="clip-count" aria-live="polite">0件</p>
            <button id="play-all" class="secondary-button play-all-button" type="button" disabled>
              ▶ 再生
            </button>
          </div>
          <button id="cancel-edit" class="secondary-button cancel-edit-button" type="button" hidden>
            キャンセル
          </button>
          <p id="add-clip-message" class="add-clip-message" aria-live="polite"></p>
        </div>
      </section>

      <details class="test-controls">
        <summary>固定テスト</summary>
        <div class="controls">
          <button id="play-sequence" class="secondary-button" type="button" disabled>
            YouTubeプレイヤーを読み込み中…
          </button>
          <button id="play-next" class="secondary-button" type="button" disabled hidden>
            次を再生
          </button>
        </div>
      </details>
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

const playlistSelect = document.querySelector<HTMLSelectElement>('#playlist-select')!
const createPlaylistButton = document.querySelector<HTMLButtonElement>('#create-playlist')!
const renamePlaylistButton = document.querySelector<HTMLButtonElement>('#rename-playlist')!
const deletePlaylistButton = document.querySelector<HTMLButtonElement>('#delete-playlist')!
const exportBackupButton = document.querySelector<HTMLButtonElement>('#export-backup')!
const restoreBackupButton = document.querySelector<HTMLButtonElement>('#restore-backup')!
const clearAllDataButton = document.querySelector<HTMLButtonElement>('#clear-all-data')!
const backupFileInput = document.querySelector<HTMLInputElement>('#backup-file-input')!
const storageMessageElement = document.querySelector<HTMLElement>('#storage-message')!
const videoLoaderForm = document.querySelector<HTMLFormElement>('#video-loader')!
const youtubeUrlInput = document.querySelector<HTMLInputElement>('#youtube-url')!
const loadVideoButton = document.querySelector<HTMLButtonElement>('#load-video')!
const urlMessageElement = document.querySelector<HTMLElement>('#url-message')!
const playerFrameElement = document.querySelector<HTMLElement>('.player-frame')!
const editorCurrentTimeElement = document.querySelector<HTMLOutputElement>('#editor-current-time')!
const markInButton = document.querySelector<HTMLButtonElement>('#mark-in')!
const markOutButton = document.querySelector<HTMLButtonElement>('#mark-out')!
const draftInInput = document.querySelector<HTMLInputElement>('#draft-in-input')!
const draftOutInput = document.querySelector<HTMLInputElement>('#draft-out-input')!
const inAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="in"]')
const outAdjustmentButtons = document.querySelectorAll<HTMLButtonElement>('[data-adjust="out"]')
const editModeIndicatorElement = document.querySelector<HTMLElement>('#edit-mode-indicator')!
const addClipActionRowElement = document.querySelector<HTMLElement>('.add-clip-action-row')!
const addClipButton = document.querySelector<HTMLButtonElement>('#add-clip')!
const cancelEditButton = document.querySelector<HTMLButtonElement>('#cancel-edit')!
const addClipMessageElement = document.querySelector<HTMLElement>('#add-clip-message')!
const clipCountElement = document.querySelector<HTMLElement>('#clip-count')!
const clipListElement = document.querySelector<HTMLOListElement>('#clip-list')!
const playAllButton = document.querySelector<HTMLButtonElement>('#play-all')!
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
let editingClipId: string | null = null
let highlightedClipId: string | null = null
let highlightTimeoutId: number | undefined
let activeSequence: readonly PlaybackClip[] = []

const initialStorageLoad = loadStoredData()
let playlists = initialStorageLoad.data.playlists
let activePlaylistId = initialStorageLoad.data.activePlaylistId
let clips = getActivePlaylist().clips
const videoLabels = new Map<string, string>()

const UNSET_TIME = '--:--'
const CLIP_HIGHLIGHT_DURATION_MS = 4000
const MAX_BACKUP_FILE_SIZE_BYTES = 10 * 1024 * 1024

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

function getActivePlaylist(): Playlist {
  const playlist = playlists.find((candidate) => candidate.id === activePlaylistId)
  if (!playlist) throw new Error('Active playlist is missing')
  return playlist
}

function getStoredDataSnapshot(): StoredDataV1 {
  return createStoredData(playlists, activePlaylistId)
}

function showStorageMessage(message: string, isError = false): void {
  storageMessageElement.textContent = message
  storageMessageElement.classList.toggle('storage-message-error', isError)
}

function persistData(): boolean {
  const error = saveStoredData(getStoredDataSnapshot())
  if (error) {
    showStorageMessage(error, true)
    return false
  }

  return true
}

function rebuildVideoLabels(): void {
  videoLabels.clear()
  playlists.forEach((playlist) => {
    playlist.clips.forEach((clip) => getVideoLabel(clip.videoId))
  })
}

function renderPlaylistManager(): void {
  playlistSelect.innerHTML = ''
  playlists.forEach((playlist) => {
    const option = document.createElement('option')
    option.value = playlist.id
    option.textContent = `${playlist.name}（${playlist.clips.length}件）`
    playlistSelect.append(option)
  })
  playlistSelect.value = activePlaylistId
}

function resetTransientStateForPlaylistChange(): void {
  if (highlightTimeoutId !== undefined) window.clearTimeout(highlightTimeoutId)
  highlightTimeoutId = undefined
  highlightedClipId = null
  editingClipId = null
  clearAddClipValidation()
  resetDraftMarks()
  sequenceStarted = false
  currentClipIndex = -1
  boundaryHandled = false
  activeClipHasPlayed = false
  awaitingPlaybackAfterAutoTransition = false
  activeSequence = []
  loadGeneration += 1
  playNextButton.disabled = true
  clipNumberElement.textContent = '未開始'
  clipRangeElement.textContent = '—'
  currentPositionElement.textContent = '—'
  transitionTypeElement.textContent = 'Playlist切り替え'
}

function applyStoredData(data: StoredDataV1): void {
  playlists = data.playlists
  activePlaylistId = data.activePlaylistId
  clips = getActivePlaylist().clips
  rebuildVideoLabels()
  resetTransientStateForPlaylistChange()
  renderPlaylistManager()
  renderClipList()
}

function switchActivePlaylist(playlistId: string): void {
  const playlist = playlists.find((candidate) => candidate.id === playlistId)
  if (!playlist || playlist.id === activePlaylistId) return

  activePlaylistId = playlist.id
  clips = playlist.clips
  resetTransientStateForPlaylistChange()
  persistData()
  renderPlaylistManager()
  renderClipList()
}

function getNextPlaylistName(): string {
  const names = new Set(playlists.map((playlist) => playlist.name))
  let number = 1
  while (names.has(`Pattern ${number}`)) number += 1
  return `Pattern ${number}`
}

function normalizePlaylistName(value: string | null): string | undefined {
  if (value === null) return undefined

  const name = value.trim()
  if (name.length === 0) {
    showStorageMessage('Playlist名を入力してください。', true)
    return undefined
  }

  if (name.length > PLAYLIST_NAME_MAX_LENGTH) {
    showStorageMessage(`Playlist名は${PLAYLIST_NAME_MAX_LENGTH}文字以内にしてください。`, true)
    return undefined
  }

  return name
}

function addPlaylist(): void {
  const name = normalizePlaylistName(window.prompt('新しいPlaylist名', getNextPlaylistName()))
  if (!name) return

  const playlist = createPlaylist(name)
  playlists.push(playlist)
  activePlaylistId = playlist.id
  clips = playlist.clips
  resetTransientStateForPlaylistChange()
  persistData()
  renderPlaylistManager()
  renderClipList()
}

function renameActivePlaylist(): void {
  const playlist = getActivePlaylist()
  const name = normalizePlaylistName(window.prompt('Playlist名を変更', playlist.name))
  if (!name || name === playlist.name) return

  playlist.name = name
  persistData()
  renderPlaylistManager()
}

function deleteActivePlaylist(): void {
  const playlistIndex = playlists.findIndex((playlist) => playlist.id === activePlaylistId)
  const playlist = playlists[playlistIndex]
  if (!playlist) return

  if (!window.confirm(`「${playlist.name}」と中のClipを削除しますか？`)) return

  playlists.splice(playlistIndex, 1)
  if (playlists.length === 0) {
    playlists.push(createPlaylist('Pattern 1'))
  }

  const nextPlaylist = playlists[Math.min(playlistIndex, playlists.length - 1)]
  activePlaylistId = nextPlaylist.id
  clips = nextPlaylist.clips
  resetTransientStateForPlaylistChange()
  persistData()
  renderPlaylistManager()
  renderClipList()
}

function formatBackupDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function exportBackup(): void {
  try {
    const contents = JSON.stringify(getStoredDataSnapshot(), null, 2)
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `youtube-clip-player-backup-${formatBackupDate(new Date())}.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    showStorageMessage('全PlaylistのBackupを作成しました。')
  } catch {
    showStorageMessage('Backupファイルを作成できませんでした。', true)
  }
}

async function restoreBackupFromFile(): Promise<void> {
  const file = backupFileInput.files?.[0]
  backupFileInput.value = ''
  if (!file) return

  if (file.size > MAX_BACKUP_FILE_SIZE_BYTES) {
    showStorageMessage('Backupファイルが大きすぎます。', true)
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    showStorageMessage('Backup JSONを読み込めませんでした。現在のデータは変更されていません。', true)
    return
  }

  const validated = validateStoredData(parsed)
  if (!validated.ok) {
    showStorageMessage(`${validated.message} 現在のデータは変更されていません。`, true)
    return
  }

  if (!window.confirm('現在の全PlaylistをBackupの内容で置き換えますか？')) return

  const error = saveStoredData(validated.data)
  if (error) {
    showStorageMessage(`${error} 現在のデータは変更されていません。`, true)
    return
  }

  applyStoredData(validated.data)
  showStorageMessage('Backupを復元しました。')
}

function clearAllData(): void {
  if (!window.confirm('保存されている全PlaylistとClipを削除しますか？')) return

  const emptyData = createDefaultStoredData()
  const error = saveStoredData(emptyData)
  if (error) {
    showStorageMessage(`${error} 現在のデータは変更されていません。`, true)
    return
  }

  applyStoredData(emptyData)
  showStorageMessage('全データを削除し、空のPlaylistを作成しました。')
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

function toWholeSeconds(value: number): number {
  return Math.max(0, Math.floor(value))
}

function formatEditorTime(value: number): string {
  const totalSeconds = toWholeSeconds(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function resetDraftMarks(): void {
  draftInSeconds = undefined
  draftOutSeconds = undefined
  draftInInput.value = UNSET_TIME
  draftOutInput.value = UNSET_TIME
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
    addClipActionRowElement.classList.remove('editing')
    clipCountElement.hidden = false
    cancelEditButton.hidden = true
    playAllButton.disabled = !playerReady || clips.length === 0
    playSequenceButton.disabled = !playerReady
    return
  }

  const clipIndex = clips.findIndex((clip) => clip.id === editingClipId)
  editModeIndicatorElement.hidden = false
  editModeIndicatorElement.textContent =
    clipIndex === -1 ? '編集中のクリップはありません' : `クリップ ${clipIndex + 1} を編集中`
  addClipButton.textContent = '変更を保存'
  addClipActionRowElement.classList.add('editing')
  clipCountElement.hidden = true
  cancelEditButton.hidden = false
  playAllButton.disabled = true
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

  const currentTime = player.getCurrentTime()
  if (!Number.isFinite(currentTime) || currentTime < 0) return undefined

  const seconds = toWholeSeconds(currentTime)
  currentPlaybackSeconds = seconds
  editorCurrentTimeElement.textContent = formatEditorTime(seconds)
  return seconds
}

function markDraftIn(): void {
  const seconds = readEditorPlaybackTime()
  if (seconds === undefined) return

  draftInSeconds = seconds
  draftInInput.value = formatEditorTime(draftInSeconds)
  inAdjustmentButtons.forEach((button) => (button.disabled = false))
  clearAddClipValidation()
}

function markDraftOut(): void {
  const seconds = readEditorPlaybackTime()
  if (seconds === undefined) return

  draftOutSeconds = seconds
  draftOutInput.value = formatEditorTime(draftOutSeconds)
  outAdjustmentButtons.forEach((button) => (button.disabled = false))
  clearAddClipValidation()
}

function parseDirectTimestamp(value: string): number | undefined {
  const normalizedValue = value.trim()
  if (!normalizedValue) return undefined

  let hours = 0
  let minutes = 0
  let seconds = 0

  if (normalizedValue.includes(':')) {
    const parts = normalizedValue.split(':')
    if ((parts.length !== 2 && parts.length !== 3) || parts.some((part) => !/^\d+$/.test(part))) {
      return undefined
    }

    if (parts.length === 2) {
      minutes = Number(parts[0])
      seconds = Number(parts[1])
    } else {
      hours = Number(parts[0])
      minutes = Number(parts[1])
      seconds = Number(parts[2])
    }
  } else {
    if (!/^\d+$/.test(normalizedValue)) return undefined

    seconds = Number(normalizedValue.slice(-2))
    minutes = Number(normalizedValue.slice(-4, -2) || '0')
    hours = Number(normalizedValue.slice(0, -4) || '0')
  }

  if (minutes >= 60 || seconds >= 60) return undefined

  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  return Number.isSafeInteger(totalSeconds) ? totalSeconds : undefined
}

function getDraftTimestamp(target: 'in' | 'out'): number | undefined {
  return target === 'in' ? draftInSeconds : draftOutSeconds
}

function restoreDirectTimestampInput(target: 'in' | 'out', input: HTMLInputElement): void {
  const seconds = getDraftTimestamp(target)
  input.value = seconds === undefined ? UNSET_TIME : formatEditorTime(seconds)
}

function commitDirectTimestampInput(
  target: 'in' | 'out',
  input: HTMLInputElement,
): void {
  if (input.dataset.skipCommit === 'true') {
    delete input.dataset.skipCommit
    return
  }

  const seconds = parseDirectTimestamp(input.value)

  if (seconds === undefined) {
    restoreDirectTimestampInput(target, input)
    input.setAttribute('aria-invalid', 'true')
    addClipMessageElement.textContent =
      '時刻をMM:SS、H:MM:SS、または数字で入力してください（分・秒は00〜59）。'
    return
  }

  if (target === 'in') {
    draftInSeconds = seconds
    inAdjustmentButtons.forEach((adjustmentButton) => (adjustmentButton.disabled = false))
  } else {
    draftOutSeconds = seconds
    outAdjustmentButtons.forEach((adjustmentButton) => (adjustmentButton.disabled = false))
  }

  input.value = formatEditorTime(seconds)
  input.removeAttribute('aria-invalid')
  currentPlaybackSeconds = seconds
  editorCurrentTimeElement.textContent = formatEditorTime(seconds)
  clearAddClipValidation()
  if (player && playerReady) player.seekTo(seconds, true)
}

function handleDirectTimestampKeydown(
  event: KeyboardEvent,
  target: 'in' | 'out',
  input: HTMLInputElement,
): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    input.blur()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    restoreDirectTimestampInput(target, input)
    input.removeAttribute('aria-invalid')
    input.dataset.skipCommit = 'true'
    input.blur()
  }
}

function adjustDraftIn(deltaSeconds: number): void {
  if (draftInSeconds === undefined) return

  draftInSeconds = Math.max(0, draftInSeconds + deltaSeconds)
  draftInInput.value = formatEditorTime(draftInSeconds)
  clearAddClipValidation()
}

function adjustDraftOut(deltaSeconds: number): void {
  if (draftOutSeconds === undefined) return

  draftOutSeconds = Math.max(0, draftOutSeconds + deltaSeconds)
  draftOutInput.value = formatEditorTime(draftOutSeconds)
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
  persistData()
  renderClipList()
  highlightClip(clip.id)
}

function deleteClip(index: number): void {
  const clip = clips[index]
  if (!clip) return

  clips.splice(index, 1)
  if (highlightedClipId === clip.id) clearClipHighlight()
  persistData()
  renderPlaylistManager()
  renderClipList()
}

function renderClipList(): void {
  clipCountElement.textContent = `${clips.length}件`
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
  currentPlaybackSeconds = toWholeSeconds(clip.startSeconds)
  draftInSeconds = toWholeSeconds(clip.startSeconds)
  draftOutSeconds = toWholeSeconds(clip.endSeconds)
  editorCurrentTimeElement.textContent = formatEditorTime(currentPlaybackSeconds)
  draftInInput.value = formatEditorTime(draftInSeconds)
  draftOutInput.value = formatEditorTime(draftOutSeconds)
  markInButton.disabled = false
  markOutButton.disabled = false
  draftInInput.disabled = false
  draftOutInput.disabled = false
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

  player.cueVideoById({ videoId: clip.videoId, startSeconds: draftInSeconds })
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

  const startSeconds = toWholeSeconds(draftInSeconds)
  const endSeconds = toWholeSeconds(draftOutSeconds)

  if (endSeconds <= startSeconds) {
    addClipMessageElement.textContent = '終了は開始より後に設定してください。'
    return
  }

  clip.startSeconds = startSeconds
  clip.endSeconds = endSeconds
  persistData()

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

  const startSeconds = toWholeSeconds(draftInSeconds)
  const endSeconds = toWholeSeconds(draftOutSeconds)

  if (endSeconds <= startSeconds) {
    addClipMessageElement.textContent = '終了は開始より後に設定してください。'
    return
  }

  clips.push({
    id: createClipId(),
    videoId: editorVideoId,
    startSeconds,
    endSeconds,
  })
  persistData()

  clearAddClipValidation()
  resetDraftMarks()
  renderPlaylistManager()
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
  draftInInput.disabled = false
  draftOutInput.disabled = false
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
  return formatEditorTime(value)
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
  const clip = activeSequence[currentClipIndex]
  clipNumberElement.textContent = `${currentClipIndex + 1} / ${activeSequence.length}（${clip.label}）`
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

  if (index >= activeSequence.length) {
    sequenceStarted = false
    awaitingPlaybackAfterAutoTransition = false
    playNextButton.disabled = true
    transitionTypeElement.textContent = transition === 'manual' ? '手動 — 完了' : '自動 — 完了'
    addLog(
      'クリップの連続再生が完了しました。',
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
  const clip = activeSequence[index]
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
    `クリップ ${index + 1}（${clip.label}、${formatSeconds(clip.startSeconds)}–${formatSeconds(clip.endSeconds)}）を読み込みました。`,
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
    player.getVideoData().video_id === activeSequence[currentClipIndex]?.videoId
  ) {
    activeClipHasPlayed = true
  }

  if (state === 1 && awaitingPlaybackAfterAutoTransition) {
    awaitingPlaybackAfterAutoTransition = false
    addLog(`自動切り替え後にクリップ ${currentClipIndex + 1} の再生が始まりました。`, 'automatic')
  }

  if (state === 0 && sequenceStarted && activeClipHasPlayed && !boundaryHandled && player) {
    const activeClip = activeSequence[currentClipIndex]
    const endedVideoId = player.getVideoData().video_id

    // Ignore a late ENDED event from the previous video after the next clip has loaded.
    if (!endedVideoId || endedVideoId === activeClip.videoId) {
      addLog(`クリップ ${currentClipIndex + 1} の終了を検出し、次へ進みます。`, 'automatic')
      advanceToNext('automatic')
    }
  }
}

function startSequence(sequence: readonly PlaybackClip[], startMessage: string): void {
  if (!player || sequence.length === 0) return

  activeSequence = sequence
  sequenceStarted = true
  manualVideoActive = false
  markInButton.disabled = false
  markOutButton.disabled = false
  currentClipIndex = -1
  addLog(startMessage, 'manual')
  loadClip(0, 'start')
}

function startUserSequence(): void {
  if (editingClipId !== null || clips.length === 0) return

  const userSequence = clips.map((clip) => ({
    videoId: clip.videoId,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
    label: getVideoLabel(clip.videoId),
  }))

  startSequence(userSequence, '現在のクリップ一覧をクリップ 1 から再生します。')
}

function startTestSequence(): void {
  const problems = validateTestClips()
  if (problems.length > 0) {
    playerStateElement.textContent = 'テストデータが必要です'
    problems.forEach((problem) => addLog(problem, 'system'))
    return
  }

  const testSequence = TEST_CLIPS.map((clip) => ({
    videoId: clip.videoId,
    startSeconds: clip.startSeconds,
    endSeconds: clip.endSeconds,
    label: `動画 ${clip.label}`,
  }))

  startSequence(testSequence, 'テストシーケンスをクリップ 1 から開始します。')
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
        playAllButton.disabled = clips.length === 0
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

rebuildVideoLabels()
renderPlaylistManager()
renderSequence()
renderClipList()
if (initialStorageLoad.status === 'missing') {
  persistData()
} else if (initialStorageLoad.message) {
  showStorageMessage(initialStorageLoad.message, true)
}
playlistSelect.addEventListener('change', () => switchActivePlaylist(playlistSelect.value))
createPlaylistButton.addEventListener('click', addPlaylist)
renamePlaylistButton.addEventListener('click', renameActivePlaylist)
deletePlaylistButton.addEventListener('click', deleteActivePlaylist)
exportBackupButton.addEventListener('click', exportBackup)
restoreBackupButton.addEventListener('click', () => backupFileInput.click())
backupFileInput.addEventListener('change', () => void restoreBackupFromFile())
clearAllDataButton.addEventListener('click', clearAllData)
videoLoaderForm.addEventListener('submit', loadEnteredVideo)
youtubeUrlInput.addEventListener('input', clearUrlValidation)
markInButton.addEventListener('click', markDraftIn)
markOutButton.addEventListener('click', markDraftOut)
draftInInput.addEventListener('focus', () => {
  draftInInput.value = formatEditorTime(draftInSeconds ?? currentPlaybackSeconds ?? 0)
  draftInInput.removeAttribute('aria-invalid')
  draftInInput.select()
})
draftOutInput.addEventListener('focus', () => {
  draftOutInput.value = formatEditorTime(draftOutSeconds ?? currentPlaybackSeconds ?? 0)
  draftOutInput.removeAttribute('aria-invalid')
  draftOutInput.select()
})
draftInInput.addEventListener('keydown', (event) =>
  handleDirectTimestampKeydown(event, 'in', draftInInput),
)
draftOutInput.addEventListener('keydown', (event) =>
  handleDirectTimestampKeydown(event, 'out', draftOutInput),
)
draftInInput.addEventListener('blur', () => commitDirectTimestampInput('in', draftInInput))
draftOutInput.addEventListener('blur', () => commitDirectTimestampInput('out', draftOutInput))
inAdjustmentButtons.forEach((button) => {
  button.addEventListener('click', () => adjustDraftIn(Number(button.dataset.delta)))
})
outAdjustmentButtons.forEach((button) => {
  button.addEventListener('click', () => adjustDraftOut(Number(button.dataset.delta)))
})
addClipButton.addEventListener('click', submitDraftClip)
cancelEditButton.addEventListener('click', () => cancelClipEdit(true))
playAllButton.addEventListener('click', startUserSequence)
playSequenceButton.addEventListener('click', startTestSequence)
playNextButton.addEventListener('click', playNextManually)

window.setInterval(() => {
  if (!editorVideoId && !sequenceStarted) return
  readEditorPlaybackTime()
}, 100)

window.setInterval(() => {
  if (!player || !sequenceStarted || currentClipIndex < 0) return

  const currentTime = player.getCurrentTime()
  const activeClip = activeSequence[currentClipIndex]
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
  playAllButton.disabled = true
  playSequenceButton.textContent = 'プレイヤーを利用できません'
  addLog(message, 'system')
})
