import { useState, useEffect } from 'react';
import apiClient from '../services/api';

export const useApi = (url, method = 'GET', options = {}) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await apiClient({
          url,
          method,
          ...options,
        });
        setData(response.data);
      } catch (err) {
        setError(err.message || 'Error fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url, method]);

  return { data, error, loading };
};
