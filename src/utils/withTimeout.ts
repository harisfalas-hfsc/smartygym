export class RequestTimeoutError extends Error {
  constructor(message = "The request took too long. Please check your connection and try again.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export async function withTimeout<T>(
  request: PromiseLike<T>,
  timeoutMs = 15000,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new RequestTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}