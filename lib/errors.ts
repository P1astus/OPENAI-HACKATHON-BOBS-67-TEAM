/** An error that maps straight to an HTTP status and a readable `{ error }` body. */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** 409 unless the ticket/invoice is in an allowed state. */
export function requireState(condition: boolean, message: string): asserts condition {
  if (!condition) throw conflict(message);
}
