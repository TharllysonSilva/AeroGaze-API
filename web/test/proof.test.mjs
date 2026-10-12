import test from 'node:test';
import assert from 'node:assert/strict';
import { proofState } from '../lib/proof-state.ts';
const result = { valid: true, status: 'ancorado', anchor: { mode: 'evm' }, onChain: { checked: true, matches: true, revoked: false } };
test('only verified EVM proof is green', () => assert.equal(proofState(result).tone, 'ok'));
test('RPC outage is pending, not verified or tampered', () => assert.equal(proofState({ ...result, onChain: { checked: false } }).tone, 'warning'));
test('pending batch does not claim network confirmation', () => assert.equal(proofState({ ...result, status: 'pendente' }).tone, 'warning'));
test('mock batch stays explicitly simulated', () => assert.match(proofState({ ...result, anchor: { mode: 'mock' } }).title, /simulada/));
test('revoked proof fails even if the root matches', () => assert.equal(proofState({ ...result, onChain: { checked: true, matches: true, revoked: true } }).tone, 'error'));
test('changed data fails even when RPC is unavailable', () => assert.equal(proofState({ ...result, valid: false, onChain: { checked: false } }).tone, 'error'));

test('missing revocation information cannot claim verified proof', () => assert.equal(proofState({ ...result, onChain: { checked: true, matches: true } }).tone, 'warning'));
