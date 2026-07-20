import type { ActionResult, CityId, GameState, ItemId, TickerId } from '../core/types';
import type { Rng } from '../core/rng';
import { itemCount, maxHp } from '../core/state';
import { availableWakeModes, sleep, type WakeMode } from '../core/time';
import { ITEMS, buyItem, useItem } from '../core/items';
import { MCSTICKS_MENU, eatMeal } from '../core/food';
import { FURNITURE, buyFurniture, furnitureCapacity, useFurniture } from '../core/home';
import { NEWLINES_RANKS, applyAtNewLines, isCeo, workMcSticks, workNewLines } from '../core/career';
import { exercise, study, takeClass, CLASS_COST, EXERCISE_COST } from '../core/school';
import { BEER_COST, drinkBeer, throwDarts } from '../core/bar';
import { buyBottle } from '../core/items';
import {
  MOVES, playerMove, resolveFight, startFight, unlockedMoves, type CombatState,
} from '../core/combat';
import { SLOT_BETS, playSlots } from '../core/slots';
import { playRoulette, type RouletteBet } from '../core/roulette';
import { deal, handLabel, handValue, hit, stand, type BjState } from '../core/blackjack';
import { LOAN_LIMIT, PROPERTY_PRICES, buyProperty, deposit, repayLoan, takeLoan, withdraw } from '../core/bank';
import { robBank, robStore } from '../core/crime';
import { CITIES, busTrip, canBoard } from '../core/trade';
import { TICKERS, buyStock, sellStock } from '../core/stocks';
import { checkTitleOffer, dictatorAvailable, presidentAvailable, runForOffice } from '../core/endgame';
import { giveBottleToHarold, giveSmokesToPunk, giveToHarold, hotwireCar } from '../core/npcs';
import { buyCocaine } from '../core/items';
import { closeMenu, openMenu, type MenuOption } from './menu';
import { FURNITURE_ICONS, ITEM_ICONS, MEAL_ICONS, MOVE_ICONS } from './icons';
import { toast } from './hud';

export interface GameCtx {
  get: () => GameState;
  /** Applies a result: state, toast, save, death/ending checks. Returns ok. */
  apply: (r: ActionResult) => boolean;
  set: (s: GameState) => void;
  rng: Rng;
  /** Rebuild the current interior (furniture appeared, home changed…). */
  refreshInterior: () => void;
}

export function openStation(ctx: GameCtx, stationId: string): void {
  if (stationId.startsWith('use:')) {
    ctx.apply(useFurniture(ctx.get(), stationId.slice(4) as never));
    return;
  }
  switch (stationId) {
    case 'sleep': return sleepMenu(ctx);
    case 'messages': return messagesPanel(ctx);
    case 'stocks': return stocksMenu(ctx);
    case 'campaign': return campaignMenu(ctx);
    case 'teller': return tellerMenu(ctx);
    case 'manager': return managerMenu(ctx);
    case 'vault': return vaultMenu(ctx);
    case 'reception': return receptionMenu(ctx);
    case 'desk': return deskMenu(ctx);
    case 'study': ctx.apply(study(ctx.get())); return;
    case 'class': ctx.apply(takeClass(ctx.get())); return;
    case 'gym': ctx.apply(exercise(ctx.get())); return;
    case 'order': return mcsticksMenu(ctx);
    case 'shift': ctx.apply(workMcSticks(ctx.get())); return;
    case 'catalog': return finelineMenu(ctx);
    case 'bar': return barMenu(ctx);
    case 'darts': return dartsPanel(ctx);
    case 'tough': return fightPanel(ctx);
    case 'jukebox':
      toast('♫ The jukebox only plays one song. It’s not a good song.');
      return;
    case 'slots': return slotsPanel(ctx);
    case 'blackjack': return blackjackPanel(ctx);
    case 'roulette': return roulettePanel(ctx);
    case 'shop': return storeMenu(ctx);
    case 'register': return registerMenu(ctx);
    case 'gear': return pawnMenu(ctx);
    case 'tickets': return busMenu(ctx);
  }
}

// ---------- inventory (I key) ----------

export function inventoryMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const entries = (Object.keys(s.inventory) as ItemId[]).filter(id => itemCount(s, id) > 0);
  const options: MenuOption[] = entries.map(id => {
    const def = ITEMS[id];
    return {
      label: `${def.name} × ${itemCount(s, id)}`,
      detail: def.usable ? def.blurb : `${def.blurb} (not usable here)`,
      icon: ITEM_ICONS[id],
      disabled: !def.usable,
      onSelect: () => {
        ctx.apply(useItem(ctx.get(), id));
        inventoryMenu(ctx);
      },
    };
  });
  if (s.hasSkateboard) options.push({ label: 'Skateboard', icon: '🛹', detail: 'Always under your feet', disabled: true, onSelect: () => {} });
  if (s.hasCar) options.push({ label: 'Yellow Car', icon: '🚗', detail: 'Parked wherever you left it', disabled: true, onSelect: () => {} });
  openMenu({
    title: 'Inventory',
    body: entries.length || s.hasSkateboard || s.hasCar ? undefined : 'Empty pockets.',
    options,
  });
}

// ---------- home ----------

function sleepMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const modes = availableWakeModes(s);
  const label: Record<WakeMode, [string, string]> = {
    normal: ['Sleep until 8:00 AM', 'the standard lie-in'],
    alarm: ['Alarm clock — up at 6:00 AM', 'early worm gets the shift'],
    caffeine: ['Alarm + caffeine pill — up at midnight', 'the pills hurt going down'],
  };
  openMenu({
    title: 'Call it a day?',
    body: s.furniture.includes('bed')
      ? 'The Coma-Snooze hums invitingly.'
      : 'No bed yet — the floor restores only part of your health.',
    options: modes.map(mode => ({
      label: label[mode][0],
      detail: label[mode][1],
      icon: mode === 'normal' ? '🛏️' : mode === 'alarm' ? '⏰' : '💊',
      onSelect: () => {
        closeMenu();
        if (!ctx.apply(sleep(ctx.get(), mode))) return;
        const before = ctx.get().messages.length;
        const offered = checkTitleOffer(ctx.get());
        ctx.set(offered);
        if (offered.messages.length > before) toast('📞 You have a new message at home.');
      },
    })),
  });
}

function messagesPanel(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'Answering machine',
    body: s.messages.length ? s.messages.map(m => `• ${m}`).join('\n\n') : 'No messages. Nobody calls.',
    options: [],
    leaveLabel: 'Beep.',
  });
}

function stocksMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const lines = TICKERS.map(
    t => `${t.id}  $${String(s.stockPrices[t.id]).padStart(4)}   you own ${s.stockOwned[t.id]}`
  ).join('\n');
  openMenu({
    title: 'Stick Street Journal — Markets',
    body: `${lines}\n\nPrices move nightly. Fortunes have been made.\nMostly lost, but made too.`,
    options: TICKERS.map(t => ({
      label: `Trade ${t.id}`,
      detail: t.name,
      icon: '📈',
      onSelect: () => tickerMenu(ctx, t.id),
    })),
  });
}

function tickerMenu(ctx: GameCtx, ticker: TickerId): void {
  const s = ctx.get();
  const price = s.stockPrices[ticker];
  const owned = s.stockOwned[ticker];
  const opts: MenuOption[] = [];
  for (const n of [1, 10, 100]) {
    opts.push({
      label: `Buy ${n}`,
      detail: `$${(price * n).toLocaleString()}`,
      icon: '📈',
      disabled: s.cash < price * n,
      onSelect: () => {
        ctx.apply(buyStock(ctx.get(), ticker, n));
        tickerMenu(ctx, ticker);
      },
    });
  }
  for (const n of [1, 10, 100]) {
    opts.push({
      label: `Sell ${n}`,
      detail: `$${(price * n).toLocaleString()}`,
      icon: '📉',
      disabled: owned < n,
      onSelect: () => {
        ctx.apply(sellStock(ctx.get(), ticker, n));
        tickerMenu(ctx, ticker);
      },
    });
  }
  opts.push({ label: 'Back to the board', icon: '⬅', onSelect: () => stocksMenu(ctx) });
  openMenu({ title: `${ticker} — $${price}`, body: `You hold ${owned} shares.`, options: opts });
}

function campaignMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const pres = presidentAvailable(s);
  const dict = dictatorAvailable(s);
  openMenu({
    title: 'The War Room',
    body: 'Maps. Phones. A suspicious amount of bunting.\nThe 2D World is watching what you do with all this.',
    options: [
      {
        label: 'Run for President',
        detail: '$200,000',
        icon: '🗳️',
        disabled: !pres,
        onSelect: () => {
          if (ctx.apply(runForOffice(ctx.get(), 'president'))) closeMenu();
        },
      },
      {
        label: 'Seize power as Dictator',
        detail: '$500,000',
        icon: '👑',
        disabled: !dict,
        onSelect: () => {
          if (ctx.apply(runForOffice(ctx.get(), 'dictator'))) closeMenu();
        },
      },
    ],
  });
}

// ---------- bank ----------

function tellerMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const options: MenuOption[] = [
    { label: 'Deposit $100', icon: '💰', disabled: s.cash < 100, onSelect: () => { ctx.apply(deposit(ctx.get(), 100)); tellerMenu(ctx); } },
    { label: 'Deposit everything', icon: '💰', disabled: s.cash <= 0, onSelect: () => { ctx.apply(deposit(ctx.get(), ctx.get().cash)); tellerMenu(ctx); } },
    { label: 'Withdraw $100', icon: '💵', disabled: s.bank < 100, onSelect: () => { ctx.apply(withdraw(ctx.get(), 100)); tellerMenu(ctx); } },
    { label: 'Withdraw everything', icon: '💵', disabled: s.bank <= 0, onSelect: () => { ctx.apply(withdraw(ctx.get(), ctx.get().bank)); tellerMenu(ctx); } },
    {
      label: `Take a loan ($${LOAN_LIMIT - s.loan} available)`,
      detail: '2% daily interest',
      icon: '🧾',
      disabled: s.loan >= LOAN_LIMIT,
      onSelect: () => { ctx.apply(takeLoan(ctx.get(), LOAN_LIMIT - ctx.get().loan)); tellerMenu(ctx); },
    },
    {
      label: 'Repay loan',
      icon: '🧾',
      detail: s.loan > 0 ? `$${s.loan} outstanding` : 'debt-free',
      disabled: s.loan <= 0 || s.cash <= 0,
      onSelect: () => { ctx.apply(repayLoan(ctx.get(), ctx.get().cash)); tellerMenu(ctx); },
    },
  ];
  openMenu({
    title: 'Bank — Teller',
    body: `Cash  $${s.cash.toLocaleString()}\nSaved $${s.bank.toLocaleString()}  (1% nightly)${s.loan ? `\nLoan  $${s.loan} and growing` : ''}`,
    options,
  });
}

function managerMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'Bank — Real Estate Desk',
    body: `Current residence: ${s.home === 'castle' ? 'The Castle' : s.home === 'bigger' ? 'Bigger Apartment' : 'Apartment'}`,
    options: [
      {
        label: 'Bigger Apartment',
        icon: '🏠',
        detail: `$${PROPERTY_PRICES.bigger.toLocaleString()} · fits 4 furnishings`,
        disabled: s.home !== 'apartment' || s.cash < PROPERTY_PRICES.bigger,
        onSelect: () => {
          if (ctx.apply(buyProperty(ctx.get(), 'bigger'))) { ctx.refreshInterior(); closeMenu(); }
        },
      },
      {
        label: 'The Castle',
        icon: '🏰',
        detail: `$${PROPERTY_PRICES.castle.toLocaleString()} · fits everything`,
        disabled: s.home === 'castle' || s.cash < PROPERTY_PRICES.castle,
        onSelect: () => {
          if (ctx.apply(buyProperty(ctx.get(), 'castle'))) { ctx.refreshInterior(); closeMenu(); }
        },
      },
    ],
  });
}

function vaultMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const armed = itemCount(s, 'gun') > 0 && itemCount(s, 'ammo') > 0;
  openMenu({
    title: 'The Vault',
    body: 'Thick steel. A guard pretending not to watch you.\nThis is a terrible idea.',
    options: [
      {
        label: 'Rob the bank',
        icon: '🔫',
        disabled: !armed,
        onSelect: () => {
          closeMenu();
          ctx.apply(robBank(ctx.get(), ctx.rng));
        },
      },
    ],
    leaveLabel: 'Walk away whistling',
  });
}

// ---------- work ----------

function receptionMenu(ctx: GameCtx): void {
  const s = ctx.get();
  if (s.jobRank >= 0) {
    const rank = NEWLINES_RANKS[s.jobRank];
    openMenu({
      title: 'New Lines Inc. — Reception',
      body: `Employee: ${s.name}\nPosition: ${rank.title} ($${rank.wage}/h)${isCeo(s) ? '\nYou run this place.' : `\nKeep showing up. ${rank.boss} notices things.`}`,
      options: [],
      leaveLabel: 'Back to work',
    });
    return;
  }
  openMenu({
    title: 'New Lines Inc. — Reception',
    body: `"Welcome to New Lines. We move paper. The paper must flow."\nEntry position: Janitor, $8/h. Requires 20 INT.`,
    options: [
      {
        label: 'Apply for a job',
        icon: '💼',
        disabled: s.stats.intelligence < 20,
        detail: s.stats.intelligence < 20 ? 'needs INT 20' : undefined,
        onSelect: () => {
          ctx.apply(applyAtNewLines(ctx.get()));
          closeMenu();
        },
      },
    ],
  });
}

function deskMenu(ctx: GameCtx): void {
  const s = ctx.get();
  if (s.jobRank < 0) {
    toast('You don’t work here. Reception is that way.', false);
    return;
  }
  const rank = NEWLINES_RANKS[s.jobRank];
  openMenu({
    title: `Your desk — ${rank.title}`,
    body: `A 6-hour shift pays $${rank.wage * 6}.`,
    options: [
      {
        label: 'Work a shift',
        detail: '6 hours',
        icon: '💼',
        onSelect: () => {
          ctx.apply(workNewLines(ctx.get()));
          closeMenu();
        },
      },
    ],
  });
}

// ---------- food & shops ----------

function mcsticksMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'McSticks — "Coronary-size it!"',
    body: `HP ${s.hp}/${maxHp(s)}`,
    options: MCSTICKS_MENU.map(m => ({
      label: m.name,
      detail: `$${m.price} · +${m.hp} HP`,
      icon: MEAL_ICONS[m.id],
      disabled: s.cash < m.price,
      onSelect: () => {
        ctx.apply(eatMeal(ctx.get(), m.id));
        mcsticksMenu(ctx);
      },
    })),
  });
}

function storeMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const stock: ItemId[] = ['slushee', 'candy', 'nachos', 'smokes', 'caffeine'];
  openMenu({
    title: 'Funkytown Five-O',
    body: '"How can I hook a brotha up?"',
    options: stock.map(id => {
      const def = ITEMS[id];
      return {
        label: def.name,
        detail: `$${def.price} · ${def.blurb}`,
        icon: ITEM_ICONS[id],
        disabled: s.cash < def.price,
        onSelect: () => {
          ctx.apply(buyItem(ctx.get(), id));
          storeMenu(ctx);
        },
      };
    }),
  });
}

function registerMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const armed = itemCount(s, 'gun') > 0 && itemCount(s, 'ammo') > 0;
  const midday = s.minute >= 10 * 60 && s.minute < 16 * 60;
  openMenu({
    title: 'The register',
    body: 'The owner is busy restocking slushee syrup.',
    options: [
      {
        label: 'Rob the store',
        icon: '🔫',
        disabled: !armed,
        onSelect: () => {
          closeMenu();
          ctx.apply(robStore(ctx.get(), ctx.rng));
        },
      },
    ],
    leaveLabel: 'Buy nothing, leave slowly',
  });
}

function pawnMenu(ctx: GameCtx): void {
  const s = ctx.get();
  const stock: ItemId[] = ['ammo', 'knife', 'alarmClock', 'cellPhone', 'gun'];
  openMenu({
    title: 'Pawn Shop',
    body: '"Buy somethin’ or get out."',
    options: stock.map(id => {
      const def = ITEMS[id];
      const owned = ['knife', 'alarmClock', 'cellPhone', 'gun'].includes(id) && itemCount(s, id) > 0;
      return {
        label: def.name,
        detail: owned ? 'owned' : `$${def.price} · ${def.blurb}`,
        icon: ITEM_ICONS[id],
        disabled: owned || s.cash < def.price,
        onSelect: () => {
          ctx.apply(buyItem(ctx.get(), id));
          pawnMenu(ctx);
        },
      };
    }),
  });
}

function finelineMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'Fine Line Furnishings',
    body: `Your ${s.home === 'castle' ? 'castle' : 'place'} fits ${furnitureCapacity(s)} piece${furnitureCapacity(s) === 1 ? '' : 's'} (${s.furniture.length} owned).`,
    options: FURNITURE.map(f => {
      const owned = s.furniture.includes(f.id);
      return {
        label: f.name,
        detail: owned ? 'owned' : `$${f.price.toLocaleString()} · ${f.blurb}`,
        icon: FURNITURE_ICONS[f.id],
        disabled: owned || s.cash < f.price,
        onSelect: () => {
          if (ctx.apply(buyFurniture(ctx.get(), f.id))) ctx.refreshInterior();
          finelineMenu(ctx);
        },
      };
    }),
  });
}

// ---------- Sticky's ----------

function barMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: "Sticky's Liquor — the bar",
    body: '"Know when to draw the line," says the poster.\nNobody here has ever read it.',
    options: [
      {
        label: 'Drink a beer',
        detail: `$${BEER_COST} · +2 CHA`,
        icon: '🍺',
        disabled: s.cash < BEER_COST,
        onSelect: () => {
          ctx.apply(drinkBeer(ctx.get()));
          barMenu(ctx);
        },
      },
      {
        label: 'Buy a 40 oz bottle',
        detail: '$30 · tradeable',
        icon: '🍾',
        disabled: s.cash < 30,
        onSelect: () => {
          ctx.apply(buyBottle(ctx.get()));
          barMenu(ctx);
        },
      },
    ],
  });
}

function dartsPanel(ctx: GameCtx, bet?: number): void {
  if (!bet) {
    const s = ctx.get();
    openMenu({
      title: 'Drunken darts',
      body: 'Stop the wobble at the bullseye.\nBullseye 3× · inner 2× · outer pushes.',
      options: [10, 50, 100].map(b => ({
        label: `Bet $${b}`,
        icon: '🎯',
        disabled: s.cash < b,
        onSelect: () => dartsPanel(ctx, b),
      })),
    });
    return;
  }
  const body = document.createElement('div');
  body.innerHTML = `<div class="darts-track"><div class="darts-marker"></div></div>
    <div class="darts-hint">the marker wobbles — throw near the center</div>`;
  const marker = body.querySelector<HTMLElement>('.darts-marker')!;
  let aim = 0;
  const started = performance.now();
  const tick = () => {
    if (!marker.isConnected) return;
    const t = (performance.now() - started) / 1000;
    const wave = Math.sin(t * 3.1) * Math.sin(t * 1.7 + 1);
    aim = 1 - Math.abs(wave); // 1 at center
    marker.style.left = `${50 + wave * 46}%`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  openMenu({
    title: `Darts — $${bet} riding`,
    body,
    options: [
      {
        label: 'THROW',
        icon: '🎯',
        hotkey: ' ',
        onSelect: () => {
          const r = throwDarts(ctx.get(), bet, aim);
          ctx.apply(r.res);
          dartsPanel(ctx);
        },
      },
    ],
  });
}

function fightPanel(ctx: GameCtx, fight?: CombatState): void {
  const s = ctx.get();
  if (!fight) {
    openMenu({
      title: 'A tough guy sizes you up',
      body: '"You lookin’ at me funny?" Fights here are to the death.\nWinner keeps the loser’s wallet.',
      options: [
        { label: 'Throw the first punch', icon: '👊', onSelect: () => fightPanel(ctx, startFight(ctx.get(), ctx.rng)) },
      ],
      leaveLabel: 'Apologize and back off',
    });
    return;
  }
  const bar = (hp: number, max: number) => {
    const n = Math.max(0, Math.round((hp / max) * 16));
    return '█'.repeat(n) + '░'.repeat(16 - n);
  };
  const body = `${fight.enemy.name}\n${bar(fight.enemyHp, fight.enemy.hp)} ${fight.enemyHp}\n\nYou\n${bar(fight.playerHp, maxHp(s))} ${fight.playerHp}\n\nAP ${'●'.repeat(fight.ap)}${'○'.repeat(Math.max(0, 6 - fight.ap))}`;
  if (fight.done) {
    openMenu({
      title: fight.won ? 'He goes down!' : 'Everything fades…',
      body,
      locked: true,
      options: [
        {
          label: fight.won ? 'Take his wallet' : 'So it ends',
          icon: fight.won ? '💰' : '💀',
          onSelect: () => {
            closeMenu();
            ctx.apply(resolveFight(ctx.get(), fight, ctx.rng));
          },
        },
      ],
    });
    return;
  }
  // locked moves simply don't exist yet, like the original
  openMenu({
    title: `Bar fight — round ${fight.round}`,
    body,
    locked: true,
    options: unlockedMoves(s).map(m => ({
      label: m.name,
      detail: `${m.ap} AP`,
      icon: MOVE_ICONS[m.id],
      disabled: m.ap > fight.ap,
      onSelect: () => {
        const turn = playerMove(ctx.get(), fight, m.id, ctx.rng);
        for (const e of turn.events) toast(e, !e.includes('hits back'));
        fightPanel(ctx, turn.fight);
      },
    })),
  });
}

// ---------- casino ----------

function slotsPanel(ctx: GameCtx, lastFace = '— — —'): void {
  const s = ctx.get();
  openMenu({
    title: 'Slots',
    body: `${lastFace}\n\nTriple 7s pay 60×.`,
    options: SLOT_BETS.map(bet => ({
      label: `Pull for $${bet}`,
      icon: '🎰',
      disabled: s.cash < bet,
      onSelect: () => {
        const r = playSlots(ctx.get(), bet, ctx.rng);
        if (ctx.apply(r.res)) slotsPanel(ctx, r.reels.join('  '));
      },
    })),
  });
}

function blackjackPanel(ctx: GameCtx): void {
  betBuilder(0);
  function betBuilder(bet: number): void {
    const s = ctx.get();
    const chips = [5, 25, 100, 500];
    openMenu({
      title: 'Blackjack',
      body: `Bet: $${bet}\nCash: $${s.cash}`,
      options: [
        ...chips.map(c => ({
          label: `+ $${c} chip`,
          icon: '🪙',
          disabled: bet + c > s.cash,
          onSelect: () => betBuilder(bet + c),
        })),
        { label: 'Clear bet', icon: '✖', hotkey: 'c', disabled: bet === 0, onSelect: () => betBuilder(0) },
        {
          label: 'DEAL',
          icon: '🃏',
          hotkey: 'd',
          disabled: bet === 0,
          onSelect: () => {
            ctx.set({ ...ctx.get(), cash: ctx.get().cash - bet });
            const bj = deal(ctx.rng, bet);
            round(bj, bj.phase === 'done');
          },
        },
      ],
    });
  }
  function round(bj: BjState, justSettled: boolean): void {
    if (justSettled && bj.payout > 0) {
      ctx.set({ ...ctx.get(), cash: ctx.get().cash + bj.payout });
    }
    const done = bj.phase === 'done';
    const dealerLine = done
      ? `Dealer  ${handLabel(bj.dealer)}  (${handValue(bj.dealer)})`
      : `Dealer  ${handLabel(bj.dealer, true)}`;
    const playerLine = `You     ${handLabel(bj.player)}  (${handValue(bj.player)})`;
    const resultLine = done ? `\n\n${bjResult(bj)}` : '';
    openMenu({
      title: 'Blackjack',
      body: `${dealerLine}\n${playerLine}${resultLine}`,
      options: done
        ? [
            {
              label: 'Deal again',
              detail: `$${bj.bet}`,
              icon: '🃏',
              hotkey: 'd',
              disabled: ctx.get().cash < bj.bet,
              onSelect: () => {
                ctx.set({ ...ctx.get(), cash: ctx.get().cash - bj.bet });
                const next = deal(ctx.rng, bj.bet);
                round(next, next.phase === 'done');
              },
            },
            { label: 'Change bet', icon: '🪙', hotkey: 'b', onSelect: () => betBuilder(0) },
          ]
        : [
            { label: 'Hit', icon: '🃏', hotkey: 'h', onSelect: () => { const n = hit(bj); round(n, n.phase === 'done'); } },
            { label: 'Stand', icon: '✋', hotkey: 's', onSelect: () => { const n = stand(bj); round(n, n.phase === 'done'); } },
          ],
    });
  }
  function bjResult(bj: BjState): string {
    const net = bj.payout - bj.bet;
    switch (bj.result) {
      case 'blackjack': return `♠ BLACKJACK! +$${net}`;
      case 'win': return `You win. +$${net}`;
      case 'push': return 'Push — bet returned.';
      case 'bust': return `Bust. −$${bj.bet}`;
      default: return `Dealer wins. −$${bj.bet}`;
    }
  }
}

function roulettePanel(ctx: GameCtx, bets: RouletteBet[] = [], lastSpin = ''): void {
  const s = ctx.get();
  const staked = bets.reduce((sum, b) => sum + b.amount, 0);
  const betLine = bets.length
    ? bets.map(b => (b.kind === 'straight' ? `$${b.amount} on ${b.n}` : `$${b.amount} on ${b.kind}`)).join(', ')
    : 'no bets yet';
  const add = (bet: RouletteBet): void => {
    const existing = bets.find(b =>
      b.kind === bet.kind && (b.kind !== 'straight' || (b as { n: number }).n === (bet as { n: number }).n)
    );
    if (existing) existing.amount += bet.amount;
    else bets.push(bet);
    roulettePanel(ctx, bets, lastSpin);
  };
  const canAdd = staked + 25 <= s.cash;
  openMenu({
    title: 'Roulette',
    body: `${lastSpin ? lastSpin + '\n\n' : ''}Table: ${betLine}\nStaked: $${staked} · Cash: $${s.cash}`,
    options: [
      { label: '+$25 on Red', icon: '🔴', disabled: !canAdd, onSelect: () => add({ kind: 'red', amount: 25 }) },
      { label: '+$25 on Black', icon: '⚫', disabled: !canAdd, onSelect: () => add({ kind: 'black', amount: 25 }) },
      { label: '+$25 on Odd', icon: '🔢', disabled: !canAdd, onSelect: () => add({ kind: 'odd', amount: 25 }) },
      { label: '+$25 on Even', icon: '🔢', disabled: !canAdd, onSelect: () => add({ kind: 'even', amount: 25 }) },
      {
        label: '+$25 straight up',
        detail: 'a random number, 35:1',
        icon: '🎯',
        disabled: !canAdd,
        onSelect: () => add({ kind: 'straight', n: Math.floor(ctx.rng() * 37), amount: 25 }),
      },
      { label: 'Clear table', icon: '✖', hotkey: 'c', disabled: !bets.length, onSelect: () => roulettePanel(ctx, [], lastSpin) },
      {
        label: 'SPIN',
        icon: '🎡',
        hotkey: 's',
        disabled: !bets.length,
        onSelect: () => {
          const r = playRoulette(ctx.get(), bets, ctx.rng);
          if (ctx.apply(r.res)) roulettePanel(ctx, [], `The ball lands on ${r.res.msg.split(' — ')[0]}.`);
        },
      },
    ],
  });
}

// ---------- bus depot ----------

function busMenu(ctx: GameCtx): void {
  const s = ctx.get();
  if (!canBoard(s)) {
    openMenu({
      title: 'Bus Depot',
      body: 'The board lists six cities. Every departure: before 6 AM.\nThe clerk shrugs: "Early bus waits for no stick."',
      options: [],
      leaveLabel: 'Squint at the timetable',
    });
    return;
  }
  openMenu({
    title: 'Bus Depot — destinations',
    body: `Carrying: ${itemCount(s, 'cocaine')}g cocaine, ${itemCount(s, 'bottle')} bottles${itemCount(s, 'gun') ? ', a gun' : ''}${itemCount(s, 'ammo') ? ` (${itemCount(s, 'ammo')} rounds)` : ''}.`,
    options: CITIES.map(c => ({
      label: `Sell Commodities — ${c.name}`,
      detail: `$${c.fare} fare`,
      icon: '🚌',
      disabled: s.cash < c.fare,
      onSelect: () => {
        closeMenu();
        ctx.apply(busTrip(ctx.get(), c.id, ctx.rng));
      },
    })),
  });
}

// ---------- outdoor characters ----------

export function haroldMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'Homeless Harold',
    body: '"Spare some change? The 2D economy has been\nunkind to those of us with depth."',
    options: [
      {
        label: 'Give him $10',
        icon: '💵',
        disabled: s.cash < 10,
        onSelect: () => { ctx.apply(giveToHarold(ctx.get())); haroldMenu(ctx); },
      },
      {
        label: 'Give him a 40 oz',
        icon: '🍾',
        disabled: itemCount(s, 'bottle') < 1,
        onSelect: () => { ctx.apply(giveBottleToHarold(ctx.get())); haroldMenu(ctx); },
      },
    ],
  });
}

export function punkMenu(ctx: GameCtx): void {
  const s = ctx.get();
  if (s.punkDead) {
    toast('The curb is empty. A skateboard-shaped silence.', false);
    return;
  }
  openMenu({
    title: 'Skater Punk',
    body: s.hasSkateboard
      ? '"Board treating you right? Got any more smokes?"'
      : '"Yo. I’m totally old enough to smoke, but I left my\nI.D. at home. Hook me up with a pack?"',
    options: [
      {
        label: 'Give him a pack of smokes',
        icon: '🚬',
        disabled: itemCount(s, 'smokes') < 1,
        onSelect: () => {
          ctx.apply(giveSmokesToPunk(ctx.get()));
          closeMenu();
        },
      },
    ],
  });
}

export function rudyMenu(ctx: GameCtx): void {
  const s = ctx.get();
  openMenu({
    title: 'Red-Headed Stick',
    body: '"Rudy’s the name. I got product — $400 a gram.\nMoves for way more out of town, if you can handle the trip."',
    options: [1, 5, 10, 25].map(g => ({
      label: `Buy ${g}g`,
      icon: '❄️',
      detail: `$${(g * 400).toLocaleString()}`,
      disabled: s.cash < g * 400,
      onSelect: () => { ctx.apply(buyCocaine(ctx.get(), g)); rudyMenu(ctx); },
    })),
  });
}

export function carMenu(ctx: GameCtx, startDriving: () => void): void {
  const s = ctx.get();
  if (!s.hasCar) {
    openMenu({
      title: 'A yellow car',
      body: 'Someone abandoned it on the apartment lot years ago.\nThe ignition wiring looks… solvable.',
      options: [
        {
          label: 'Hotwire it',
          icon: '🔧',
          onSelect: () => {
            if (ctx.apply(hotwireCar(ctx.get()))) closeMenu();
          },
        },
      ],
    });
    return;
  }
  closeMenu();
  startDriving();
}
