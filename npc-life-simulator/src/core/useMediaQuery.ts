import { useEffect, useState } from 'react';

/** Subscribes to a media query and re-renders when it starts or stops matching. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Phone-sized viewport: the layout collapses to one column below this width. */
export const PHONE_QUERY = '(max-width: 760px)';

/** True for devices whose primary input is a finger rather than a mouse. */
export const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
