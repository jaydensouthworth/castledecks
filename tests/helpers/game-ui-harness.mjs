import {TestLocks,settle} from './local-storage.mjs';
import {readFile} from 'node:fs/promises';
import {CampaignBattle} from '../../site/dist/engine/first-battle.mjs';

// Bounded Node integration harness, not a browser emulator. The unmodified UI
// module and engine run together. Rendering, layout, native focus order, real
// pointer capture, and device input still require browser/device QA.
const gameURL = new URL('../../site/dist/battle.mjs', import.meta.url);
const markupURL = new URL('../../site/dist/battle.html', import.meta.url);
let instance = 0;

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(fn => fn !== handler));
  }
}

function matches(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  if (selector.includes(':not(:disabled)') && node.disabled) return false;
  selector = selector.replace(':not(:disabled)', '');
  const tag = selector.match(/^[a-z]+/i)?.[0];
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    if (!node.attributes.has(name)) return false;
    if (value !== undefined && node.attributes.get(name) !== value) return false;
  }
  return !!tag || selector.startsWith('[');
}

class Node extends Target {
  constructor(tagName, document, attributes = new Map()) {
    super();
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.attributes = attributes;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = Object.fromEntries([...attributes].filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5), value]));
    this.id = attributes.get('id') ?? '';
    this.value = attributes.get('value') ?? '';
    this.disabled = attributes.has('disabled');
    this.checked = attributes.has('checked');
    this._text = '';
    const classes = new Set((attributes.get('class') ?? '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle: (name, force = !classes.has(name)) => { if (force) classes.add(name); else classes.delete(name); return force; },
    };
  }
  get parentElement() { return this.parentNode; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(node => node !== child);
    this.children.push(child); child.parentNode = this; return child;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  get textContent() { return this._text + this.children.map(node => node.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  set innerHTML(value) { this.children = []; this._text = ''; parseHTML(String(value), this); }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(part => part.trim());
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (selectors.some(part => matches(child, part))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focus() { this.ownerDocument.activeElement = this; }
  click() { if (!this.disabled) return dispatch(this, 'click'); }
  getClientRects() {
    for (let node = this; node; node = node.parentNode) if (node.classList?.contains('hidden')) return [];
    return [{x: 0, y: 0, width: 2000, height: 1000}];
  }
  getBoundingClientRect() { return {left: 0, top: 0, width: 2000, height: 1000}; }
  setPointerCapture(id) { this.ownerDocument.captures.set(id, this); }
  hasPointerCapture(id) { return this.ownerDocument.captures.get(id) === this; }
  releasePointerCapture(id) {
    if (!this.hasPointerCapture(id)) return;
    this.ownerDocument.captures.delete(id);
    dispatch(this, 'lostpointercapture', {pointerId: id});
  }
  getContext() {
    return new Proxy({}, {get: (target, name) => target[name] ?? ((...args) => { if (this.captureDraws && (this.drawCalls ??= []).length < 20000) this.drawCalls.push({name,args}); if(name === 'createLinearGradient') return {addColorStop() {}}; }), set: (target, name, value) => { if(this.captureDraws && (this.drawCalls ??= []).length < 20000)this.drawCalls.push({name:'set:'+name,args:[value]});target[name] = value; return true; }});
  }
}

function parseHTML(html, root) {
  const stack = [root];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<[^>]*>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!')) continue;
    if (text.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (!text.startsWith('<')) { stack.at(-1)._text += text; continue; }
    const tag = text.match(/^<([\w-]+)/)?.[1];
    if (!tag) continue;
    const attrs = new Map();
    for (const [, name, double, single, unquoted] of text.slice(tag.length + 1, -1).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs.set(name, double ?? single ?? unquoted ?? '');
    const parent = stack.at(-1);
    const node = new Node(tag, root.ownerDocument, attrs);
    node.parentNode = parent;
    parent.children.push(node);
    if (tag === 'option' && parent.tagName === 'SELECT' && (!parent.value || attrs.has('selected'))) parent.value = node.value;
    if (!voidTags.has(tag) && !text.endsWith('/>')) stack.push(node);
  }
}

function dispatch(target, type, init = {}) {
  const event = {type, target, defaultPrevented: false, repeat: false, shiftKey: false, button: 0, ...init,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; this.immediateStopped = true; },
  };
  const pending = [];
  for (let node = target; node; node = node.parentNode) {
    event.currentTarget = node;
    for (const handler of [...(node.listeners.get(type) ?? []), node['on' + type]].filter(Boolean)) {
      pending.push(handler(event));
      if (event.immediateStopped) break;
    }
    if (event.stopped) break;
  }
  return {event, completed: Promise.all(pending)};
}

export async function loadGameUI(t, {search = '', storage, locks=storage?new TestLocks():undefined} = {}) {
  const document = new Node('document', null);
  document.ownerDocument = document;
  document.captures = new Map();
  document.hidden = false;
  document.createElement = tag => new Node(tag, document);
  parseHTML(await readFile(markupURL, 'utf8'), document);
  document.activeElement = document.querySelector('body');
  const window = new Target();window.localStorage=storage;window.navigator={locks};
  window.location = {search};
  let timestamp = 0;
  let nextFrame = null;
  let battle = null;
  // Observe construction through a delegated public engine method. No source
  // rewriting, fake engine, public debug export, or alternate handler is used.
  const originalElevationAt = CampaignBattle.prototype.elevationAt;
  CampaignBattle.prototype.elevationAt = function (x) { battle = this; return originalElevationAt.call(this, x); };
  const globals = {document, window, performance: {now: () => timestamp}, Image: undefined,
    requestAnimationFrame: callback => { nextFrame = callback; return 1; },
  };
  const descriptors = new Map(Object.keys(globals).map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
  t.after(() => {
    CampaignBattle.prototype.elevationAt = originalElevationAt;
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await import(`${gameURL.href}?input-test=${++instance}`);
  await settle();
  const get = id => {
    const node = document.querySelector(id.startsWith('#') ? id : '#' + id);
    if (!node) throw new Error(`Missing game UI element: ${id}`);
    return node;
  };
  return {
    document, window, get, settle, get battle() { return battle; },
    visible: id => !get(id).classList.contains('hidden'),
    click: id => get(id).click(),
    dispatch,
    key: (type, key, init = {}) => dispatch(document, type, {key, code: key === ' ' ? 'Space' : key, target: document.activeElement, ...init}),
    pointer(type, pointerId, point, target = get('battlefield')) {
      const receiver = document.captures.get(pointerId) ?? target;
      const result = dispatch(receiver, type, {pointerId, clientX: point.x, clientY: point.y});
      if (type === 'pointerup' || type === 'pointercancel') receiver.releasePointerCapture?.(pointerId);
      return result;
    },
    frames(count = 1) {
      for (let i = 0; i < count; i++) {
        const callback = nextFrame;
        if (!callback) throw new Error('The UI did not schedule its next animation frame');
        nextFrame = null;
        timestamp += 1000 / 33;
        callback(timestamp);
      }
    },
    load(file) {
      const input = get('saveFile');
      input.files = [file];
      input.value = 'chosen-save.json';
      return dispatch(input, 'change').completed;
    },
  };
}

export function deferredFile() {
  let resolve, reject;
  const result = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {file: {size: 1000, text: () => result}, resolve, reject};
}
