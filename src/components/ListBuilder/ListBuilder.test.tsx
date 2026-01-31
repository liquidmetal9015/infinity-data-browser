// Tests for ListBuilder components
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ImportModal } from './ImportModal';
import { FactionSelector } from './FactionSelector';
import { ListHeader } from './ListHeader';

const mockGroupedFactions = [
    {
        id: 1,
        name: 'PanOceania',
        shortName: 'PanO',
        vanilla: { id: 101, name: 'PanOceania', slug: 'panoceania' },
        sectorials: [
            { id: 102, name: 'Military Orders', slug: 'military-orders', discontinued: false },
            { id: 103, name: 'Varuna', slug: 'varuna', discontinued: true }
        ]
    },
    {
        id: 2,
        name: 'Yu Jing',
        shortName: 'YJ',
        vanilla: { id: 201, name: 'Yu Jing', slug: 'yujing' },
        sectorials: [
            { id: 202, name: 'White Banner', slug: 'white-banner', discontinued: false }
        ]
    }
] as any;

const mockList = {
    id: 'test-list',
    name: 'Test Army',
    factionId: 101,
    pointsLimit: 300,
    groups: [{ id: '1', units: [] }],
    createdAt: Date.now(),
    updatedAt: Date.now()
} as any;

describe('ListBuilder Components', () => {
    describe('ImportModal', () => {
        it('renders nothing when not open', () => {
            const { container } = render(
                <ImportModal
                    isOpen={false}
                    onClose={vi.fn()}
                    importCode=""
                    setImportCode={vi.fn()}
                    importError=""
                    onImport={vi.fn()}
                />
            );

            expect(container.firstChild).toBeNull();
        });

        it('renders modal when open', () => {
            render(
                <ImportModal
                    isOpen={true}
                    onClose={vi.fn()}
                    importCode=""
                    setImportCode={vi.fn()}
                    importError=""
                    onImport={vi.fn()}
                />
            );

            expect(screen.getByText('Import Army Code')).toBeInTheDocument();
        });

        it('shows import error when provided', () => {
            render(
                <ImportModal
                    isOpen={true}
                    onClose={vi.fn()}
                    importCode=""
                    setImportCode={vi.fn()}
                    importError="Invalid code format"
                    onImport={vi.fn()}
                />
            );

            expect(screen.getByText('Invalid code format')).toBeInTheDocument();
        });

        it('calls onClose when cancel clicked', () => {
            const onClose = vi.fn();
            render(
                <ImportModal
                    isOpen={true}
                    onClose={onClose}
                    importCode=""
                    setImportCode={vi.fn()}
                    importError=""
                    onImport={vi.fn()}
                />
            );

            fireEvent.click(screen.getByText('Cancel'));
            expect(onClose).toHaveBeenCalled();
        });

        it('calls onImport when import button clicked', () => {
            const onImport = vi.fn();
            render(
                <ImportModal
                    isOpen={true}
                    onClose={vi.fn()}
                    importCode="some-code"
                    setImportCode={vi.fn()}
                    importError=""
                    onImport={onImport}
                />
            );

            fireEvent.click(screen.getByText('Import List'));
            expect(onImport).toHaveBeenCalled();
        });

        it('disables import button when no code', () => {
            render(
                <ImportModal
                    isOpen={true}
                    onClose={vi.fn()}
                    importCode=""
                    setImportCode={vi.fn()}
                    importError=""
                    onImport={vi.fn()}
                />
            );

            expect(screen.getByText('Import List')).toBeDisabled();
        });

        it('updates import code when typing', () => {
            const setImportCode = vi.fn();
            render(
                <ImportModal
                    isOpen={true}
                    onClose={vi.fn()}
                    importCode=""
                    setImportCode={setImportCode}
                    importError=""
                    onImport={vi.fn()}
                />
            );

            const textarea = screen.getByPlaceholderText('Paste army code here...');
            fireEvent.change(textarea, { target: { value: 'new-code' } });
            expect(setImportCode).toHaveBeenCalledWith('new-code');
        });
    });

    describe('FactionSelector', () => {
        it('renders hero section', () => {
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={vi.fn()}
                />
            );

            expect(screen.getByText('Army Builder')).toBeInTheDocument();
            expect(screen.getByText('Import Army Code')).toBeInTheDocument();
        });

        it('renders all super factions', () => {
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={vi.fn()}
                />
            );

            expect(screen.getByText('PanOceania')).toBeInTheDocument();
            expect(screen.getByText('Yu Jing')).toBeInTheDocument();
        });

        it('renders vanilla option for factions', () => {
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={vi.fn()}
                />
            );

            expect(screen.getAllByText('Vanilla / General').length).toBe(2);
        });

        it('renders sectorials', () => {
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={vi.fn()}
                />
            );

            expect(screen.getByText('Military Orders')).toBeInTheDocument();
            expect(screen.getByText('White Banner')).toBeInTheDocument();
        });

        it('shows Legacy tag for discontinued sectorials', () => {
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={vi.fn()}
                />
            );

            expect(screen.getByText('Legacy')).toBeInTheDocument();
        });

        it('calls onFactionClick when faction clicked', () => {
            const onFactionClick = vi.fn();
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={onFactionClick}
                    onImportClick={vi.fn()}
                />
            );

            fireEvent.click(screen.getByText('Military Orders'));
            expect(onFactionClick).toHaveBeenCalledWith(102);
        });

        it('calls onImportClick when import button clicked', () => {
            const onImportClick = vi.fn();
            render(
                <FactionSelector
                    groupedFactions={mockGroupedFactions}
                    onFactionClick={vi.fn()}
                    onImportClick={onImportClick}
                />
            );

            fireEvent.click(screen.getByText('Import Army Code'));
            expect(onImportClick).toHaveBeenCalled();
        });
    });

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
                />
            );

            fireEvent.click(screen.getByText('Start Over'));
            expect(onReset).toHaveBeenCalled();
        });
    });
});
