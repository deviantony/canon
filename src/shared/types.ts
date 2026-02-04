// Shared types used by both server and client

export interface ChangedFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
}

export interface GitInfo {
  changedFiles: ChangedFile[]
}

export interface FileNode {
  id: string
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  status?: ChangedFile['status']
}

export interface FeedbackResult {
  feedback: string
  cancelled: boolean
}
