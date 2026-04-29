// Tests for RangesPage components
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { WeaponSidebar } from './WeaponSidebar';
import { WeaponTable } from './WeaponTable';
import { BestWeaponsBar } from './BestWeaponsBar';
import type { ParsedWeapon, BestWeaponInfo } from './types';

const mockWeapons: ParsedWeapon[] = [
    {
        id: 1,
        name: 'Combi Rifle',
        bands: [
            { start: 0, end: 8, mod: 3 },
            { start: 8, end: 16, mod: 3 },
            { start: 16, end: 24, mod: -3 },
            { start: 24, end: 32, mod: -3 }
        ],
        burst: '3',
        damage: '13',
        saving: 'ARM',
        savingNum: '0',
        ammunition: 'Normal',
        properties: [],
        templateType: 'none'
    },
    {
        id: 2,
        name: 'HMG',
        bands: [
            { start: 0, end: 8, mod: 0 },
            { start: 8, end: 24, mod: 3 },
            { start: 24, end: 32, mod: 0 },
            { start: 32, end: 48, mod: -3 }
        ],
        burst: '4',
        damage: '15',
        saving: 'ARM',
        savingNum: '0',
        ammunition: 'Normal',
        properties: ['Suppressive Fire'],
        templateType: 'none'
    },
    {
        id: 3,
        name: 'Flamethrower',
        bands: [],
        burst: '1',
        damage: '14',
        saving: 'ARM',
        savingNum: '0',
        ammunition: 'Fire',
        properties: ['Direct Template', 'Small Teardrop'],
        templateType: 'small'
    }
];

const mockUnits = [
    { id: 1, name: 'Fusilier', allWeaponIds: new Set([1]) } as unknown as import('@shared/types').Unit,
    { id: 2, name: 'Swiss Guard', allWeaponIds: new Set([2]) } as unknown as import('@shared/types').Unit
];

describe('RangesPage Components', () => {
    describe('WeaponSidebar', () => {
        const defaultProps = {
            weaponSearch: '',
            setWeaponSearch: vi.fn(),
            unitSearch: '',
            setUnitSearch: vi.fn(),
            filteredWeapons: mockWeapons,
            filteredUnits: [],
            selectedIds: new Set<number>(),
            onToggleWeapon: vi.fn(),
            onSelectUnitWeapons: vi.fn(),
            onViewUnit: vi.fn()
        };

        it('renders header', () => {
            render(<WeaponSidebar {...defaultProps} />);
            expect(screen.getByText('Range Visualizer')).toBeInTheDocument();
        });

        it('renders weapon search input', () => {
            render(<WeaponSidebar {...defaultProps} />);
            expect(screen.getByPlaceholderText('Load unit weapons...')).toBeInTheDocument();
        });

        it('renders filter input', () => {
            render(<WeaponSidebar {...defaultProps} />);
            expect(screen.getByPlaceholderText('Filter list...')).toBeInTheDocument();
        });

        it('renders weapon list', () => {
            render(<WeaponSidebar {...defaultProps} />);
            expect(screen.getByText('Combi Rifle')).toBeInTheDocument();
            expect(screen.getByText('HMG')).toBeInTheDocument();
            expect(screen.getByText('Flamethrower')).toBeInTheDocument();
        });

        it('marks selected weapons', () => {
            const props = { ...defaultProps, selectedIds: new Set([1]) };
            render(<WeaponSidebar {...props} />);

            const combiItem = screen.getByText('Combi Rifle').closest('.weapon-item');
            expect(combiItem).toHaveClass('selected');
        });

        it('calls onToggleWeapon when weapon clicked', () => {
            const onToggleWeapon = vi.fn();
            render(<WeaponSidebar {...defaultProps} onToggleWeapon={onToggleWeapon} />);

            fireEvent.click(screen.getByText('Combi Rifle'));
            expect(onToggleWeapon).toHaveBeenCalledWith(1);
        });

        it('shows autocomplete when units available', () => {
            const props = { ...defaultProps, filteredUnits: mockUnits };
            render(<WeaponSidebar {...props} />);

            expect(screen.getByText('Fusilier')).toBeInTheDocument();
            expect(screen.getByText('Swiss Guard')).toBeInTheDocument();
        });

        it('calls onSelectUnitWeapons when unit clicked', () => {
            const onSelectUnitWeapons = vi.fn();
            const props = {
                ...defaultProps,
                filteredUnits: mockUnits,
                onSelectUnitWeapons
            };
            render(<WeaponSidebar {...props} />);

            fireEvent.click(screen.getByText('Fusilier'));
            expect(onSelectUnitWeapons).toHaveBeenCalledWith(1);
        });

        it('shows empty message when no weapons', () => {
            const props = { ...defaultProps, filteredWeapons: [] };
            render(<WeaponSidebar {...props} />);

            expect(screen.getByText('No weapons found')).toBeInTheDocument();
        });

        it('updates weapon search on input', () => {
            const setWeaponSearch = vi.fn();
            render(<WeaponSidebar {...defaultProps} setWeaponSearch={setWeaponSearch} />);

            const input = screen.getByPlaceholderText('Filter list...');
            fireEvent.change(input, { target: { value: 'rifle' } });
            expect(setWeaponSearch).toHaveBeenCalledWith('rifle');
        });
    });

    describe('WeaponTable', () => {
        it('renders nothing when no weapons', () => {
            const { container } = render(
                <WeaponTable weapons={[]} onRemoveWeapon={vi.fn()} />
            );
            expect(container.firstChild).toBeNull();
        });

        it('renders table headers', () => {
            render(<WeaponTable weapons={mockWeapons} onRemoveWeapon={vi.fn()} />);

            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Range')).toBeInTheDocument();
            expect(screen.getByText('AMMO')).toBeInTheDocument();
            expect(screen.getByText('Traits')).toBeInTheDocument();
        });

        it('renders weapon rows', () => {
            render(<WeaponTable weapons={mockWeapons} onRemoveWeapon={vi.fn()} />);

            expect(screen.getByText('Combi Rifle')).toBeInTheDocument();
            expect(screen.getByText('HMG')).toBeInTheDocument();
        });

        it('displays damage and burst', () => {
            render(<WeaponTable weapons={[mockWeapons[0]]} onRemoveWeapon={vi.fn()} />);

            expect(screen.getByText('13')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('displays ammunition', () => {
            render(<WeaponTable weapons={[mockWeapons[0]]} onRemoveWeapon={vi.fn()} />);
            expect(screen.getByText('Normal')).toBeInTheDocument();
        });

        it('displays traits', () => {
            render(<WeaponTable weapons={[mockWeapons[1]]} onRemoveWeapon={vi.fn()} />);
            expect(screen.getByText('Suppressive Fire')).toBeInTheDocument();
        });

        it('shows DT for template weapons', () => {
            render(<WeaponTable weapons={[mockWeapons[2]]} onRemoveWeapon={vi.fn()} />);
            // Template weapons show DT in multiple range cells
            expect(screen.getAllByText('DT').length).toBeGreaterThan(0);
        });

        it('calls onRemoveWeapon when remove clicked', () => {
            const onRemoveWeapon = vi.fn();
            render(<WeaponTable weapons={[mockWeapons[0]]} onRemoveWeapon={onRemoveWeapon} />);

            fireEvent.click(screen.getByText('×'));
            expect(onRemoveWeapon).toHaveBeenCalledWith(1);
        });

        it('displays range modifiers', () => {
            render(<WeaponTable weapons={[mockWeapons[0]]} onRemoveWeapon={vi.fn()} />);

            // Check for positive modifier
            expect(screen.getAllByText('+3').length).toBeGreaterThan(0);
        });
    });

    describe('BestWeaponsBar', () => {
        const mockBestWeapons: (BestWeaponInfo | null)[] = [
            { band: { start: 0, end: 8, label: '0-8"' }, weapon: mockWeapons[0], mod: 3, diff: 0 },
            { band: { start: 8, end: 16, label: '8-16"' }, weapon: mockWeapons[1], mod: 3, diff: 0 },
            null,
            { band: { start: 24, end: 32, label: '24-32"' }, weapon: mockWeapons[1], mod: 0, diff: 3 }
        ];

        it('renders Best Options title', () => {
            render(
                <BestWeaponsBar
                    bestWeapons={mockBestWeapons}
                    selectedWeapons={mockWeapons}
                />
            );
            expect(screen.getByText('Best Options')).toBeInTheDocument();
        });

        it('renders range blocks for valid entries', () => {
            render(
                <BestWeaponsBar
                    bestWeapons={mockBestWeapons}
                    selectedWeapons={mockWeapons}
                />
            );

            expect(screen.getByText('0-8"')).toBeInTheDocument();
            expect(screen.getByText('8-16"')).toBeInTheDocument();
        });

        it('shows weapon names in blocks', () => {
            render(
                <BestWeaponsBar
                    bestWeapons={mockBestWeapons}
                    selectedWeapons={mockWeapons}
                />
            );

            expect(screen.getByText('Combi Rifle')).toBeInTheDocument();
            expect(screen.getAllByText('HMG').length).toBeGreaterThan(0);
        });

        it('shows modifiers', () => {
            render(
                <BestWeaponsBar
                    bestWeapons={mockBestWeapons}
                    selectedWeapons={mockWeapons}
                />
            );

            expect(screen.getAllByText('+3').length).toBeGreaterThan(0);
        });

        it('skips null entries', () => {
            const { container } = render(
                <BestWeaponsBar
                    bestWeapons={mockBestWeapons}
                    selectedWeapons={mockWeapons}
                />
            );

            // Should have 3 range blocks (not 4, since one is null)
            const blocks = container.querySelectorAll('.range-block');
            expect(blocks.length).toBe(3);
        });
    });
});
