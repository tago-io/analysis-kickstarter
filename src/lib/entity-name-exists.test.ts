import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchEntityList } from './fetch-entity-list';
import { entityNameExists } from './entity-name-exists';

// Mock the fetchEntityList module
vi.mock('./fetch-entity-list');

describe('entityNameExists', () => {
  beforeEach(() => {
    // Clear mock before each test
    vi.clearAllMocks();
  });

  describe('when creating a new entity', () => {
    it('should return true if entity with same name exists', async () => {
      const mockTags = [{ key: 'type', value: 'test' }];

      vi.mocked(fetchEntityList).mockResolvedValueOnce([
        { id: '1', name: 'test-entity', tags: mockTags },
      ]);

      const result = await entityNameExists({
        name: 'test-entity',
        tags: mockTags,
        isEdit: false,
      });

      expect(result).toBe(true);
      expect(fetchEntityList).toHaveBeenCalledWith({
        name: 'test-entity',
        tags: mockTags,
      });
    });

    it('should return false if no entity with same name exists', async () => {
      vi.mocked(fetchEntityList).mockResolvedValueOnce([]);

      const result = await entityNameExists({
        name: 'unique-entity',
        tags: [{ key: 'type', value: 'test' }],
      });

      expect(result).toBe(false);
    });
  });

  describe('when editing an entity', () => {
    it('should return true if multiple entities with same name exist', async () => {
      const mockTags = [{ key: 'type', value: 'test' }];

      vi.mocked(fetchEntityList).mockResolvedValueOnce([
        { id: '1', name: 'test-entity', tags: mockTags },
        { id: '2', name: 'test-entity', tags: mockTags },
      ]);

      const result = await entityNameExists({
        name: 'test-entity',
        tags: mockTags,
        isEdit: true,
      });

      expect(result).toBe(true);
    });

    it('should return false if only one entity with same name exists', async () => {
      const mockTags = [{ key: 'type', value: 'test' }];

      vi.mocked(fetchEntityList).mockResolvedValueOnce([
        { id: '1', name: 'test-entity', tags: mockTags },
      ]);

      const result = await entityNameExists({
        name: 'test-entity',
        tags: mockTags,
        isEdit: true,
      });

      expect(result).toBe(false);
    });
  });

  it('should handle error from fetchEntityList', async () => {
    vi.mocked(fetchEntityList).mockRejectedValueOnce(new Error('API Error'));

    await expect(entityNameExists({
      name: 'test-entity',
      tags: [{ key: 'type', value: 'test' }],
    })).rejects.toThrow('API Error');
  });
});