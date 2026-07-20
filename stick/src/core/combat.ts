import type { ActionResult, GameState } from './types';
import type { Rng } from './rng';
import { addKarma, addStat, itemCount } from './state';
import { passTime } from './time';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  str: number;
  walletMin: number;
  walletMax: number;
  strReward: number;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'drunkard', name: 'Random Drunkard', hp: 15,  str: 5,  walletMin: 10,  walletMax: 60,   strReward: 2 },
  { id: 'boxer',    name: 'Off-Duty Boxer',  hp: 45,  str: 14, walletMin: 60,  walletMax: 160,  strReward: 4 },
  { id: 'gangster', name: 'Gangster',        hp: 100, str: 32, walletMin: 150, walletMax: 450,  strReward: 8 },
  { id: 'mobster',  name: 'Mobster',         hp: 220, str: 65, walletMin: 400, walletMax: 1200, strReward: 14 },
];

export type MoveId = 'punch' | 'kick' | 'fireball' | 'pure';

export interface MoveDef {
  id: MoveId;
  name: string;
  ap: number;
  strReq: number;
}

export const MOVES: MoveDef[] = [
  { id: 'punch',    name: 'Punch',       ap: 1, strReq: 0 },
  { id: 'kick',     name: 'Kick',        ap: 2, strReq: 30 },
  { id: 'fireball', name: 'Fireball',    ap: 3, strReq: 100 },
  { id: 'pure',     name: 'Pure Energy', ap: 4, strReq: 300 },
];

export const AP_START = 2;
export const AP_PER_ROUND = 2;
export const AP_CAP = 6;

export interface CombatState {
  enemy: EnemyDef;
  enemyHp: number;
  playerHp: number;
  ap: number;
  round: number;
  done: boolean;
  won: boolean | null;
}

export function unlockedMoves(s: GameState): MoveDef[] {
  return MOVES.filter(m => s.stats.strength >= m.strReq);
}

/** Tougher patrons show up as you get tougher. */
export function pickEnemy(s: GameState, rng: Rng): EnemyDef {
  const str = s.stats.strength;
  const r = rng();
  if (str < 40) return ENEMIES[r < 0.7 ? 0 : 1];
  if (str < 150) return ENEMIES[r < 0.6 ? 1 : 2];
  return ENEMIES[r < 0.55 ? 2 : 3];
}

export function startFight(s: GameState, rng: Rng): CombatState {
  const enemy = pickEnemy(s, rng);
  return {
    enemy,
    enemyHp: enemy.hp,
    playerHp: s.hp,
    ap: AP_START,
    round: 1,
    done: false,
    won: null,
  };
}

function playerDamage(s: GameState, move: MoveId, rng: Rng): number {
  const base = 3 + Math.floor(s.stats.strength / 25);
  let mult: number;
  switch (move) {
    case 'punch':
      mult = itemCount(s, 'knife') > 0 ? 1.6 : 1;
      break;
    case 'kick':
      mult = 1.7;
      break;
    case 'fireball':
      mult = 2.6;
      break;
    case 'pure':
      mult = rng() * 5.5;
      break;
  }
  const variance = 0.75 + rng() * 0.5;
  return Math.max(1, Math.round(base * mult * variance));
}

function enemyDamage(enemy: EnemyDef, rng: Rng): number {
  const base = 2 + Math.floor(enemy.str / 6);
  return Math.max(1, Math.round(base * (0.7 + rng() * 0.6)));
}

export interface TurnResult {
  fight: CombatState;
  events: string[];
}

/** One player move; if the enemy survives, it swings back, then AP refreshes. */
export function playerMove(s: GameState, fight: CombatState, move: MoveId, rng: Rng): TurnResult {
  if (fight.done) return { fight, events: [] };
  const def = MOVES.find(m => m.id === move)!;
  if (def.ap > fight.ap) return { fight, events: [`Not enough AP for ${def.name}.`] };
  if (s.stats.strength < def.strReq) return { fight, events: [`${def.name} needs ${def.strReq} STR.`] };

  const events: string[] = [];
  const dmg = playerDamage(s, move, rng);
  let next: CombatState = { ...fight, ap: fight.ap - def.ap, enemyHp: Math.max(0, fight.enemyHp - dmg) };
  events.push(`${def.name} hits for ${dmg}!`);

  if (next.enemyHp === 0) {
    return { fight: { ...next, done: true, won: true }, events };
  }

  const counter = enemyDamage(fight.enemy, rng);
  next = { ...next, playerHp: Math.max(0, next.playerHp - counter) };
  events.push(`${fight.enemy.name} hits back for ${counter}.`);
  if (next.playerHp === 0) {
    return { fight: { ...next, done: true, won: false }, events };
  }

  next = { ...next, round: next.round + 1, ap: Math.min(AP_CAP, next.ap + AP_PER_ROUND) };
  return { fight: next, events };
}

/** Apply the finished fight to the game: loot and +STR, or death. */
export function resolveFight(s: GameState, fight: CombatState, rng: Rng): ActionResult {
  if (!fight.done) return { ok: false, state: s, msg: 'The fight isn’t over.' };
  if (!fight.won) {
    return {
      ok: true,
      state: { ...s, hp: 0, dead: true, deathCause: `Beaten to death by a ${fight.enemy.name.toLowerCase()}.` },
      msg: 'Everything goes dark.',
    };
  }
  const wallet =
    fight.enemy.walletMin +
    Math.floor(rng() * (fight.enemy.walletMax - fight.enemy.walletMin + 1));
  let next: GameState = { ...s, hp: Math.max(1, fight.playerHp), cash: s.cash + wallet };
  next = addStat(next, 'strength', fight.enemy.strReward);
  next = addKarma(next, -2);
  next = passTime(next, 30);
  return {
    ok: true,
    state: next,
    msg: `The ${fight.enemy.name.toLowerCase()} goes down. You take $${wallet} off him. +${fight.enemy.strReward} STR.`,
  };
}
