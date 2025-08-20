export interface RetryOptions {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number; // exponential backoff factor
  jitter?: boolean;
  retryOn?: (error: any) => boolean | Promise<boolean>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    minDelayMs = 300,
    maxDelayMs = 4000,
    factor = 2,
    jitter = true,
    retryOn = defaultRetryOn,
  }: RetryOptions = {}
): Promise<T> {
  let attempt = 0;
  let lastErr: any;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const should = await retryOn(err);
      if (!should || attempt === retries) throw err;

      const backoff = Math.min(minDelayMs * Math.pow(factor, attempt), maxDelayMs);
      const delay = jitter ? Math.random() * backoff : backoff;
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
    }
  }
  throw lastErr;
}

function defaultRetryOn(error: any): boolean {
  if (!error) return false;
  // If it's a Response-like error
  const status: number | undefined = (error as any)?.status ?? (error as any)?.response?.status;
  if (typeof status === 'number') {
    // Retry on 429 and 5xx
    return status === 429 || (status >= 500 && status < 600);
  }
  return false;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RetryOptions
): Promise<Response> {
  return withRetry<Response>(async () => {
    const res = await fetch(input, init);
    if (!res.ok) {
      const err: any = new Error(`HTTP ${res.status}`);
      (err as any).status = res.status;
      (err as any).response = res;
      throw err;
    }
    return res;
  }, options);
}
