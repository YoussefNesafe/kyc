/**
 * What jsdom does not implement and the form needs anyway.
 *
 * `ResizeObserver` is the only entry so far. Radix's `useSize` — reached from
 * the select trigger, the radio indicator and the popover the country field
 * opens — constructs one in a layout effect, so without it any test that renders
 * a step of the real form dies before its first assertion, with a stack in
 * `react-dom` that says nothing about the cause.
 *
 * It is a stub rather than a polyfill on purpose: nothing under test asserts on
 * a measured size, and a real implementation in jsdom would have nothing to
 * measure — every element is 0×0. The contract that matters is that constructing
 * one, observing, and disconnecting do not throw.
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
