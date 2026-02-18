// Shared types used by both server and client

export interface ChangedFile {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed'
  additions?: number
  deletions?: number
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

export type ViewMode = 'code' | 'diff'
export type CompletionType = 'submitted' | 'cancelled'
export type AnnotationKind = 'action' | 'question'
