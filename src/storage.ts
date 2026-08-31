export type Clip = {
  id: string
  videoId: string
  startSeconds: number
  endSeconds: number
}

export type Playlist = {
  id: string
  name: string
  clips: Clip[]
}

export type StoredDataV1 = {
  version: 1
  playlists: Playlist[]
  activePlaylistId: string
}

export type StorageLoadResult = {
  data: StoredDataV1
  status: 'loaded' | 'missing' | 'invalid' | 'unavailable'
  message?: string
}

type ValidationResult =
  | { ok: true; data: StoredDataV1 }
  | { ok: false; message: string }

export const STORAGE_KEY = 'youtube-clip-player:data'
export const PLAYLIST_NAME_MAX_LENGTH = 80

const STORAGE_VERSION = 1
const MAX_PLAYLISTS = 100
const MAX_CLIPS_PER_PLAYLIST = 2000
const ID_MAX_LENGTH = 200
let generatedIdCounter = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= ID_MAX_LENGTH &&
    /^[A-Za-z0-9_-]+$/.test(value)
  )
}

function createLocalId(prefix: 'playlist' | 'clip'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`
  }

  generatedIdCounter += 1
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${generatedIdCounter}-${randomPart}`
}

export function createClipId(): string {
  return createLocalId('clip')
}

export function createPlaylist(name: string): Playlist {
  return {
    id: createLocalId('playlist'),
    name,
    clips: [],
  }
}

export function createDefaultStoredData(): StoredDataV1 {
  const playlist = createPlaylist('Pattern 1')
  return {
    version: STORAGE_VERSION,
    playlists: [playlist],
    activePlaylistId: playlist.id,
  }
}

export function createStoredData(
  playlists: Playlist[],
  activePlaylistId: string,
): StoredDataV1 {
  return {
    version: STORAGE_VERSION,
    playlists,
    activePlaylistId,
  }
}

export function validateStoredData(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, message: '保存データの形式が正しくありません。' }
  }

  if (value.version !== STORAGE_VERSION) {
    return { ok: false, message: 'このバージョンの保存データには対応していません。' }
  }

  if (!Array.isArray(value.playlists) || value.playlists.length === 0) {
    return { ok: false, message: 'Playlistが1つ以上必要です。' }
  }

  if (value.playlists.length > MAX_PLAYLISTS) {
    return { ok: false, message: 'Playlistの数が多すぎます。' }
  }

  const playlistIds = new Set<string>()
  const playlists: Playlist[] = []

  for (const playlistValue of value.playlists) {
    if (!isRecord(playlistValue)) {
      return { ok: false, message: 'Playlistの形式が正しくありません。' }
    }

    const { id, name, clips: clipValues } = playlistValue
    if (!isValidId(id) || playlistIds.has(id)) {
      return { ok: false, message: 'Playlist IDが不正または重複しています。' }
    }

    if (
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      name.length > PLAYLIST_NAME_MAX_LENGTH
    ) {
      return { ok: false, message: 'Playlist名が不正です。' }
    }

    if (!Array.isArray(clipValues) || clipValues.length > MAX_CLIPS_PER_PLAYLIST) {
      return { ok: false, message: 'Playlist内のClip一覧が不正です。' }
    }

    const clipIds = new Set<string>()
    const clips: Clip[] = []

    for (const clipValue of clipValues) {
      if (!isRecord(clipValue)) {
        return { ok: false, message: 'Clipの形式が正しくありません。' }
      }

      const { id: clipId, videoId, startSeconds, endSeconds } = clipValue
      if (!isValidId(clipId) || clipIds.has(clipId)) {
        return { ok: false, message: 'Clip IDが不正または重複しています。' }
      }

      if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return { ok: false, message: 'ClipのvideoIdが不正です。' }
      }

      if (
        typeof startSeconds !== 'number' ||
        typeof endSeconds !== 'number' ||
        !Number.isInteger(startSeconds) ||
        !Number.isInteger(endSeconds) ||
        startSeconds < 0 ||
        endSeconds <= startSeconds
      ) {
        return { ok: false, message: 'Clipの開始・終了時間が不正です。' }
      }

      clipIds.add(clipId)
      clips.push({ id: clipId, videoId, startSeconds, endSeconds })
    }

    playlistIds.add(id)
    playlists.push({ id, name: name.trim(), clips })
  }

  if (typeof value.activePlaylistId !== 'string' || !playlistIds.has(value.activePlaylistId)) {
    return { ok: false, message: '選択中のPlaylistが存在しません。' }
  }

  return {
    ok: true,
    data: {
      version: STORAGE_VERSION,
      playlists,
      activePlaylistId: value.activePlaylistId,
    },
  }
}

export function loadStoredData(): StorageLoadResult {
  let serialized: string | null

  try {
    serialized = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return {
      data: createDefaultStoredData(),
      status: 'unavailable',
      message: 'このブラウザではローカル保存を利用できません。',
    }
  }

  if (serialized === null) {
    return { data: createDefaultStoredData(), status: 'missing' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    return {
      data: createDefaultStoredData(),
      status: 'invalid',
      message: '保存データを読み込めなかったため、新しいPlaylistで開始しました。',
    }
  }

  const validated = validateStoredData(parsed)
  if (!validated.ok) {
    return {
      data: createDefaultStoredData(),
      status: 'invalid',
      message: `${validated.message} 新しいPlaylistで開始しました。`,
    }
  }

  return { data: validated.data, status: 'loaded' }
}

export function saveStoredData(data: StoredDataV1): string | undefined {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return undefined
  } catch {
    return '保存に失敗しました。ブラウザの空き容量やサイトデータ設定を確認してください。'
  }
}
