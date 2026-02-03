// src/utils/api.js
export async function queryLocalModel(url) {
  try {
    const resp = await fetch("http://127.0.0.1:5000/predict_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    if (!resp.ok) {
      const j = await resp.json().catch(() => null);
      throw new Error("Model error: " + (j ? JSON.stringify(j) : resp.status));
    }
    return await resp.json();
  } catch (err) {
    // Distinguish between network errors and other errors
    if (err.name === 'TypeError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      const serverError = new Error('SERVER_OFFLINE');
      serverError.originalError = err;
      throw serverError;
    }
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const timeoutError = new Error('SERVER_TIMEOUT');
      timeoutError.originalError = err;
      throw timeoutError;
    }
    throw err;
  }
}
