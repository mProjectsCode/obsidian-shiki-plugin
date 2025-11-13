import { describe, test, expect } from 'bun:test';
import 'tests/happydom';
import { injectIconIntoFrame, createIconElement, getIconIdFor } from 'src/icons/iconRenderer';

describe('Icon renderer smoke tests', () => {
  test('createIconElement returns element with svg', () => {
    const el = createIconElement('python');
    expect(el).toBeTruthy();
    expect(el.className).toBe('shiki-vscode-icon');
    expect(el.innerHTML.length).toBeGreaterThan(0);
  });

  test('getIconIdFor resolves filename and lang', () => {
    expect(getIconIdFor('script.py')).toBe('python');
    expect(getIconIdFor('python')).toBe('python');
    expect(getIconIdFor('unknownlang')).toBeUndefined();
  });

  test('injectIconIntoFrame prepends icon to title element', () => {
    const container = document.createElement('div');
    // simulate expressive-code frame structure
    container.innerHTML = `<div class="ec-frame"><div class="ec-frame-title">script.py</div><pre><code>print('hi')</code></pre></div>`;
    const frame = container.querySelector('.ec-frame') as HTMLElement;
    const ok = injectIconIntoFrame(frame, { filename: 'script.py', language: 'python' });
    expect(ok).toBe(true);
    const title = frame.querySelector('.ec-frame-title') as HTMLElement;
    expect(title.firstElementChild).not.toBeNull();
    expect(title.firstElementChild?.classList.contains('shiki-vscode-icon')).toBe(true);
  });
});
