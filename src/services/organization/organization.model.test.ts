import { organizationModel } from './organization.model';

describe('Organization Model', () => {
  describe('name validation', () => {
    it('should validate a valid organization name', () => {
      const validData = {
        name: 'Test Organization',
        plan: 'basic',
      };
      const result = organizationModel.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidData = {
        name: '',
        plan: 'basic',
      };
      const result = organizationModel.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name must be at least 3 characters');
      }
    });

    it('should reject name longer than 40 characters', () => {
      const invalidData = {
        name: 'A'.repeat(41),
        plan: 'basic',
      };
      const result = organizationModel.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Name must be less than 40 characters');
      }
    });
  });

  describe('address validation', () => {
    it('should accept organization with address', () => {
      const validData = {
        name: 'Test Organization',
        address: '123 Test St',
        plan: 'basic',
      };
      const result = organizationModel.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept organization without address', () => {
      const validData = {
        name: 'Test Organization',
        plan: 'basic',
      };
      const result = organizationModel.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('plan validation', () => {
    it('should require plan field', () => {
      const invalidData = {
        name: 'Test Organization',
      };
      const result = organizationModel.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid plan', () => {
      const validData = {
        name: 'Test Organization',
        plan: 'premium',
      };
      const result = organizationModel.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});