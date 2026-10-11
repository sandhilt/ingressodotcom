export class NotFoundError extends Error {
  constructor(message = 'Content not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class UpstreamError extends Error {
  readonly status: number;
  readonly bodyExcerpt: string;
  constructor(status: number, bodyExcerpt: string) {
    super(`Upstream request failed (${status})`);
    this.name = 'UpstreamError';
    this.status = status;
    this.bodyExcerpt = bodyExcerpt.slice(0, 500);
  }
}
