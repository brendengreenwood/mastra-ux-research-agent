import { describe, it, expect } from 'vitest';

// Import the tools to test their execute functions directly
import { getLensRecommendationTool } from './lens-tools.js';

// The tool's execute function can be called directly with typed input
const execute = getLensRecommendationTool.execute!;
const dummyContext = {} as any;

describe('getLensRecommendationTool', () => {
  it('recommends OOUX + MentalModel for discovery phase', async () => {
    const result = await execute(
      { dataType: 'attitudinal', methodology: 'qualitative', phase: 'discovery' },
      dummyContext,
    );
    expect(result).toMatchObject({
      primaryLens: 'OOUX',
      secondaryLens: 'MentalModel',
    });
  });

  it('recommends Activity + JTBD for definition phase', async () => {
    const result = await execute(
      { dataType: 'behavioral', methodology: 'qualitative', phase: 'definition' },
      dummyContext,
    );
    expect(result).toMatchObject({
      primaryLens: 'Activity',
      secondaryLens: 'JTBD',
    });
  });

  it('recommends Activity + TaskAnalysis for behavioral data (non-discovery/definition)', async () => {
    const result = await execute(
      { dataType: 'behavioral', methodology: 'qualitative', phase: 'validation' },
      dummyContext,
    );
    expect(result).toMatchObject({
      primaryLens: 'Activity',
      secondaryLens: 'TaskAnalysis',
    });
  });

  it('recommends JTBD + MentalModel for attitudinal data (non-discovery/definition)', async () => {
    const result = await execute(
      { dataType: 'attitudinal', methodology: 'qualitative', phase: 'validation' },
      dummyContext,
    );
    expect(result).toMatchObject({
      primaryLens: 'JTBD',
      secondaryLens: 'MentalModel',
    });
  });

  it('discovery phase takes priority over data type', async () => {
    // Even with behavioral data, discovery should still pick OOUX
    const result = await execute(
      { dataType: 'behavioral', methodology: 'mixed', phase: 'discovery' },
      dummyContext,
    );
    expect(result).toMatchObject({ primaryLens: 'OOUX' });
  });

  it('definition phase takes priority over data type', async () => {
    const result = await execute(
      { dataType: 'attitudinal', methodology: 'quantitative', phase: 'definition' },
      dummyContext,
    );
    expect(result).toMatchObject({ primaryLens: 'Activity', secondaryLens: 'JTBD' });
  });

  it('includes reasoning for every recommendation', async () => {
    const phases = ['discovery', 'definition', 'validation', 'iteration'] as const;
    for (const phase of phases) {
      const result = await execute(
        { dataType: 'attitudinal', methodology: 'qualitative', phase },
        dummyContext,
      );
      expect(result).toHaveProperty('reasoning');
      expect((result as any).reasoning.length).toBeGreaterThan(0);
    }
  });
});
