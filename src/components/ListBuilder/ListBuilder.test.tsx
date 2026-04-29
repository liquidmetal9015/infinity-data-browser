// Tests for ListBuilder components
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ListHeader } from './ListHeader';



const mockList = {
    id: 'test-list',
    name: 'Test Army',
    factionId: 101,
    pointsLimit: 300,
    groups: [{ id: '1', units: [] }],
    createdAt: Date.now(),
    updatedAt: Date.now()
} as unknown as import('@shared/listTypes').ArmyList;

describe('ListBuilder Components', () => {
    describe('ListHeader', () => {
        it('renders list name', () => {
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            expect(screen.getByText('Test Army')).toBeInTheDocument();
        });

        it('renders faction name', () => {
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            expect(screen.getByText('PanOceania')).toBeInTheDocument();
        });

        it('renders points dropdown with current value', () => {
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            const dropdown = screen.getByRole('combobox');
            expect(dropdown).toHaveValue('300');
        });

        it('calls onPointsLimitChange when dropdown changed', () => {
            const onPointsLimitChange = vi.fn();
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={onPointsLimitChange}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            const dropdown = screen.getByRole('combobox');
            fireEvent.change(dropdown, { target: { value: '400' } });
            expect(onPointsLimitChange).toHaveBeenCalledWith(400);
        });

        it('shows Copy Code button', () => {
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            expect(screen.getByText('Copy Code')).toBeInTheDocument();
        });

        it('shows Copied! when code copied', () => {
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={true}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            expect(screen.getByText('Copied!')).toBeInTheDocument();
        });

        it('calls onCopyCode when copy button clicked', () => {
            const onCopyCode = vi.fn();
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={onCopyCode}
                    onReset={vi.fn()}
                    onOpenInArmy={vi.fn()}
                />
            );

            fireEvent.click(screen.getByText('Copy Code'));
            expect(onCopyCode).toHaveBeenCalled();
        });

        it('calls onReset when reset button clicked', () => {
            const onReset = vi.fn();
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={onReset}
                    onOpenInArmy={vi.fn()}
                />
            );

            fireEvent.click(screen.getByText('Start Over'));
            expect(onReset).toHaveBeenCalled();
        });

        it('calls onOpenInArmy when Open in Infinity Army button clicked', () => {
            const onOpenInArmy = vi.fn();
            render(
                <ListHeader
                    list={mockList}
                    factionName="PanOceania"
                    codeCopied={false}
                    onPointsLimitChange={vi.fn()}
                    onCopyCode={vi.fn()}
                    onReset={vi.fn()}
                    onOpenInArmy={onOpenInArmy}
                />
            );

            fireEvent.click(screen.getByText('Open in Infinity Army'));
            expect(onOpenInArmy).toHaveBeenCalled();
        });
    });
});
