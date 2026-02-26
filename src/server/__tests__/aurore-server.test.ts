import { describe, expect, it } from 'bun:test'
import { extractPathParam, isLocalOrigin } from '../aurore-server'

// -- Helpers --

function requestWithOrigin(origin: string | null): Request {
  const headers = new Headers()
  if (origin !== null) {
    headers.set('Origin', origin)
  }
  return new Request('http://localhost:9847/', { headers })
}

// -- Tests --

describe('isLocalOrigin', () => {
  it('returns true when no Origin header (non-browser client)', () => {
    expect(isLocalOrigin(requestWithOrigin(null), 9847)).toBe(true)
  })

  it('returns true for http://localhost with matching port', () => {
    expect(isLocalOrigin(requestWithOrigin('http://localhost:9847'), 9847)).toBe(true)
  })

  it('returns true for http://127.0.0.1 with matching port', () => {
    expect(isLocalOrigin(requestWithOrigin('http://127.0.0.1:9847'), 9847)).toBe(true)
  })

  it('returns false for localhost with wrong port', () => {
    expect(isLocalOrigin(requestWithOrigin('http://localhost:3000'), 9847)).toBe(false)
  })

  it('returns false for external origin', () => {
    expect(isLocalOrigin(requestWithOrigin('http://evil.com'), 9847)).toBe(false)
  })

  it('returns false for substring attack (localhost in subdomain)', () => {
    expect(isLocalOrigin(requestWithOrigin('http://localhost:9847.evil.com'), 9847)).toBe(false)
  })
})

describe('extractPathParam', () => {
  it('extracts simple path after prefix', () => {
    const url = new URL('http://localhost:9847/api/file/src/index.ts')
    expect(extractPathParam(url, '/api/file/')).toBe('src/index.ts')
  })

  it('decodes URL-encoded path segments', () => {
    const url = new URL('http://localhost:9847/api/file/src/my%20file.ts')
    expect(extractPathParam(url, '/api/file/')).toBe('src/my file.ts')
  })

  it('extracts nested path with different prefix', () => {
    const url = new URL('http://localhost:9847/api/git/original/a/b/c.ts')
    expect(extractPathParam(url, '/api/git/original/')).toBe('a/b/c.ts')
  })
})
