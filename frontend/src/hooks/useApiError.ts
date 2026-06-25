import { useState, useCallback } from "react";

export function useApiError() {
  const [error, setError] = useState<string | null>(null);

  const handleApiError = useCallback((err: unknown) => {
    console.error("API Error caught:", err);
    if (err instanceof Error) {
      setError(err.message);
    } else if (typeof err === "string") {
      setError(err);
    } else if (err && typeof err === "object" && "detail" in err) {
      setError(String((err as { detail: unknown }).detail));
    } else {
      setError("Đã xảy ra lỗi không xác định từ máy chủ.");
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, setError, handleApiError, clearError };
}
