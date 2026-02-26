import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, ServerMessage } from '../../shared/ide-types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed'

interface UseSessionSocketOptions {
  onMessage: (msg: ServerMessage) => void
}

const MAX_RECONNECT_ATTEMPTS = 5
const BASE_DELAY_MS = 1000

export function useSessionSocket({ onMessage }: UseSessionSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws`

    setStatus('connecting')
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setStatus('connected')
      reconnectAttemptRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage
        onMessageRef.current(msg)
      } catch {
        console.error('[ws] unparseable message:', event.data)
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      setStatus('disconnected')

      // Auto-reconnect with exponential backoff
      if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_DELAY_MS * 2 ** reconnectAttemptRef.current
        reconnectAttemptRef.current++
        reconnectTimerRef.current = setTimeout(connect, delay)
      } else {
        setStatus('failed')
      }
    }

    ws.onerror = () => {
      // onclose will fire after onerror
    }

    wsRef.current = ws
  }, [])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.onclose = null // Prevent reconnect on intentional close
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return { status, send }
}
