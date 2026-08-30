// @vitest-environment jsdom
/**
 * The two properties that make a second visit to the index work, pinned.
 *
 * ─── WHAT THIS FILE EXISTS TO STOP HAPPENING AGAIN (prompt 13) ────────────────────
 * Reported as "the five columns go dead after you navigate back to the index": from
 * `/en/projects`, clicking the wordmark returned to `/en` with the columns rendered and
 * neither hoverable nor clickable, cured only by a full reload.
 *
 * The cause was not the transition and not the router. `runOpen` writes `is-active` onto
 * the column it opens and `inert` onto the other four, and `destroy()` reversed neither —
 * on the assumption, stated in this module and in `ShellTransition`, that leaving the index
 * unmounts those elements. It does not: the App Router keeps a visited segment MOUNTED AND
 * HIDDEN, so the five `.col` nodes survive the round trip and come back still marked. An
 * `inert` element receives no pointer event, no hover and no focus.
 *
 * So the assertions here are about STATE, not about timing: after `open()` and `destroy()`
 * the document must look the way a fresh load would leave it, and a shell built over a
 * replaced `#cols` must be bound to the new elements rather than to the ones it captured.
 * Both are the kind of thing a "simplification" of `destroy()` silently undoes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShell, type ShellApi, type ShellOptions } from '../shell';

/**
 * jsdom has neither WAAPI nor `ResizeObserver`, and `createShell` uses both on
 * construction. These are the smallest stand-ins that let the real module run: `animate`
 * has to return something with a settling `finished`, because `anim.ts` races it.
 */
const animations: Animation[] = [];

function installDomStubs(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Element.prototype.animate = function animateStub(): Animation {
    const animation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
      finish: vi.fn(),
    } as unknown as Animation;
    animations.push(animation);
    return animation;
  } as unknown as Element['animate'];
}

/** The index markup `ColumnShell` renders, reduced to what the shell addresses by name. */
const IDS = ['projects', 'design', 'media', 'studio', 'contact'] as const;

function columnsMarkup(): string {
  return IDS.map(
    (id, i) => `
      <section class="col" data-id="${id}" data-i="${i}">
        <i class="col__rule"></i>
        <div class="col__art" data-art="plan" data-seed="kavan-${id}"></div>
        <span class="col__idx">0${i + 1}</span>
        <h2 class="col__title">
          <a class="col__hit" href="/en/${id}" data-open="${id}"><span class="ch">A</span></a>
        </h2>
        <p class="col__caption">caption</p>
      </section>`,
  ).join('');
}

function mountDocument(): void {
  document.body.innerHTML = `
    <div class="stage" id="stage">
      <header class="masthead">
        <a id="home" href="/en">KAVAN</a>
        <div class="marks"><i class="mark"></i><i class="mark"></i></div>
      </header>
      <nav class="cols" id="cols">${columnsMarkup()}</nav>
      <i class="wipe" id="wipe"></i>
    </div>`;
}

const options = (overrides: Partial<ShellOptions> = {}): ShellOptions => ({
  mountPanel: () => {},
  unmountPanel: () => {},
  nav: () => [],
  t: () => '',
  num: value => value,
  isRTL: () => false,
  ...overrides,
});

const columns = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.col')];
const inertIds = (): string[] =>
  columns()
    .filter(col => col.hasAttribute('inert'))
    .map(col => col.dataset.id ?? '');

/** The transition awaits real timers; run it to completion rather than sampling it. */
async function settle(shell: ShellApi): Promise<void> {
  await vi.waitFor(() => expect(shell.busy).toBe(false), { timeout: 5000, interval: 20 });
}

beforeEach(() => {
  animations.length = 0;
  installDomStubs();
  mountDocument();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('destroy() leaves the document as a fresh load would', () => {
  it('takes `inert` back off every column it collapsed', async () => {
    const shell = createShell(options());

    shell.open('projects');
    await settle(shell);
    // The precondition: this is the state the bug left behind.
    expect(inertIds()).toEqual(['design', 'media', 'studio', 'contact']);

    shell.destroy();

    expect(inertIds()).toEqual([]);
  });

  it('takes `is-active` off the column it opened', async () => {
    const shell = createShell(options());

    shell.open('media');
    await settle(shell);
    expect(document.querySelector('.col.is-active')?.getAttribute('data-id')).toBe('media');

    shell.destroy();

    expect(document.querySelector('.col.is-active')).toBeNull();
  });

  it('clears the hover state and the inline rule colour it painted', () => {
    const shell = createShell(options());
    const col = columns()[0];

    col.dispatchEvent(new Event('pointerover', { bubbles: true }));
    expect(col.classList.contains('is-hover')).toBe(true);
    expect(col.querySelector<HTMLElement>('.col__rule')?.style.background).not.toBe('');

    shell.destroy();

    expect(col.classList.contains('is-hover')).toBe(false);
    expect(col.querySelector<HTMLElement>('.col__rule')?.style.background).toBe('');
  });

  it('cancels the forwards-filled mark animations it started on the masthead', async () => {
    const shell = createShell(options());

    shell.open('studio');
    await settle(shell);
    expect(animations.length).toBeGreaterThan(0);

    shell.destroy();

    // The marks live in the LAYOUT and outlive the shell; a forwards fill left running is
    // this shell still asserting a position `MarkStepper` now owns.
    const marks = [...document.querySelectorAll<HTMLElement>('.mark')];
    expect(marks.every(mark => mark.style.opacity === '')).toBe(true);
  });

  it('does NOT touch `is-open` on #stage — Stage renders that from the pathname', async () => {
    const shell = createShell(options());
    const stage = document.getElementById('stage') as HTMLElement;

    shell.open('projects');
    await settle(shell);
    expect(stage.classList.contains('is-open')).toBe(true);

    shell.destroy();

    /**
     * One owner per class. `Stage.tsx` renders `is-open` from the pathname and React only
     * rewrites `className` when its own prop changed — so a removal here would strip a
     * class React still believes it wrote, and the section route would lose its chrome
     * with nothing able to put it back. See `Stage.tsx`'s header.
     */
    expect(stage.classList.contains('is-open')).toBe(true);
  });
});

describe('a shell built over a replaced #cols binds to the NEW elements', () => {
  it('opens a column in the replacement subtree, not the captured one', async () => {
    const first = createShell(options());
    first.destroy();

    // What a re-render produces: the same ids, different nodes.
    const wrap = document.getElementById('cols') as HTMLElement;
    wrap.innerHTML = columnsMarkup();

    const onChange = vi.fn();
    const second = createShell(options({ onChange }));

    const hit = wrap.querySelector<HTMLElement>('.col[data-id="design"] .col__hit');
    hit?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle(second);

    expect(onChange).toHaveBeenCalledWith({ id: 'design', push: true });
    expect(wrap.querySelector('.col.is-active')?.getAttribute('data-id')).toBe('design');

    second.destroy();
  });
});

describe('a click either navigates or does not preventDefault — never both', () => {
  it('prevents the anchor and navigates itself for a column it owns', async () => {
    const onChange = vi.fn();
    const shell = createShell(options({ onChange }));

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('.col[data-id="contact"] .col__hit')?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await settle(shell);
    expect(onChange).toHaveBeenCalledWith({ id: 'contact', push: true });
  });

  it('leaves the anchor alone when there is no such column', () => {
    createShell(options());

    // `go()` returns at its first line for an id `byId` does not hold. Preventing the
    // click first would turn a real link into a dead one, with no error anywhere.
    const stray = document.createElement('a');
    stray.className = 'col__hit';
    stray.href = '/en/nowhere';
    stray.dataset.open = 'nowhere';
    document.getElementById('cols')?.append(stray);

    /**
     * Read the verdict at `document`, which bubbles AFTER `#cols` where the shell listens,
     * and stop it there so jsdom does not try to follow the href it just proved is live.
     */
    let preventedByTheShell: boolean | null = null;
    document.addEventListener(
      'click',
      e => {
        preventedByTheShell = e.defaultPrevented;
        e.preventDefault();
      },
      { once: true },
    );

    stray.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(preventedByTheShell).toBe(false);
  });
});
