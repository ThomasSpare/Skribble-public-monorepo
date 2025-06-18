import { createPortal } from 'react-dom';
import { ReactNode } from 'react';

interface ProjectMenuPortalProps {
    children: ReactNode;
    isOpen: boolean;
    containerElement?: HTMLElement;
}

const ProjectMenuPortal = ({ 
    children, 
    isOpen, 
    containerElement = document.body 
}: ProjectMenuPortalProps) => {
    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed',
            zIndex: 9999,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
        }}>
            <div style={{ pointerEvents: 'auto' }}>
                {children}
            </div>
        </div>,
        containerElement
    );
};

export default ProjectMenuPortal;
