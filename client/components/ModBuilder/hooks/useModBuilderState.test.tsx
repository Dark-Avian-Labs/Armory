import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useModBuilderState } from './useModBuilderState';

describe('useModBuilderState', () => {
  it('resets builder fields when the route key changes', () => {
    const { result, rerender } = renderHook(
      (props: { routeKey: string; buildId: string | undefined; routeEqType: string | undefined }) =>
        useModBuilderState(props.routeKey, props.buildId, props.routeEqType),
      {
        initialProps: { routeKey: 'warframe/excal', buildId: undefined as string | undefined, routeEqType: 'warframe' },
      },
    );

    act(() => {
      result.current.setBuildName('Excalibur Prime');
      result.current.setOrokinReactor(true);
    });
    expect(result.current.buildName).toBe('Excalibur Prime');
    expect(result.current.orokinReactor).toBe(true);

    rerender({ routeKey: 'primary/braton', buildId: '12', routeEqType: 'primary' });

    expect(result.current.buildName).toBe('New Build');
    expect(result.current.orokinReactor).toBe(false);
    expect(result.current.equipmentType).toBe('primary');
    expect(result.current.currentBuildId).toBe('12');
  });
});
