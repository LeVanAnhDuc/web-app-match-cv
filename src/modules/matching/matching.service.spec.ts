import { MatchingService } from './matching.service';

// Pure-scoring unit tests only — persistence + Gemini orchestration methods
// are covered by matching.e2e-spec.ts (with GeminiService overridden via DI).
function makeService(): MatchingService {
  // The pure methods under test (cosine/keywordScore/combineOverall) never
  // touch the injected collaborators, so undefined stand-ins are sufficient.
  return new MatchingService(
    undefined as never,
    undefined as never,
    undefined as never,
  );
}

describe('MatchingService', () => {
  describe('cosine()', () => {
    it('returns 1 for identical vectors', () => {
      const service = makeService();
      expect(service.cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      const service = makeService();
      expect(service.cosine([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('returns -1 for opposite vectors', () => {
      const service = makeService();
      expect(service.cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
    });

    it('returns 0 for a zero vector (avoids division by zero)', () => {
      const service = makeService();
      expect(service.cosine([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
      const service = makeService();
      expect(service.cosine([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('keywordScore()', () => {
    it('[EP full overlap] returns 100 when every JD keyword is present in the CV', () => {
      const service = makeService();
      const score = service.keywordScore(
        'Experienced TypeScript React NestJS developer available now',
        'TypeScript React NestJS developer',
      );
      expect(score).toBe(100);
    });

    it('[EP partial overlap] returns a score strictly between 0 and 100', () => {
      const service = makeService();
      const score = service.keywordScore(
        'Experienced TypeScript developer',
        'Looking for TypeScript React NestJS Kubernetes developer',
      );
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('[EP no overlap] returns 0 when no JD keyword is present in the CV', () => {
      const service = makeService();
      const score = service.keywordScore(
        'Baking sourdough bread and pastry',
        'Looking for TypeScript React NestJS developer',
      );
      expect(score).toBe(0);
    });

    it('[boundary] returns 0 when the JD has no meaningful tokens', () => {
      const service = makeService();
      expect(service.keywordScore('TypeScript developer', 'a an the')).toBe(0);
    });
  });

  describe('combineOverall()', () => {
    it('combines using 0.6*semantic + 0.4*keyword, rounded', () => {
      const service = makeService();
      expect(service.combineOverall(80, 60)).toBe(
        Math.round(0.6 * 80 + 0.4 * 60),
      );
      expect(service.combineOverall(100, 0)).toBe(60);
      expect(service.combineOverall(0, 100)).toBe(40);
    });

    it('clamps the result to [0, 100]', () => {
      const service = makeService();
      expect(service.combineOverall(100, 100)).toBe(100);
      expect(service.combineOverall(0, 0)).toBe(0);
    });
  });
});
