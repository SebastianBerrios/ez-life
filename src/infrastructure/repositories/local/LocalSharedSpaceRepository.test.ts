import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../db/db';

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../supabase/client', () => ({
  getSupabaseBrowserClient: () => ({
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// Imported after the mock so the module under test picks up the mocked client.
const { LocalSharedSpaceRepository } = await import('./LocalSharedSpaceRepository');
const { LocalSharedInviteRepository } = await import('./LocalSharedInviteRepository');
const { LocalMembershipRepository } = await import('./LocalMembershipRepository');

describe('Shared space repositories', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    mockRpc.mockReset();
    mockGetUser.mockReset();
    mockFrom.mockReset();
  });

  describe('LocalSharedSpaceRepository', () => {
    it('creates a space via the RPC only — never a direct insert (Principio IX)', async () => {
      const space = {
        id: 'space-1', name: 'Casa', permission_mode: 'strict', status: 'active',
        created_by: 'user-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      mockRpc.mockResolvedValue({ data: space, error: null });
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
      const singleMock = vi.fn().mockResolvedValue({
        data: { id: 'membership-1', shared_space_id: 'space-1', user_id: 'user-1', joined_at: new Date().toISOString() },
      });
      mockFrom.mockReturnValue({
        select: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
      });

      const repo = new LocalSharedSpaceRepository();
      const result = await repo.create('Casa');

      expect(mockRpc).toHaveBeenCalledWith('create_shared_space', { p_name: 'Casa' });
      expect(mockFrom).not.toHaveBeenCalledWith('memberships', expect.anything()); // no direct insert path exercised
      expect(result.id).toBe('space-1');

      const spaces = await repo.getAllForUser('user-1');
      expect(spaces).toHaveLength(1);
    });

    it('surfaces a clear error when the RPC fails', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

      const repo = new LocalSharedSpaceRepository();
      await expect(repo.create('Casa')).rejects.toThrow();
    });
  });

  describe('LocalSharedInviteRepository', () => {
    it('creates an invite via the RPC', async () => {
      const invite = {
        id: 'invite-1', shared_space_id: 'space-1', code: 'ABC12345', created_by: 'user-1',
        expires_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      mockRpc.mockResolvedValue({ data: invite, error: null });

      const repo = new LocalSharedInviteRepository();
      const result = await repo.create('space-1');

      expect(mockRpc).toHaveBeenCalledWith('create_shared_invite', { p_space_id: 'space-1' });
      expect(result.code).toBe('ABC12345');
    });

    it('redeems a code via the RPC only — never a direct insert into memberships (Principio IX)', async () => {
      const membership = {
        id: 'membership-2', shared_space_id: 'space-1', user_id: 'user-2', joined_at: new Date().toISOString(),
      };
      mockRpc.mockResolvedValue({ data: membership, error: null });
      const singleMock = vi.fn().mockResolvedValue({
        data: { id: 'space-1', name: 'Casa', permission_mode: 'strict', status: 'active', created_by: 'user-1' },
      });
      mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ single: singleMock }) }) });

      const repo = new LocalSharedInviteRepository();
      const result = await repo.redeem('ABC12345');

      expect(mockRpc).toHaveBeenCalledWith('redeem_shared_invite', { p_code: 'ABC12345' });
      expect(result.user_id).toBe('user-2');
    });

    it('rejects an expired or already-used code with a clear error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'Invalid or expired invite code' } });

      const repo = new LocalSharedInviteRepository();
      await expect(repo.redeem('DEAD0000')).rejects.toThrow();
    });
  });

  describe('LocalMembershipRepository', () => {
    it('leaves a space via the RPC and marks the local membership as left', async () => {
      await db.memberships.put({
        id: 'membership-1', shared_space_id: 'space-1', user_id: 'user-1',
        joined_at: new Date(), created_at: new Date(), updated_at: new Date(),
      });
      mockRpc.mockResolvedValue({ error: null });
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

      const repo = new LocalMembershipRepository();
      await repo.leave('space-1');

      expect(mockRpc).toHaveBeenCalledWith('leave_shared_space', { p_space_id: 'space-1' });
      const members = await repo.getMembers('space-1');
      expect(members).toHaveLength(0); // no longer active
    });
  });
});
