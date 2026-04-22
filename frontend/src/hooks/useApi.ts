import { useState, useEffect, useCallback } from 'react';
import { AxiosRequestConfig } from 'axios';
import api from '../services/api';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(url: string, options?: AxiosRequestConfig) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await api(url, options);
      setState({ data: response.data, loading: false, error: null });
    } catch (err: any) {
      setState({
        data: null,
        loading: false,
        error: err.response?.data?.detail || err.message || 'An error occurred',
      });
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch };
}

export function useMutation<T, P = any>() {
  const [state, setState] = useState<UseApiState<T> & { mutate: (data: P) => Promise<T | null> }>({
    data: null,
    loading: false,
    error: null,
    mutate: async () => null,
  });

  const mutate = useCallback(async (url: string, method: 'POST' | 'PUT' | 'DELETE', data?: P): Promise<T | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await api({ url, method, data });
      setState({ data: response.data, loading: false, error: null, mutate: mutate as any });
      return response.data;
    } catch (err: any) {
      const error = err.response?.data?.detail || err.message || 'An error occurred';
      setState((prev) => ({ ...prev, loading: false, error }));
      return null;
    }
  }, []);

  return { ...state, mutate };
}
