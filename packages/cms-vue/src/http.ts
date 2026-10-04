/**
 * Minimal JSON client for the CMS endpoints. Sends the XSRF cookie back as
 * a header, the same way Inertia/axios does.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, any>
  ) {
    super(message)
  }
}

function xsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export async function api<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'X-XSRF-TOKEN': xsrfToken(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      json.errors?.[0]?.message ?? json.message ?? `Request failed (${response.status})`
    throw new ApiError(message, response.status, json)
  }
  return json as T
}
