import { useEffect, useState } from 'react';
import { api } from './client';

export interface Instructor {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export const instructorsApi = {
  list: () => api.get<Instructor[]>('/instructors'),
  create: (name: string, email: string, password: string) =>
    api.post<Instructor>('/instructors', { name, email, password }),
  setActive: (id: string, isActive: boolean) =>
    api.patch<Instructor>(`/instructors/${id}`, { isActive }),
  setPassword: (id: string, password: string) =>
    api.patch<Instructor>(`/instructors/${id}`, { password }),
};

/** Hook: admin instructor roster with a manual refresh. */
export function useInstructors() {
  const [data, setData] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try { setData(await instructorsApi.list()); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  return { data, loading, refresh };
}
