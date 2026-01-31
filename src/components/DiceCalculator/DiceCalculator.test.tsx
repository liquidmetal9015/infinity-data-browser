// Tests for DiceCalculator components
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Import components
import { CompactNumber } from './CompactNumber';
import { BurstSelector } from './BurstSelector';
import { AmmoSelector } from './AmmoSelector';
import { PresetsBar } from './PresetsBar';
import { ComparisonSummary } from './ComparisonSummary';
import { WoundsTable } from './WoundsTable';
import { WoundsBar } from './WoundsBar';

describe('DiceCalculator Components', () => {
    describe('CompactNumber', () => {
        it('renders with label and value', () => {
            const onChange = vi.fn();
            render(<CompactNumber label="BS" value={12} onChange={onChange} />);

            expect(screen.getByText('BS')).toBeInTheDocument();
            expect(screen.getByDisplayValue('12')).toBeInTheDocument();
        });

        it('calls onChange with incremented value on plus click', () => {
            const onChange = vi.fn();
            render(<CompactNumber label="BS" value={12} onChange={onChange} />);

            const plusBtn = screen.getAllByRole('button')[1];
            fireEvent.click(plusBtn);

            expect(onChange).toHaveBeenCalledWith(13);
        });

        it('calls onChange with decremented value on minus click', () => {
            const onChange = vi.fn();
            render(<CompactNumber label="BS" value={12} onChange={onChange} />);

            const minusBtn = screen.getAllByRole('button')[0];
            fireEvent.click(minusBtn);

            expect(onChange).toHaveBeenCalledWith(11);
        });

        it('respects min and max bounds', () => {
            const onChange = vi.fn();
            render(<CompactNumber label="BS" value={0} onChange={onChange} min={0} max={25} />);

            const minusBtn = screen.getAllByRole('button')[0];
            expect(minusBtn).toBeDisabled();
        });

        it('shows zero button when showZero is true', () => {
            const onChange = vi.fn();
            render(<CompactNumber label="BS" value={12} onChange={onChange} showZero={true} />);

            expect(screen.getByText('0')).toBeInTheDocument();
        });
    });

    describe('BurstSelector', () => {
        it('renders burst buttons 1-5', () => {
            const onChange = vi.fn();
            render(<BurstSelector value={3} onChange={onChange} />);

            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('4')).toBeInTheDocument();
            expect(screen.getByText('5')).toBeInTheDocument();
        });

        it('highlights selected value', () => {
            const onChange = vi.fn();
            render(<BurstSelector value={3} onChange={onChange} />);

            const btn3 = screen.getByText('3').closest('button');
            expect(btn3).toHaveClass('active');
        });

        it('shows 0 option when isReactive', () => {
            const onChange = vi.fn();
            render(<BurstSelector value={1} onChange={onChange} isReactive={true} />);

            // Should have button with 0
            const buttons = screen.getAllByRole('button');
            expect(buttons[0]).toHaveTextContent('0');
        });

        it('calls onChange when button clicked', () => {
            const onChange = vi.fn();
            render(<BurstSelector value={3} onChange={onChange} />);

            fireEvent.click(screen.getByText('4'));
            expect(onChange).toHaveBeenCalledWith(4);
        });
    });

    describe('AmmoSelector', () => {
        it('renders all ammo types', () => {
            const onUpdate = vi.fn();
            render(
                <AmmoSelector
                    ammo="N"
                    continuous={false}
                    critImmune={false}
                    onUpdate={onUpdate}
                />
            );

            expect(screen.getByText('N')).toBeInTheDocument();
            expect(screen.getByText('DA')).toBeInTheDocument();
            expect(screen.getByText('EXP')).toBeInTheDocument();
            expect(screen.getByText('T2')).toBeInTheDocument();
            expect(screen.getByText('PLASMA')).toBeInTheDocument();
        });

        it('highlights selected ammo', () => {
            const onUpdate = vi.fn();
            render(
                <AmmoSelector
                    ammo="DA"
                    continuous={false}
                    critImmune={false}
                    onUpdate={onUpdate}
                />
            );

            const daBtn = screen.getByText('DA').closest('button');
            expect(daBtn).toHaveClass('active');
        });

        it('renders toggle buttons for continuous and crit immune', () => {
            const onUpdate = vi.fn();
            render(
                <AmmoSelector
                    ammo="N"
                    continuous={true}
                    critImmune={false}
                    onUpdate={onUpdate}
                />
            );

            expect(screen.getByText('CONT')).toBeInTheDocument();
            expect(screen.getByText('CRIT IMMUNE')).toBeInTheDocument();
        });

        it('calls onUpdate when ammo clicked', () => {
            const onUpdate = vi.fn();
            render(
                <AmmoSelector
                    ammo="N"
                    continuous={false}
                    critImmune={false}
                    onUpdate={onUpdate}
                />
            );

            fireEvent.click(screen.getByText('EXP'));
            expect(onUpdate).toHaveBeenCalledWith('ammo', 'EXP');
        });
    });

    describe('PresetsBar', () => {
        it('renders weapon presets', () => {
            const onApplyWeapon = vi.fn();
            const onApplyArmor = vi.fn();
            render(<PresetsBar onApplyWeapon={onApplyWeapon} onApplyArmor={onApplyArmor} />);

            expect(screen.getByText('Combi')).toBeInTheDocument();
            expect(screen.getByText('HMG')).toBeInTheDocument();
            expect(screen.getByText('Sniper')).toBeInTheDocument();
        });

        it('renders armor presets', () => {
            const onApplyWeapon = vi.fn();
            const onApplyArmor = vi.fn();
            render(<PresetsBar onApplyWeapon={onApplyWeapon} onApplyArmor={onApplyArmor} />);

            expect(screen.getByText('LI')).toBeInTheDocument();
            expect(screen.getByText('MI')).toBeInTheDocument();
            expect(screen.getByText('HI')).toBeInTheDocument();
            expect(screen.getByText('TAG')).toBeInTheDocument();
        });

        it('calls onApplyWeapon when weapon preset clicked', () => {
            const onApplyWeapon = vi.fn();
            const onApplyArmor = vi.fn();
            render(<PresetsBar onApplyWeapon={onApplyWeapon} onApplyArmor={onApplyArmor} />);

            fireEvent.click(screen.getByText('HMG'));
            expect(onApplyWeapon).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'HMG', ps: 15, burst: 4 })
            );
        });

        it('calls onApplyArmor when armor preset clicked', () => {
            const onApplyWeapon = vi.fn();
            const onApplyArmor = vi.fn();
            render(<PresetsBar onApplyWeapon={onApplyWeapon} onApplyArmor={onApplyArmor} />);

            fireEvent.click(screen.getByText('TAG'));
            expect(onApplyArmor).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'TAG', armor: 7 })
            );
        });
    });

    describe('ComparisonSummary', () => {
        const mockActive = { winProbability: 0.6, expectedWounds: 1.5 };
        const mockReactive = { winProbability: 0.3, expectedWounds: 0.8 };

        it('renders win probabilities', () => {
            render(
                <ComparisonSummary
                    active={mockActive}
                    reactive={mockReactive}
                    fail={0.1}
                />
            );

            expect(screen.getByText('60.0%')).toBeInTheDocument();
            expect(screen.getByText('30.0%')).toBeInTheDocument();
        });

        it('shows favored side indicator', () => {
            render(
                <ComparisonSummary
                    active={mockActive}
                    reactive={mockReactive}
                    fail={0.1}
                />
            );

            // Check for favored class on active side
            const activeSide = document.querySelector('.active-side.favored');
            expect(activeSide).toBeInTheDocument();
        });

        it('displays expected wounds', () => {
            render(
                <ComparisonSummary
                    active={mockActive}
                    reactive={mockReactive}
                    fail={0.1}
                />
            );

            expect(screen.getByText(/1.50 wounds/)).toBeInTheDocument();
            expect(screen.getByText(/0.80 wounds/)).toBeInTheDocument();
        });
    });

    describe('WoundsTable', () => {
        const mockActive = { wounds: new Map([[0, 0.3], [1, 0.4], [2, 0.3]]) };
        const mockReactive = { wounds: new Map([[0, 0.5], [1, 0.3], [2, 0.2]]) };

        it('renders active wounds table', () => {
            render(<WoundsTable active={mockActive} reactive={mockReactive} />);

            expect(screen.getByText('Active Wounds Distribution')).toBeInTheDocument();
        });

        it('renders reactive wounds table', () => {
            render(<WoundsTable active={mockActive} reactive={mockReactive} />);

            expect(screen.getByText('Reactive Wounds Distribution')).toBeInTheDocument();
        });

        it('displays wound probabilities', () => {
            render(<WoundsTable active={mockActive} reactive={mockReactive} />);

            // Check that some probability values appear
            expect(screen.getAllByText(/\d+\.\d+%/).length).toBeGreaterThan(0);
        });
    });

    describe('WoundsBar', () => {
        const mockActive = { wounds: new Map([[0, 0.3], [1, 0.4], [2, 0.3]]) };
        const mockReactive = { wounds: new Map([[0, 0.5], [1, 0.3], [2, 0.2]]) };

        it('renders wounds bar container', () => {
            const { container } = render(
                <WoundsBar active={mockActive} reactive={mockReactive} fail={0.1} />
            );

            expect(container.querySelector('.wounds-bar-container')).toBeInTheDocument();
        });

        it('renders bar segments for wounds', () => {
            const { container } = render(
                <WoundsBar active={mockActive} reactive={mockReactive} fail={0.1} />
            );

            const segments = container.querySelectorAll('.bar-seg');
            expect(segments.length).toBeGreaterThan(0);
        });
    });
});
