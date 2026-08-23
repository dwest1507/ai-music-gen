import { z } from "zod";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type FetchOptions = RequestInit & {
    schema?: z.ZodSchema<unknown>;
};

export class ApiError extends Error {
    constructor(public status: number, public statusText: string, public data: unknown) {
        super(`API Error ${status}: ${statusText}`);
    }
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { schema, ...fetchOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
    };

    const config: RequestInit = {
        ...fetchOptions,
        headers,
        credentials: "include", // Ensure httpOnly cookies are sent/received
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        let errorData: unknown;
        try {
            errorData = await response.json();
        } catch {
            errorData = { message: "Unknown error occurred" };
        }
        throw new ApiError(response.status, response.statusText, errorData);
    }

    // If we expect a JSON response
    if (response.status !== 204) {
        const data = await response.json();
        if (schema) {
            return schema.parse(data) as T;
        }
        return data as T;
    }

    return {} as T;
}

// --- Shared API Types ---

export interface GenerateRequest {
    prompt: string;
    genre?: string;
    lyrics?: string;
    vocal_language?: string;
    instrumental?: boolean;
}

export interface GenerateResponse {
    task_id: string;
    status: string;
    queue_position?: number;
    job_id?: string;
}

export interface JobMetadata {
    prompt?: string;
    lyrics?: string;
    bpm?: number;
    duration?: number;
    genre?: string;
    key_scale?: string;
    time_signature?: string;
    [key: string]: unknown;
}

export interface JobResponse {
    task_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    audio_url?: string;
    audio_urls?: string[];
    metadata?: JobMetadata;
    error?: string;
}

export interface ExampleResponse {
    prompt: string;
    lyrics: string;
    vocal_language: string;
    genre?: string;
    instrumental?: boolean;
}

export async function getRandomExample(): Promise<ExampleResponse> {
    return apiFetch<ExampleResponse>("/api/examples/random");
}
