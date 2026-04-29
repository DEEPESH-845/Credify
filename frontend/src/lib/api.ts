const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Make an authenticated or unauthenticated request to the backend API.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  jwt?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed with status ${res.status}`;

    try {
      const body = await res.json();
      if (body.error) {
        code = body.error.code || code;
        message = body.error.message || message;
      }
    } catch {
      // Response body wasn't JSON — use defaults
    }

    throw new ApiRequestError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

/**
 * Request a nonce for the given wallet address.
 */
export async function requestNonce(
  address: string
): Promise<{ nonce: string }> {
  return request<{ nonce: string }>("/api/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ address }),
  });
}

/**
 * Verify a signed nonce and receive a JWT.
 */
export async function verifySignature(
  address: string,
  signature: string,
  nonce: string
): Promise<{ token: string; address: string }> {
  return request<{ token: string; address: string }>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify({ address, signature, nonce }),
  });
}

/**
 * Profile data returned by the backend API.
 */
export interface ProfileData {
  id: number;
  wallet_address: string;
  display_name: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  profile_image_cid: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a user profile by wallet address.
 */
export async function getProfile(
  address: string,
  jwt: string
): Promise<ProfileData> {
  return request<ProfileData>(`/api/profiles/${address}`, { method: "GET" }, jwt);
}

/**
 * Fields accepted by the profile update endpoint.
 */
export interface ProfileUpdatePayload {
  display_name?: string;
  headline?: string;
  bio?: string;
  location?: string;
}

/**
 * Update the authenticated user's profile.
 */
export async function updateProfile(
  address: string,
  data: ProfileUpdatePayload,
  jwt: string
): Promise<ProfileData> {
  return request<ProfileData>(
    `/api/profiles/${address}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    jwt
  );
}

/**
 * Upload a profile image to IPFS via the backend.
 * Returns the updated profile with the new profile_image_cid.
 */
export async function uploadProfileImage(
  address: string,
  file: File,
  jwt: string
): Promise<ProfileData> {
  const formData = new FormData();
  formData.append("image", file);

  const headers: Record<string, string> = {};
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  const res = await fetch(
    `${API_BASE_URL}/api/profiles/${address}/image`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Request failed with status ${res.status}`;

    try {
      const body = await res.json();
      if (body.error) {
        code = body.error.code || code;
        message = body.error.message || message;
      }
    } catch {
      // Response body wasn't JSON — use defaults
    }

    throw new ApiRequestError(res.status, code, message);
  }

  return res.json() as Promise<ProfileData>;
}

export { request, API_BASE_URL };
