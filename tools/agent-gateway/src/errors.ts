export type ErrorType =
  | 'invalid_request_error'
  | 'authentication_error'
  | 'not_found_error'
  | 'api_error'
  | 'overloaded_error';

export class GatewayError extends Error {
  readonly status: number;
  readonly type: ErrorType;

  constructor(status: number, type: ErrorType, message: string) {
    super(message);
    this.status = status;
    this.type = type;
  }

  static invalid(message: string): GatewayError {
    return new GatewayError(400, 'invalid_request_error', message);
  }

  static unsupported(what: string): GatewayError {
    return GatewayError.invalid(`${what} is not supported by the agent gateway.`);
  }

  body(requestId: string): ErrorBody {
    return {
      type: 'error',
      error: { type: this.type, message: this.message },
      request_id: requestId,
    };
  }
}

export type ErrorBody = {
  type: 'error';
  error: { type: ErrorType; message: string };
  request_id: string;
};
