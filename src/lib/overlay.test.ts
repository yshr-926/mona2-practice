import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { parseOverlay } from './overlay.ts';

const overlay = (processors: string, layers = '3', extra = '') => `&trackball_central_listener {
  ${extra}
  scroller { layers = <${layers}>; input-processors = <&zip_xy_to_scroll_mapper>, ${processors}; };
};`;

describe('overlay のスクロール設定', () => {
  it('実物の overlay を読む', () => {
    expect(parseOverlay(readFileSync(new URL('./fixtures/mona2_r.overlay', import.meta.url), 'utf8'))).toEqual({
      scrollLayers: [3], scrollInvertX: true, scrollInvertY: false,
    });
  });
  it('複数レイヤーと入れ子の define を展開する', () => {
    expect(parseOverlay('#define NAV SCROLL\n#define SCROLL 2\n' + overlay('<&zip_scroll_scaler 1 5>', 'NAV 4'))).toEqual({
      scrollLayers: [2, 4], scrollInvertX: false, scrollInvertY: false,
    });
  });
  it('両軸の反転と有効なオートマウスを読む', () => {
    expect(parseOverlay(overlay('<&zip_scroll_transform (INPUT_TRANSFORM_X_INVERT | INPUT_TRANSFORM_Y_INVERT)>', '1', 'input-processors = <&zip_temp_layer 2 1000>;'))).toEqual({
      scrollLayers: [1], autoMouseLayer: 2, scrollInvertX: true, scrollInvertY: true,
    });
  });
  it('コメントアウトやポインタ側の反転をスクロール側と混同しない', () => {
    expect(parseOverlay(overlay('<&zip_xy_transform INPUT_TRANSFORM_X_INVERT>, <&zip_scroll_scaler 1 5>', '3', '// input-processors = <&zip_temp_layer 2 1000>;'))).toEqual({
      scrollLayers: [3], scrollInvertX: false, scrollInvertY: false,
    });
  });
  it('未知とスクロール設定無しを区別する', () => {
    expect(parseOverlay('')).toBeUndefined();
    expect(parseOverlay('&trackball_central_listener { };')).toEqual({ scrollLayers: [] });
    expect(parseOverlay(overlay('<&zip_scroll_scaler 1 5>', 'UNKNOWN'))).toBeUndefined();
    expect(parseOverlay('&trackball_central_listener { status = "disabled"; };')).toBeUndefined();
  });
});
