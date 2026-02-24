import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { ENV } from "../config/env";
import i18n from "../i18n";

export type UseQueryApiOptions = {
  enabled?: boolean;
  authorized?: boolean;
  dependencies?: (string | number | null | undefined)[];
  headers?: Record<string, string>;
  staleTime?: number;
  refetchOnMount?: boolean;
};

/**
 * Supports two signatures for convenience:
 * 1) useQueryApi(url, options)
 * 2) useQueryApi(queryKeyArray, url, options)
 */
export function useQueryApi<T>(
  queryKeyOrUrl: string | (string | number | null | undefined)[] | null,
  urlOrOptions?: string | null | UseQueryApiOptions,
  maybeOptions?: UseQueryApiOptions
) {
  let url: string | null = null;
  let options: UseQueryApiOptions | undefined;
  let queryKey: (string | number)[] | null = null;

  if (Array.isArray(queryKeyOrUrl)) {
    queryKey = queryKeyOrUrl.filter(
      (part): part is string | number => part !== null && part !== undefined
    );

    if (typeof urlOrOptions === "string" || urlOrOptions === null) {
      url = urlOrOptions;
      options = maybeOptions;
    } else {
      options = urlOrOptions as UseQueryApiOptions | undefined;
    }
  } else {
    url = queryKeyOrUrl;
    options = (urlOrOptions as UseQueryApiOptions) || maybeOptions;
  }

  const {
    enabled = true,
    authorized = false,
    dependencies = [] as (string | number | null | undefined)[],
    headers: customHeaders,
    staleTime,
    refetchOnMount,
  } = options || {};

  if (!queryKey && url) {
    queryKey = [url];
  }
  if (queryKey) {
    const normalizedDeps = dependencies.filter(
      (dep): dep is string | number => dep !== null && dep !== undefined
    );
    queryKey = [...queryKey, ...normalizedDeps];
  }

  const { authFetch, token } = useAuth();

  // Build headers
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token && authorized) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  const query = useQuery<T>({
    queryKey: queryKey || [],
    queryFn: async () => {
      if (!url) {
        throw new Error("URL is required");
      }
      const fullUrl = url.startsWith("http")
        ? url
        : ENV.API_URL.replace(/\/$/, "") + (url.startsWith("/") ? url : `/${url}`);

      const fetcher = authorized ? authFetch : fetch;
      const response = await fetcher(fullUrl, { headers, cache: "no-store" });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = new Error(
          errorBody?.error ?? i18n.t("common:messages.requestError", { status: response.status })
        );
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      return (await response.json()) as T;
    },
    enabled: enabled && url !== null,
    staleTime: staleTime,
    refetchOnMount: refetchOnMount,
    // Keep previous data to avoid UI flicker while refetching
    placeholderData: (previousData) => previousData,
  });

  return {
    data: query.data,
    loading: query.isLoading,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error ? (query.error as Error).message : null,
    errorObject: query.error ? (query.error as Error) : null,
    status: query.isLoading
      ? "loading"
      : query.isError
        ? "error"
        : query.isSuccess
          ? "success"
          : "idle",
    refetch: query.refetch,
  };
}

/**
 * Hook for POST/PUT/DELETE requests using React Query mutations
 */
export function useMutationApi<TData = unknown, TVariables = unknown>(options?: {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  invalidateQueries?: string[];
  authorized?: boolean;
}) {
  const { onSuccess, onError, invalidateQueries, authorized = false } = options || {};
  const { authFetch, token } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation<
    TData,
    Error,
    { url: string; method?: string; body?: TVariables; headers?: Record<string, string> }
  >({
    mutationFn: async ({ url, method = "POST", body, headers: customHeaders }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token && authorized) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (customHeaders) {
        Object.assign(headers, customHeaders);
      }

      const fullUrl = url.startsWith("http")
        ? url
        : ENV.API_URL.replace(/\/$/, "") + (url.startsWith("/") ? url : `/${url}`);

      const fetcher = authorized ? authFetch : fetch;
      const response = await fetcher(fullUrl, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const error = new Error(
          errorBody?.error ?? i18n.t("common:messages.requestError", { status: response.status })
        );
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return (await response.json()) as TData;
      }
      return null as TData;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}
