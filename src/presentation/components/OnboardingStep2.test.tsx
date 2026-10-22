import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';
import OnboardingStep2 from './OnboardingStep2';
import { LocalCategoryRepository } from '../../infrastructure/repositories/local/LocalCategoryRepository';
import { LocalMovementRepository } from '../../infrastructure/repositories/local/LocalMovementRepository';
import { DomainError } from '../../core/domain/errors/DomainError';

vi.mock('../../infrastructure/repositories/local/LocalCategoryRepository');
vi.mock('../../infrastructure/repositories/local/LocalMovementRepository');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const echoSave = () => vi.fn().mockImplementation((data: any) => Promise.resolve({ ...data, created_at: new Date(), updated_at: new Date() }));

const echoSaveSet = (save = echoSave()) => vi.fn((_userId: string, rows: unknown[]) => Promise.all(rows.map(row => save(row))));
describe('OnboardingStep2', () => {
  it('seeds the 3 default buckets on first load and enables submit at 100%', async () => {
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionSet: echoSaveSet(mockSave),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    expect(mockSave).toHaveBeenCalledTimes(3);
    expect(submitBtn).not.toBeDisabled();
    expect(screen.getByText(/total: 100%/i)).toBeInTheDocument();
  });

  it('does not double-seed buckets when mounted under React Strict Mode', async () => {
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionSet: echoSaveSet(mockSave),
      };
    });

    render(
      <StrictMode>
        <OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />
      </StrictMode>
    );

    await screen.findByRole('button', { name: /guardar distribución/i });
    // Strict Mode replays the seed effect's setup once; without the
    // seedStartedRef guard this would write 6 buckets instead of 3.
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
  });

  it('disables submit when the total is not 100%', async () => {
    const user = userEvent.setup();
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionSet: echoSaveSet(mockSave),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    expect(submitBtn).not.toBeDisabled();

    const firstPercentInput = (await screen.findAllByLabelText(/porcentaje de la categoría/i))[0];
    await user.clear(firstPercentInput);
    await user.type(firstPercentInput, '60');

    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/debe sumar exactamente 100%/i)).toBeInTheDocument();
  });

  it('saves all buckets and calls onComplete on valid submission', async () => {
    const user = userEvent.setup();
    const mockOnComplete = vi.fn();
    const mockSave = echoSave();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([]),
        saveDistributionSet: echoSaveSet(mockSave),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={mockOnComplete} />);

    const submitBtn = await screen.findByRole('button', { name: /guardar distribución/i });
    mockSave.mockClear(); // ignore the 3 seed calls from mount, count only the submit calls

    await user.click(submitBtn);

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('blocks deleting the last remaining bucket', async () => {
    const user = userEvent.setup();
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'only-bucket', user_id: 'fake-id', name: 'Único', percentage: 100, is_default: true, is_savings: false },
        ]),
        saveDistributionSet: echoSaveSet(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        deleteDistributionCategory: mockDelete,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteBtn = await screen.findByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteBtn);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/necesitas al menos una categoría/i)).toBeInTheDocument();
  });

  it('blocks deleting a bucket that still has expense categories attached', async () => {
    const user = userEvent.setup();
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'b1', user_id: 'fake-id', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false },
          { id: 'b2', user_id: 'fake-id', name: 'Gustos', percentage: 50, is_default: true, is_savings: false },
        ]),
        saveDistributionSet: echoSaveSet(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(2),
        deleteDistributionCategory: mockDelete,
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteButtons = await screen.findAllByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(mockDelete).not.toHaveBeenCalled());
    expect(screen.getByText(/2 categorías de gasto asociadas/i)).toBeInTheDocument();
  });

  it('blocks deleting a bucket that has movements associated, even with no expense categories attached', async () => {
    const user = userEvent.setup();
    const mockDeleteCategory = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return {
        getDistributionCategories: vi.fn().mockResolvedValue([
          { id: 'b1', user_id: 'fake-id', name: 'Necesidades', percentage: 50, is_default: true, is_savings: false },
          { id: 'b2', user_id: 'fake-id', name: 'Ahorro', percentage: 50, is_default: true, is_savings: true },
        ]),
        saveDistributionSet: echoSaveSet(),
        countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        deleteDistributionCategory: mockDeleteCategory,
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalMovementRepository as any).mockImplementation(function () {
      return {
        countByDistributionCategory: vi.fn().mockResolvedValue(3),
      };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    const deleteButtons = await screen.findAllByRole('button', { name: /eliminar categoría/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => expect(mockDeleteCategory).not.toHaveBeenCalled());
    expect(screen.getByText(/3 movimientos asociados/i)).toBeInTheDocument();
  });

  it('shows the neutral Spanish description and tutorial copy', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (LocalCategoryRepository as any).mockImplementation(function () {
      return { getDistributionCategories: vi.fn().mockResolvedValue([]), saveDistributionSet: echoSaveSet() };
    });

    render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

    expect(await screen.findByText('Define en qué categorías quieres distribuir lo que ganas cada mes. Puedes agregar, renombrar o eliminar las que necesites.')).toBeInTheDocument();
    expect(screen.getByText('Es solo un punto de partida — agrega, renombra o elimina categorías según tu realidad. Solo asegúrate de que sumen 100%.')).toBeInTheDocument();
  });

  describe('transient messages (FR-020, FR-021)', () => {
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    const mockSingleBucket = (saveSet = echoSaveSet()) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalCategoryRepository as any).mockImplementation(function () {
        return {
          getDistributionCategories: vi.fn().mockResolvedValue([
            { id: 'only', user_id: 'fake-id', name: 'Único', percentage: 100, is_default: true, is_savings: false },
          ]),
          saveDistributionSet: saveSet,
          countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        };
      });
      return saveSet;
    };
    // Only setTimeout is faked: React, Testing Library and fake-indexeddb keep their real scheduling.
    const fakeClock = () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      // Testing Library only advances a fake clock for its own waits when it detects `jest`.
      vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) });
      return userEvent.setup({ advanceTimers: ms => vi.advanceTimersByTime(ms) });
    };

    it('hides the delete notice after 4 seconds, next to the bucket that caused it', async () => {
      mockSingleBucket();
      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);
      const deleteBtn = await screen.findByRole('button', { name: /eliminar categoría/i });
      const user = fakeClock();

      await user.click(deleteBtn);
      expect(screen.getByRole('alert')).toHaveTextContent('Necesitas al menos una categoría de distribución.');

      act(() => { vi.advanceTimersByTime(3999); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(1); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hides the notice as soon as the user does anything else', async () => {
      mockSingleBucket();
      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);
      const deleteBtn = await screen.findByRole('button', { name: /eliminar categoría/i });
      const user = fakeClock();

      await user.click(deleteBtn);
      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Nombre de la categoría 1'), 'x');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not auto-hide the total-not-100% status nor a save error', async () => {
      const saveSet = mockSingleBucket();
      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);
      await screen.findByRole('button', { name: /guardar distribución/i });
      const user = fakeClock();

      // Total != 100%: form-level validation stays until the user fixes it.
      const percentage = screen.getByLabelText('Porcentaje de la categoría 1');
      await user.clear(percentage); await user.type(percentage, '60');
      expect(screen.getByText(/debe sumar exactamente 100%/i)).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByText(/debe sumar exactamente 100%/i)).toBeInTheDocument();

      // A save failure stays too.
      await user.clear(percentage); await user.type(percentage, '100');
      saveSet.mockRejectedValueOnce(new DomainError('La distribución debe sumar exactamente 100%.'));
      await user.click(screen.getByRole('button', { name: /guardar distribución/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la distribución.');
      act(() => { vi.advanceTimersByTime(10000); });
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('fixed savings category', () => {
    const mockRepo = (buckets: unknown[], saveSet = echoSaveSet()) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalCategoryRepository as any).mockImplementation(function () {
        return {
          getDistributionCategories: vi.fn().mockResolvedValue(buckets),
          saveDistributionSet: saveSet,
          countExpenseCategoriesByDistribution: vi.fn().mockResolvedValue(0),
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (LocalMovementRepository as any).mockImplementation(function () {
        return { countByDistributionCategory: vi.fn().mockResolvedValue(0) };
      });
      return saveSet;
    };

    it('has no savings selector: the savings category is labelled "Ahorro · fija" and cannot be deleted', async () => {
      mockRepo([]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

      await screen.findByRole('button', { name: /guardar distribución/i });
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screen.getAllByText('Ahorro · fija')).toHaveLength(1);
      // Default seed order: Necesidades, Gustos, Ahorro e Inversión (savings, no delete action)
      expect(screen.getAllByRole('button', { name: /eliminar categoría/i })).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /eliminar categoría ahorro e inversión/i })).not.toBeInTheDocument();
    });

    it('labels an inherited savings category that is not the suggested one', async () => {
      mockRepo([
        { id: 'b1', user_id: 'fake-id', name: 'Metas', percentage: 30, is_default: false, is_savings: true },
        { id: 'b2', user_id: 'fake-id', name: 'Vida diaria', percentage: 70, is_default: false, is_savings: false },
      ]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

      await screen.findByRole('button', { name: /guardar distribución/i });
      expect(screen.getAllByText('Ahorro · fija')).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: /eliminar categoría/i })).toHaveLength(1);
      expect(screen.getByRole('button', { name: /eliminar categoría vida diaria/i })).toBeInTheDocument();
    });

    it('creates new distribution categories as non-savings', async () => {
      const user = userEvent.setup();
      const saveSet = mockRepo([]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

      const submit = await screen.findByRole('button', { name: /guardar distribución/i });
      saveSet.mockClear();
      await user.click(screen.getByRole('button', { name: /nueva categoría de distribución/i }));
      await user.type(screen.getByLabelText('Nombre de la categoría 4'), 'Familia');
      const first = screen.getByLabelText('Porcentaje de la categoría 1');
      await user.clear(first); await user.type(first, '40');
      const fourth = screen.getByLabelText('Porcentaje de la categoría 4');
      await user.clear(fourth); await user.type(fourth, '10');
      await user.click(submit);

      await waitFor(() => expect(saveSet).toHaveBeenCalledTimes(1));
      const saved = saveSet.mock.calls[0][1] as { name: string; is_savings: boolean }[];
      expect(saved.find(row => row.name === 'Familia')?.is_savings).toBe(false);
      expect(saved.filter(row => row.is_savings)).toHaveLength(1);
    });

    it('lets the savings category be renamed and set to 0%', async () => {
      const user = userEvent.setup();
      const saveSet = mockRepo([]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

      const submit = await screen.findByRole('button', { name: /guardar distribución/i });
      saveSet.mockClear();
      const name = screen.getByLabelText('Nombre de la categoría 3');
      await user.clear(name); await user.type(name, 'Ahorro');
      const needs = screen.getByLabelText('Porcentaje de la categoría 1');
      await user.clear(needs); await user.type(needs, '70');
      const savings = screen.getByLabelText('Porcentaje de la categoría 3');
      await user.clear(savings); await user.type(savings, '0');
      expect(submit).toBeEnabled();
      await user.click(submit);

      await waitFor(() => expect(saveSet).toHaveBeenCalledTimes(1));
      const saved = saveSet.mock.calls[0][1] as { name: string; percentage: number; is_savings: boolean }[];
      expect(saved.find(row => row.is_savings)).toMatchObject({ name: 'Ahorro', percentage: 0 });
    });

    it('shows a persistent error with the domain message when saving fails', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const saveSet = mockRepo([]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={onComplete} />);

      const submit = await screen.findByRole('button', { name: /guardar distribución/i });
      saveSet.mockRejectedValueOnce(new DomainError('La distribución debe sumar exactamente 100%.'));
      await user.click(submit);

      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la distribución. La distribución debe sumar exactamente 100%.');
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('shows only the generic message for an unexpected save failure and does not log silently', async () => {
      const user = userEvent.setup();
      const saveSet = mockRepo([]);

      render(<OnboardingStep2 profileId="fake-id" onComplete={vi.fn()} />);

      const submit = await screen.findByRole('button', { name: /guardar distribución/i });
      saveSet.mockRejectedValueOnce(new Error('IDB exploded'));
      await user.click(submit);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('No se pudo guardar la distribución.');
      expect(alert).not.toHaveTextContent('IDB exploded');
    });
  });
});
