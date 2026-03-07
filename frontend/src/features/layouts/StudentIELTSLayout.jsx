import { useEffect, useState } from 'react';
import Layout from '@/shared/components/Layout';
import MobileAppLayout from './MobileAppLayout';

const MOBILE_QUERY = '(max-width: 768px)';

export default function StudentIELTSLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  if (isMobile) return <MobileAppLayout />;
  return <Layout />;
}
