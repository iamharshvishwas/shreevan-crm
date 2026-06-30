import { useEffect, useState } from 'react';
import { clearTeachToken, setTeachToken, teachApi, teachToken, type Instructor } from './teachApi';

export function useInstructor() {
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [loading, setLoading] = useState<boolean>(!!teachToken());

  useEffect(() => {
    if (!teachToken()) return;
    let live = true;
    teachApi.me()
      .then((i) => { if (live) setInstructor(i); })
      .catch(() => { clearTeachToken(); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function login(email: string, password: string) {
    const s = await teachApi.login(email, password);
    setTeachToken(s.token);
    setInstructor(s.instructor);
  }
  function logout() {
    clearTeachToken();
    setInstructor(null);
  }

  return { instructor, loading, login, logout };
}

export type InstructorStore = ReturnType<typeof useInstructor>;
