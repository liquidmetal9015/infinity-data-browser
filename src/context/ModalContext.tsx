import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Unit } from '../types';

interface ModalContextType {
    openUnitModal: (unit: Unit) => void;
    closeModal: () => void;
    selectedUnit: Unit | null;
    isOpen: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const openUnitModal = (unit: Unit) => {
        setSelectedUnit(unit);
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
        setSelectedUnit(null);
    };

    return (
        <ModalContext.Provider value={{ openUnitModal, closeModal, selectedUnit, isOpen }}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModal = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error('useModal must be used within a ModalProvider');
    }
    return context;
};
