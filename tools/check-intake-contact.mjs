import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';

// Run the deployed standalone module with optional controls, without network or storage.
const target = resolve(process.argv[2] || fileURLToPath(new URL(
  '../../../website/public/consultation/src/accident-purchase.js', import.meta.url)));
const source = (await readFile(target, 'utf8')).replace(/^import\s+[^\n]+;\r?$/gm, '');

function element() {
  const listeners = new Map(), children = new Map();
  return {
    dataset: {}, classList: {toggle() {}}, value: '',
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatch(type, value) { this.value = value; listeners.get(type)?.({target: this}); },
    querySelector(selector) {
      if (!children.has(selector)) children.set(selector, element());
      return children.get(selector);
    },
    querySelectorAll() { return []; },
    append() {}, replaceChildren() {}, setAttribute() {}, removeAttribute() {}, focus() {},
  };
}

function boot(withContact) {
  const elements = new Map(), body = element();
  const document = {
    body, documentElement: {lang: 'ko'}, addEventListener() {},
    querySelector(selector) {
      if (selector === '#review-contact' && !withContact) return null;
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() { return []; }, createElement: element,
  };
  const observed = {saves: 0, stages: 0, snapshot: null};
  const noop = () => {};
  const dependencies = {
    document, window: {}, sessionStorage: {getItem() { return null; }},
    startNaverTracking: noop, startDetailedAnalytics: noop, mountNavigation: noop,
    startAnalytics: noop, initializeLanguage: noop, localize: noop, t: value => value,
    mountReasonDialog: noop, createExitConfirmation: noop, createFormHistory: noop,
    publishFormState() { observed.stages++; },
    mountDraftStorage() {
      return {load: () => new Promise(() => {}), save() { observed.saves++; }};
    },
    activeQuestions: () => [{id: 'service', kind: 'cards'}], serviceTypes: [], accidentTypes: [],
    hasAirbag: () => false, hasFinance: () => false, photoMarkup: () => '',
    conditionFields: () => [], answerInput: noop, detailInputs: noop,
    consultationText: () => '', renderConsultation: noop,
    mountPhotos: () => ({photos: [], render: noop, ready: async () => {}}),
    mountSubmission(snapshot) { observed.snapshot = snapshot; return {reset: noop}; },
  };
  // Leave draft loading pending so this check isolates synchronous module boot and input binding.
  runInNewContext(source, dependencies, {filename: target, timeout: 1000});
  return {document, observed};
}

let standalone;
assert.doesNotThrow(() => { standalone = boot(false); },
  'The standalone form must boot when it has no optional review contact control.');
assert.equal(typeof standalone.observed.snapshot, 'function');
const withContact = boot(true);
const before = {...withContact.observed};
withContact.document.querySelector('#review-contact').dispatch('input', '01000000000');
assert.equal(withContact.observed.snapshot().values.contact, '01000000000',
  'A present review contact control must still update the submitted values.');
assert.equal(withContact.observed.saves, before.saves + 1,
  'Contact changes must continue to save the draft.');
assert.equal(withContact.observed.stages, before.stages + 1,
  'Contact changes must continue to update form progress.');
console.log('PASS: standalone module boots without optional review contact; present contact updates submission, draft and progress. No submissions sent.');
