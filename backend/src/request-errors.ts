import type { ErrorRequestHandler } from "express";

const requestErrors = {
  400: { code: "INVALID_JSON", message: "Send a valid JSON request body." },
  413: { code: "REQUEST_TOO_LARGE", message: "The request body must be at most 2 KB." },
  415: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Send supported UTF-8 JSON." },
} as const;

export const requestErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (typeof error === "object" && error !== null && "status" in error) {
    const status = error.status;

    if (status === 400 || status === 413 || status === 415) {
      res.status(status).json({ error: requestErrors[status] });
      return;
    }
  }

  console.error(
    "Unexpected request error:",
    error instanceof Error ? error.message : "Unknown error"
  );
  res.status(500).json({
    error: { code: "SERVER_ERROR", message: "Unable to process the request." },
  });
};
