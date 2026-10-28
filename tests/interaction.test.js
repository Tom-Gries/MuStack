import test from 'node:test';
import assert from 'node:assert/strict';
import { dragSelection, overlappingTarget } from '../src/board.js';

test('grabbing a card carries exactly that card and all cards above it', () => {
  const cards = [{ id: 'a', stackId: 'a', order: 0 }, { id: 'b', stackId: 'a', order: 1 }, { id: 'c', stackId: 'a', order: 2 }, { id: 'd', stackId: 'd', order: 0 }];
  assert.deepEqual(dragSelection(cards, 'a'), ['a', 'b', 'c']);
  assert.deepEqual(dragSelection(cards, 'b'), ['b', 'c']);
  assert.deepEqual(dragSelection(cards, 'c'), ['c']);
  assert.deepEqual(dragSelection(cards, 'missing'), []);
});
test('a substantial visual overlap stacks even when the pointer is outside the target', () => {
  const rect = { left: 0, top: 0, width: 128, height: 174 };
  const targets = [{ id: 'dragged', ...rect }, { id: 'target', left: 70, top: 25, width: 128, height: 174 }];
  assert.equal(overlappingTarget(rect, targets, ['dragged']), 'target');
  assert.equal(overlappingTarget(rect, [{ id: 'far', left: 126, top: 0, width: 128, height: 174 }]), undefined);
});
