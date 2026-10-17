import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useActiveSharedSpaces } from './useActiveSharedSpaces';

const repos = vi.hoisted(() => ({
  getAllForUser: vi.fn(),
  getMembers: vi.fn(),
}));

vi.mock('../../infrastructure/repositories/local/LocalSharedSpaceRepository', () => ({
  LocalSharedSpaceRepository: vi.fn(function () { return { getAllForUser: repos.getAllForUser }; }),
}));
vi.mock('../../infrastructure/repositories/local/LocalMembershipRepository', () => ({
  LocalMembershipRepository: vi.fn(function () { return { getMembers: repos.getMembers }; }),
}));

const member = (user_id: string) => ({ id: `m-${user_id}`, shared_space_id: 's1', user_id });

beforeEach(() => {
  repos.getAllForUser.mockReset().mockResolvedValue([{ id: 's1', name: 'Casa' }]);
  repos.getMembers.mockReset().mockResolvedValue([member('ana'), member('bob')]);
});

describe('useActiveSharedSpaces', () => {
  it('returns the spaces the user belongs to with their members', async () => {
    const { result } = renderHook(() => useActiveSharedSpaces('ana'));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ id: 's1', name: 'Casa' });
    expect(result.current[0].members.map(m => m.user_id)).toEqual(['ana', 'bob']);
    expect(repos.getAllForUser).toHaveBeenCalledWith('ana');
    expect(repos.getMembers).toHaveBeenCalledWith('s1');
  });

  it('is empty without a user and does not read anything when disabled', () => {
    const { result: noUser } = renderHook(() => useActiveSharedSpaces(null));
    const { result: disabled } = renderHook(() => useActiveSharedSpaces('ana', false));
    expect(noUser.current).toEqual([]);
    expect(disabled.current).toEqual([]);
    expect(repos.getAllForUser).not.toHaveBeenCalled();
  });

  it('stays empty when the user has no spaces', async () => {
    repos.getAllForUser.mockResolvedValue([]);
    const { result } = renderHook(() => useActiveSharedSpaces('ana'));
    await waitFor(() => expect(repos.getAllForUser).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
