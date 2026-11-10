export type ErrorCode =
  | "VALIDATION_ERROR"
  | "SLOT_CONFLICT"
  | "IDEMPOTENCY_MISMATCH"
  | "ROOM_UNAVAILABLE"
  | "FORBIDDEN"
  | "QUOTA_EXCEEDED"
  | "INVALID_STATE"
  | "UNAUTHORIZED"
  | "NOT_FOUND";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly field: string | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number,
    field?: string,
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.field = field;
  }
}

export function validationError(message: string, field?: string): DomainError {
  return new DomainError("VALIDATION_ERROR", message, 422, field);
}
