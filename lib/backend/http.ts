import type { IncomingMessage, ServerResponse } from 'node:http';

export type VercelRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  body: unknown;
};

export type VercelResponse = ServerResponse & {
  status(statusCode: number): VercelResponse;
  json(body: unknown): VercelResponse;
};

export function sendJson(response: VercelResponse, status: number, body: unknown): void {
  response.status(status).json(body);
}

export function bearerToken(request: VercelRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;

  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function requestBody(request: VercelRequest): Record<string, unknown> | null {
  const body: unknown = request.body;

  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isRecord(body) ? body : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function queryString(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
