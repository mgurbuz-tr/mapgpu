import { describe, it, expect } from 'vitest';
import { SymbolID } from './renderer/utilities/SymbolID';

describe('SymbolID — SIDC parsing', () => {
  // 2525D friendly infantry battalion:
  // Version=10, SI=03 (Friend), SS=10 (LandUnit), Status=0, HQTFD=0,
  // Echelon=16 (Battalion), Entity=121100, Mod1=00, Mod2=00
  const FRIENDLY_INF_BN = '100310000016121100000000000000';

  // 2525E hostile land equipment:
  // Version=13, SI=06 (Hostile), SS=15 (LandEquipment), Status=0
  const HOSTILE_EQUIP = '130615000000211300000000000000';

  describe('getVersion', () => {
    it('should parse 2525D version', () => {
      expect(SymbolID.getVersion(FRIENDLY_INF_BN)).toBe(10);
    });

    it('should parse 2525E version', () => {
      expect(SymbolID.getVersion(HOSTILE_EQUIP)).toBe(13);
    });
  });

  describe('setVersion', () => {
    it('should update version to 2525E', () => {
      const updated = SymbolID.setVersion(FRIENDLY_INF_BN, SymbolID.Version_2525E);
      expect(SymbolID.getVersion(updated)).toBe(13);
      // rest of SIDC should remain unchanged
      expect(updated.substring(2)).toBe(FRIENDLY_INF_BN.substring(2));
    });
  });

  describe('getStandardIdentity', () => {
    it('should parse friend identity', () => {
      expect(SymbolID.getStandardIdentity(FRIENDLY_INF_BN)).toBe(3);
    });

    it('should parse hostile identity', () => {
      expect(SymbolID.getStandardIdentity(HOSTILE_EQUIP)).toBe(6);
    });
  });

  describe('getContext', () => {
    it('should return Reality (0) context', () => {
      expect(SymbolID.getContext(FRIENDLY_INF_BN)).toBe(0);
    });
  });

  describe('getAffiliation', () => {
    it('should return Friend affiliation', () => {
      expect(SymbolID.getAffiliation(FRIENDLY_INF_BN)).toBe(
        SymbolID.StandardIdentity_Affiliation_Friend
      );
    });

    it('should return Hostile affiliation', () => {
      expect(SymbolID.getAffiliation(HOSTILE_EQUIP)).toBe(
        SymbolID.StandardIdentity_Affiliation_Hostile_Faker
      );
    });
  });

  describe('getSymbolSet', () => {
    it('should parse LandUnit symbol set', () => {
      expect(SymbolID.getSymbolSet(FRIENDLY_INF_BN)).toBe(
        SymbolID.SymbolSet_LandUnit
      );
    });

    it('should parse LandEquipment symbol set', () => {
      expect(SymbolID.getSymbolSet(HOSTILE_EQUIP)).toBe(
        SymbolID.SymbolSet_LandEquipment
      );
    });
  });

  describe('setSymbolSet', () => {
    it('should update symbol set', () => {
      const updated = SymbolID.setSymbolSet(FRIENDLY_INF_BN, SymbolID.SymbolSet_Air);
      expect(SymbolID.getSymbolSet(updated)).toBe(SymbolID.SymbolSet_Air);
    });
  });

  describe('getStatus', () => {
    it('should return Present status', () => {
      expect(SymbolID.getStatus(FRIENDLY_INF_BN)).toBe(SymbolID.Status_Present);
    });
  });

  describe('setStatus', () => {
    it('should set planned status', () => {
      const updated = SymbolID.setStatus(
        FRIENDLY_INF_BN,
        SymbolID.Status_Planned_Anticipated_Suspect
      );
      expect(SymbolID.getStatus(updated)).toBe(1);
    });
  });

  describe('setAffiliation', () => {
    it('should round-trip affiliation change', () => {
      const neutral = SymbolID.setAffiliation(
        FRIENDLY_INF_BN,
        SymbolID.StandardIdentity_Affiliation_Neutral
      );
      expect(SymbolID.getAffiliation(neutral)).toBe(
        SymbolID.StandardIdentity_Affiliation_Neutral
      );
      // rest unchanged
      expect(SymbolID.getVersion(neutral)).toBe(10);
      expect(SymbolID.getSymbolSet(neutral)).toBe(10);
    });
  });

  describe('edge cases', () => {
    it('should handle short strings gracefully', () => {
      expect(SymbolID.getVersion('short')).toBe(11); // default
      expect(SymbolID.getSymbolSet('short')).toBe(0);
    });

    it('should handle 20-char minimum SIDC', () => {
      const min20 = '10031000001612110000';
      expect(SymbolID.getVersion(min20)).toBe(10);
      expect(SymbolID.getAffiliation(min20)).toBe(3);
    });
  });

  describe('version constants', () => {
    it('should have correct version values', () => {
      expect(SymbolID.Version_2525D).toBe(10);
      expect(SymbolID.Version_2525Dch1).toBe(11);
      expect(SymbolID.Version_2525E).toBe(13);
    });
  });
});
