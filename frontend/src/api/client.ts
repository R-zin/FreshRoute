import { OptimizeRequest, OptimizeResponse } from "../types/api";
import {
  DEFAULT_FALLBACK_RESPONSE,
  simulateFallbackOptimize,
} from "../mocks/fallbackData";

const rawBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.DEV
    ? "http://localhost:8000/api/v1"
    : "https://perishopt-backend.onrender.com/api/v1");

export const API_BASE_URL: string = rawBaseUrl.endsWith("/api/v1")
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, "")}/api/v1`;

const DEFAULT_TIMEOUT_MS = 30000; // 30s to accommodate Render free-tier spin-up
const UPLOAD_TIMEOUT_MS = 45000;  // 45s for file uploads and heavy MILP solves

/**
 * Loads the default MoFPI South India perishable produce dataset and initial solved state.
 * Times out after 2500ms and smoothly falls back to DEFAULT_FALLBACK_RESPONSE.
 */
export async function fetchDefaultScenario(): Promise<{
  data: OptimizeResponse;
  isLive: boolean;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/default-scenario`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        `[FreshRoute API] GET /default-scenario returned HTTP ${res.status}. Using rich fallback data.`
      );
      return { data: DEFAULT_FALLBACK_RESPONSE, isLive: false };
    }

    const data: OptimizeResponse = await res.json();
    return { data, isLive: true };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(
      `[FreshRoute API] Failed to reach ${API_BASE_URL}/default-scenario:`,
      err instanceof Error ? err.message : err
    );
    return { data: DEFAULT_FALLBACK_RESPONSE, isLive: false };
  }
}

/**
 * Re-solves both the Naive FIFO Baseline and the FreshRoute MILP Optimizer.
 * Times out after 2500ms and smoothly falls back to simulateFallbackOptimize().
 */
export async function postOptimize(
  request: OptimizeRequest
): Promise<{ data: OptimizeResponse; isLive: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/optimize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        `[FreshRoute API] POST /optimize returned HTTP ${res.status}. Executing client-side simulation.`
      );
      return { data: simulateFallbackOptimize(request), isLive: false };
    }

    const data: OptimizeResponse = await res.json();
    return { data, isLive: true };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(
      `[FreshRoute API] Failed to reach ${API_BASE_URL}/optimize:`,
      err instanceof Error ? err.message : err
    );
    return { data: simulateFallbackOptimize(request), isLive: false };
  }
}

/**
 * Ingests user/judge CSV or JSON files via multipart/form-data.
 * Returns the optimized response or a friendly fallback with ingestion warning.
 */
export async function uploadDataset(
  formData: FormData
): Promise<{ data: OptimizeResponse; isLive: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/upload-dataset`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(
        `[FreshRoute API] POST /upload-dataset returned HTTP ${res.status}. Falling back to default scenario.`
      );
      return {
        data: {
          ...DEFAULT_FALLBACK_RESPONSE,
          ingestion_warnings: [
            `Upload endpoint responded with status ${res.status}. Loaded default scenario in offline simulation mode.`,
          ],
        },
        isLive: false,
      };
    }

    const data: OptimizeResponse = await res.json();
    return { data, isLive: true };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(
      `[FreshRoute API] Failed to upload dataset to ${API_BASE_URL}/upload-dataset:`,
      err instanceof Error ? err.message : err
    );
    return {
      data: {
        ...DEFAULT_FALLBACK_RESPONSE,
        ingestion_warnings: [
          "Backend offline during upload. Loaded default MoFPI South India dataset in offline simulation mode.",
        ],
      },
      isLive: false,
    };
  }
}
