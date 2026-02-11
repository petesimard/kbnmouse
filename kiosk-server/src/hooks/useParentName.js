import { useState, useEffect } from 'react';

const DEFAULT_PARENT_NAME = 'Mom & Dad';

export function useParentName() {
  const [parentName, setParentName] = useState(DEFAULT_PARENT_NAME);

  useEffect(() => {
    fetch('/api/parent-name')
      .then((res) => res.json())
      .then((data) => {
        if (data.name) setParentName(data.name);
      })
      .catch(() => {});
  }, []);

  return parentName;
}
