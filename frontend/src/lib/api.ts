import { z } from "zod";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
