import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog } from '@stackfriends/shared/catalog.js';
import { addCard, applyCommand } from '@stackfriends/shared/game.js';
import { createPersonalWorld } from '@stackfriends/shared/personal-world.js';
import { previewMove, WorldPresentation } from '../src/lib/world-presentation.js';

const make = (id = 'tom') => createPersonalWorld({ id, name: id }, getCatalog(), 1000);
const human = (world) => world.cards.find((card) => card.type === 'human');
const move = (cardId, x = 650, y = 350, extra = {}) => ({ type: 'move', cardId, x, y, split: true, takeAbove: true, ...extra });
function layout(world) {
  return world.cards.map((card) => ({ id: card.id, x: card.x, y: card.y, order: card.order, equippedTo: card.equippedTo, toolId: card.toolId,
    stack: world.cards.filter((other) => other.stackId === card.stackId).map((other) => other.id).sort() }));
}
function serverMove(world, command) {
  const next = structuredClone(world);
  applyCommand(next, command, { playerId: world.id, now: 1000, rng: () => 0.5 });
  next.revision++;
  return next;
}

test('ordinary drops show their final position immediately without mutating the saved world', () => {
  const saved = make();
  const before = structuredClone(saved);
  const command = move(human(saved).id);
  const projected = previewMove(saved, command, 1000, 'first');
  assert.equal(human(projected).x, 650);
  assert.equal(human(projected).y, 350);
  assert.deepEqual(saved, before);
  assert.equal(projected.catalog, saved.catalog);
  assert.equal(projected.clock, saved.clock);
  assert.equal(projected.revision, saved.revision);
  assert.deepEqual(layout(projected), layout(serverMove(saved, command)));
});

test('a partial stack preview carries exactly the selected level and every card above it', () => {
  const saved = make();
  const stack = Array.from({ length: 5 }, (_, order) => addCard(saved, 'stone', 500, 500, { stackId: 'stones', order }));
  const command = move(stack[2].id);
  const projected = previewMove(saved, command, 1000, 'partial');
  assert.deepEqual(layout(projected), layout(serverMove(saved, command)));
  assert.equal(projected.cards.find((card) => card.id === stack[0].id).x, 500);
  assert.equal(projected.cards.find((card) => card.id === stack[4].id).x, 650);
});

test('stack targets and a hundred-card stack agree with the authoritative move layout', () => {
  const saved = make();
  const stack = Array.from({ length: 100 }, (_, order) => addCard(saved, 'stone', 500, 500, { stackId: 'stones', order }));
  const command = move(human(saved).id, 500, 500, { targetId: stack[0].id });
  assert.deepEqual(layout(previewMove(saved, command, 1000, 'large')), layout(serverMove(saved, command)));
});

test('an older acknowledgement cannot undo a second drop of the same card', () => {
  const saved = make(), view = new WorldPresentation(), cardId = human(saved).id;
  view.accept(saved);
  view.preview('first', move(cardId), 1000);
  assert.equal(human(view.preview('second', move(cardId, 900, 450), 1000)).x, 900);
  const firstReply = serverMove(saved, move(cardId));
  view.remove('first');
  assert.equal(human(view.accept(firstReply)).x, 900);
  assert.equal(human(view.accept(saved)).x, 900);
  const secondReply = serverMove(firstReply, move(cardId, 900, 450));
  view.remove('second');
  assert.equal(human(view.accept(secondReply)).x, 900);
  assert.equal(view.pending.size, 0);
});

test('a later stack split rebases on the first reply even when temporary stack IDs change', () => {
  const saved = make(), view = new WorldPresentation();
  const first = addCard(saved, 'wood', 500, 500, { stackId: 'source', order: 0 });
  const second = addCard(saved, 'stone', 500, 500, { stackId: 'source', order: 1 });
  const destination = saved.cards.find((card) => card.type === 'gold');
  const one = move(first.id, 650, 350), two = move(second.id, destination.x, destination.y, { targetId: destination.id });
  view.accept(saved);
  view.preview('first', one, 1000);
  view.preview('second', two, 1000);
  const firstReply = serverMove(saved, one);
  view.remove('first');
  assert.deepEqual(layout(view.accept(firstReply)), layout(serverMove(firstReply, two)));
});

test('a failed move rolls back only its own preview while keeping a later move visible', () => {
  const saved = make(), view = new WorldPresentation();
  const gold = saved.cards.find((card) => card.type === 'gold');
  view.accept(saved);
  view.preview('failed', move(human(saved).id), 1000);
  view.preview('next', move(gold.id, 900, 450), 1000);
  view.remove('failed');
  const visible = view.view();
  assert.equal(human(visible).x, human(saved).x);
  assert.equal(visible.cards.find((card) => card.id === gold.id).x, 900);
});

test('tools follow their human and can be detached without changing saved equipment', () => {
  const saved = make(), worker = human(saved);
  const tool = addCard(saved, 'axe', worker.x, worker.y, { stackId: worker.stackId, equippedTo: worker.id, order: worker.order });
  worker.toolId = tool.id;
  for (const command of [move(worker.id), move(tool.id, 900, 450, { takeAbove: false })]) {
    assert.deepEqual(layout(previewMove(saved, command, 1000, 'tool')), layout(serverMove(saved, command)));
  }
  assert.equal(tool.equippedTo, worker.id);
  assert.equal(worker.toolId, tool.id);
});

test('previews never open packs, spend gold, consume food or run jobs', () => {
  const saved = make(), worker = human(saved);
  const gold = saved.cards.find((card) => card.type === 'gold');
  const bank = addCard(saved, 'piggyBank', 500, 500, { gold: 4 });
  const berry = addCard(saved, 'berry', 700, 500);
  worker.hp = 70;
  assert.equal(previewMove(saved, move(gold.id, 500, 500, { zone: 'shop' }), 1000, 'shop'), saved);
  assert.equal(previewMove(saved, { type: 'open-pack', cardId: gold.id }, 1000, 'open'), saved);
  const deposit = previewMove(saved, move(gold.id, 500, 500, { targetId: bank.id }), 1000, 'bank');
  assert.equal(deposit.cards.find((card) => card.id === bank.id).gold, 4);
  assert.equal(deposit.cards.length, saved.cards.length);
  const food = previewMove(saved, move(berry.id, worker.x, worker.y, { targetId: worker.id }), 1000, 'food');
  assert.equal(human(food).hp, 70);
  assert.deepEqual(food.jobs, saved.jobs);
});

test('switching worlds clears pending positions instead of carrying them to another player', () => {
  const view = new WorldPresentation(), saved = make();
  view.accept(saved);
  view.preview('first', move(human(saved).id), 1000);
  const other = make('anna');
  assert.equal(view.accept(other), other);
  assert.equal(view.pending.size, 0);
});
