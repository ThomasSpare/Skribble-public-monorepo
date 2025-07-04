import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface CollaboratorsMenuPortalProps {
  children: React.ReactNode;
}

const CollaboratorsMenuPortal: React.FC<CollaboratorsMenuPortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    children,
    document.body // or another element outside the current stacking context
  );
};

export default CollaboratorsMenuPortal;