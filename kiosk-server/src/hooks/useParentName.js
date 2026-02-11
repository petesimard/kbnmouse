import { useState, useEffect } from 'react';
import { authHeaders, handleResponse } from '../api/client.js';

const DEFAULT_PARENT_NAME = 'Mom & Dad';

export function useParentName() {
  const [parentName, setParentName] = useState(DEFAULT_PARENT_NAME);

  useEffect(() => {
    fetch('/api/parent-name', { headers: authHeaders() })
      .then((res) => handleResponse(res))
      .then((data) => {
        if (data?.name) setParentName(data.name);
      })
      .catch(() => {});
  }, []);

  return parentName;
}
