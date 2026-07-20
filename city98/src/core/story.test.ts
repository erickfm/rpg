import { describe, expect, it } from 'vitest';
import {
  STAGES, STORY_LAST, beginStory, checkStory, currentStage, deliverStory, storyObjective,
} from './story';
import { buyGood } from './goods';
import { newGame } from './sim';

const fresh = (patch = {}) => ({ ...newGame(1), ...patch });

describe('the lost pressing', () => {
  it('does not start until you begin it', () => {
    expect(fresh().storyStage).toBe(0);
    expect(storyObjective(fresh())).toBeNull();
    expect(checkStory(fresh())).toBeNull();
  });

  it('begins once, on cue', () => {
    const started = beginStory(fresh());
    expect(started.storyStage).toBe(1);
    expect(storyObjective(started)).toContain('Basement Static');
    // beginning again is a no-op
    expect(beginStory(started).storyStage).toBe(1);
  });

  it('the fetch stage auto-completes when you own the record', () => {
    let s = beginStory(fresh({ cash: 100 }));
    expect(checkStory(s)).toBeNull(); // don't own it yet
    s = buyGood(s, 'rec_static').state;
    const r = checkStory(s)!;
    expect(r.ok).toBe(true);
    expect(r.state.storyStage).toBe(2);
  });

  it('delivery needs the right citizen AND the record in hand', () => {
    let s = { ...beginStory(fresh({ cash: 100 })), storyStage: 2 };
    s = buyGood(s, 'rec_static').state;
    // wrong citizen: nothing
    expect(deliverStory(s, 'gloria')).toBeNull();
    // right citizen: advances, pays, and consumes the record
    const r = deliverStory(s, 'marcus')!;
    expect(r.ok).toBe(true);
    expect(r.state.storyStage).toBe(3);
    expect(r.state.cash).toBe(s.cash + 60);
    expect(r.state.goods.includes('rec_static')).toBe(false);
  });

  it('cannot deliver a record you no longer hold', () => {
    const s = { ...fresh(), storyStage: 2 }; // no record
    expect(deliverStory(s, 'marcus')!.ok).toBe(false);
  });

  it('finishing the last stage marks the thread complete', () => {
    const s = { ...fresh({ cash: 0 }), storyStage: STORY_LAST };
    const stage = currentStage(s)!;
    expect(stage.kind).toBe('talk');
    const r = deliverStory(s, stage.need)!;
    expect(r.state.storyStage).toBeGreaterThan(STORY_LAST);
    expect(r.msg).toContain('complete');
    expect(storyObjective(r.state)).toContain('complete');
    expect(STAGES.length).toBe(3);
  });
});
