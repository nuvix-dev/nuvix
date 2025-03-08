import { SetMetadata } from '@nestjs/common';

export type LabelKey = '*' | 'res.type' | 'res.status';

enum ResType {
  JSON = 'json',
  XML = 'xml',
  TEXT = 'text',
  HTML = 'html',
  BLOB = 'blob',
  ARRAY_BUFFER = 'arrayBuffer',
  FORM_DATA = 'formData',
}

enum ResStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  SEE_OTHER = 303,
  NOT_MODIFIED = 304,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  GONE = 410,
  LENGTH_REQUIRED = 411,
  PRECONDITION_FAILED = 412,
  PAYLOAD_TOO_LARGE = 413,
  UNSUPPORTED_MEDIA_TYPE = 415,
  RANGE_NOT_SATISFIABLE = 416,
  EXPECTATION_FAILED = 417,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

export type LabelValue = {
  '*': string;
  'res.type': keyof typeof ResType;
  'res.status': keyof typeof ResStatus;
};

export const Label = <K extends LabelKey>(key: K, value: LabelValue[K]) =>
  SetMetadata(key, value);
