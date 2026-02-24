/**
 * API Client with automatic 401 handling
 * Automatically logs out user when receiving 401 Unauthorized
 */

let logoutCallback: (() => void) | null = null;

/**
 * Register a callback to be called when 401 is received
 * This should be called from AuthContext to register the logout function
 */
export const registerLogoutCallback = (callback: () => void) => {
  logoutCallback = callback;
};

/**
 * Enhanced fetch that automatically handles 401 errors
 * Usage: Use this instead of fetch() for API calls
 */
export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, init);

  // If we get 401 Unauthorized and have a logout callback, trigger it
  if (response.status === 401 && logoutCallback) {
    console.warn("[API Client] Received 401 Unauthorized - logging out user");

    // Clear localStorage immediately to prevent further requests
    localStorage.removeItem("pet_hotel_auth");

    // Call the logout callback to update AuthContext state
    logoutCallback();

    // Show user-friendly message
    const errorData = await response.json().catch(() => ({ error: "Session expired" }));
    throw new Error(errorData.error || "Session expired. Please log in again.");
  }

  return response;
};
