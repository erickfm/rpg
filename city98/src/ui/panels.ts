import type { ActionResult, GameState } from '../core/types';
import {
  CAR_MODELS, DINER_MENU, GAS_MENU, JOBS, buyCar, canWork, carModel, eat, fmtClock,
  payDebt, rest, sleep, workShift, type MealDef,
} from '../core/sim';
import { abandonGig, acceptGig, availableGigs, gigTimeLeft } from '../core/gigs';
import { RECORDS, UPGRADES, buyGood, goodById, hasStereo, ownedRecords, owns } from '../core/goods';
import { DAILY_INTEREST, deposit, withdraw } from '../core/bank';
import { HOMES, buyHome, homeDef } from '../core/housing';
import { cycleHair, cycleShirt, cycleSkin, setName } from '../core/appearance';
import { ASPIRATIONS, isDone, progress } from '../core/aspirations';
import { storyObjective } from '../core/story';
import { activeFavorObjectives } from '../core/favors';
import { dailyEdition } from '../core/news';
import { nowPlaying, CHANNELS } from '../core/tv';
import { playArcade } from './arcade';
import { playSnake } from './snake';
import { GAME_NAMES, emptyScores, topScores, type GameId, type HighScores } from '../core/highscores';
import { closeDialog, openDialog } from './win';
import { toast } from './hud';

export interface GameCtx {
  get: () => GameState;
  apply: (r: ActionResult) => boolean;
  playStation?: (mood: number) => void;
  stopStation?: () => void;
  promptName?: (current: string) => string | null;
  scores?: () => HighScores;
  recordScore?: (game: GameId, score: number) => { rank: number };
}

const DONUT_MENU: MealDef[] = [
  { id: 'donut',  name: 'Glazed Donut',   price: 2, hunger: 18, energy: 5,  minutes: 6 },
  { id: 'dozen',  name: 'Half Dozen',     price: 9, hunger: 55, energy: 8,  minutes: 15 },
  { id: 'drip',   name: 'Drip Coffee',    price: 1, hunger: 2,  energy: 12, minutes: 5 },
];

export function openPanel(ctx: GameCtx, id: string): void {
  switch (id) {
    case 'home': return homePanel(ctx);
    case 'diner': return foodPanel(ctx, 'Sunrise Diner', '"Sit anywhere, hon. Coffee\'s fresh."', DINER_MENU);
    case 'gasshop': return gasPanel(ctx);
    case 'donut': return foodPanel(ctx, 'Donut Hut', 'The glaze shines under fluorescent light.', DONUT_MENU);
    case 'video': return jobPanel(ctx, 'video', '"Be kind, rewind." The returns bin is full again.');
    case 'office': return jobPanel(ctx, 'office', 'Gray cubicles to the horizon. A phone rings, unanswered.');
    case 'arcade': return arcadePanel(ctx);
    case 'dealer': return dealerPanel(ctx);
    case 'payphone': return payphonePanel(ctx);
    case 'records': return recordsPanel(ctx);
    case 'atm': return atmPanel(ctx);
    case 'newsstand': return newsPanel(ctx);
    case 'bench': return benchPanel(ctx);
    case 'jukebox':
      toast('F7 — "More Than a Feeling". The diner approves.');
      return;
    case 'browse':
      toast('Every copy of Space Cop 3 is checked out. Every single one.');
      return;
    case 'tv': return tvPanel(ctx);
    case 'stereo': return stereoPanel(ctx);
    case 'mirror': return mirrorPanel(ctx);
    case 'reception':
      toast('"Elevator\'s behind you, sport. Badge in by ten." She does not look up.');
      return;
    case 'fridge':
      toast('A questionable jar of pickles and half a soda. You leave both for future you.');
      return;
  }
}

function homePanel(ctx: GameCtx): void {
  const s = ctx.get();
  openDialog({
    title: 'Maple Court — Apt 3B',
    body: 'Your place. One window, one mattress, one excellent view of a brick wall.',
    options: [
      {
        label: 'Sleep until 7:00 AM',
        detail: 'ends the day',
        onSelect: () => {
          closeDialog();
          ctx.apply(sleep(ctx.get()));
        },
      },
      {
        label: 'Pay the landlord',
        detail: s.debt > 0 ? `$${s.debt} owed` : 'nothing owed',
        disabled: s.debt <= 0 || s.cash <= 0,
        onSelect: () => {
          ctx.apply(payDebt(ctx.get()));
          homePanel(ctx);
        },
      },
      {
        label: 'Check the answering machine',
        onSelect: () => {
          const msgs = ctx.get().messages.slice(-4);
          openDialog({
            title: 'Answering Machine',
            body: msgs.length ? msgs.map(m => `• ${m}`).join('\n\n') : 'No new messages.',
            options: [],
            closeLabel: 'Beep.',
          });
        },
      },
      {
        label: 'Life goals',
        detail: `${progress(s).done}/${progress(s).total}`,
        onSelect: () => goalsPanel(ctx),
      },
      {
        label: 'Journal',
        detail: s.storyStage > 0 ? 'active thread' : 'nothing yet',
        onSelect: () => journalPanel(ctx),
      },
    ],
  });
}

function gasPanel(ctx: GameCtx): void {
  const s = ctx.get();
  const umbrella = goodById('up_umbrella')!;
  const hasUmb = owns(s, 'up_umbrella');
  openDialog({
    title: 'Gas-N-Go',
    body: 'Everything here has a 2-year shelf life. A rack of golf umbrellas by the door.',
    options: [
      ...GAS_MENU.map(m => ({
        label: m.name,
        detail: `$${m.price}`,
        disabled: s.cash < m.price,
        onSelect: () => { ctx.apply(eat(ctx.get(), m)); gasPanel(ctx); },
      })),
      {
        label: `Golf Umbrella`,
        detail: hasUmb ? 'owned' : `$${umbrella.price} · beats the rain`,
        disabled: hasUmb || s.cash < umbrella.price,
        onSelect: () => { ctx.apply(buyGood(ctx.get(), 'up_umbrella')); gasPanel(ctx); },
      },
    ],
    closeLabel: 'Leave',
  });
}

function foodPanel(ctx: GameCtx, title: string, blurb: string, menu: MealDef[]): void {
  const s = ctx.get();
  openDialog({
    title,
    body: blurb,
    options: menu.map(m => ({
      label: m.name,
      detail: `$${m.price}`,
      disabled: s.cash < m.price,
      onSelect: () => {
        ctx.apply(eat(ctx.get(), m));
        foodPanel(ctx, title, blurb, menu);
      },
    })),
  });
}

function jobPanel(ctx: GameCtx, jobId: 'video' | 'office', blurb: string): void {
  const s = ctx.get();
  const job = JOBS[jobId];
  const check = canWork(s, job);
  openDialog({
    title: job.place,
    body: `${blurb}\n\n${job.title} — ${job.hours}h shift, $${job.pay}.\nClock-in ${fmtClock(job.openFrom)}–${fmtClock(job.openTo)}${job.weekdaysOnly ? ', weekdays' : ''}.`,
    options: [
      {
        label: 'Work a shift',
        detail: check.ok ? undefined : check.why,
        disabled: !check.ok,
        onSelect: () => {
          closeDialog();
          ctx.apply(workShift(ctx.get(), jobId));
        },
      },
    ],
  });
}

function arcadePanel(ctx: GameCtx): void {
  const s = ctx.get();
  // pay a couple quarters, lose an hour, then let skill win some back
  const launch = (game: GameId, run: (onDone: (payout: number, score: number) => void) => void) => {
    closeDialog();
    let paid = { ...ctx.get(), cash: ctx.get().cash - 2 };
    paid = rest(paid, 60, 5, 'An hour at the Neon Dragon.').state;
    ctx.apply({ ok: true, state: paid, msg: 'Quarters in. Here we go.' });
    run((payout, score) => {
      if (payout > 0) {
        ctx.apply({ ok: true, state: { ...ctx.get(), cash: ctx.get().cash + payout }, msg: `You cash out $${payout} in tickets.` });
      }
      const rec = ctx.recordScore?.(game, score);
      if (rec && rec.rank > 0) toast(`🏆 New ${GAME_NAMES[game]} high score — #${rec.rank}!`);
    });
  };
  openDialog({
    title: 'Neon Dragon Arcade',
    body: 'CRT glow and someone is arguing about high scores.',
    options: [
      { label: 'Play Gutter Racer', detail: '$2 · dodge for cash', disabled: s.cash < 2, onSelect: () => launch('gutter', playArcade) },
      { label: "Play Dragon's Tail", detail: '$2 · snake for cash', disabled: s.cash < 2, onSelect: () => launch('snake', playSnake) },
      { label: 'High Scores', detail: 'the hall of fame', onSelect: () => scoresBoard(ctx) },
    ],
  });
}

function scoresBoard(ctx: GameCtx): void {
  const hs = ctx.scores?.() ?? emptyScores();
  const medal = ['🥇', '🥈', '🥉'];
  const board = (game: GameId): string => {
    const list = topScores(hs, game);
    const rows = list.length
      ? list.map((e, i) => `${medal[i] ?? ` ${i + 1}.`} ${e.name} — ${e.score}`).join('\n')
      : '  — no scores yet, be the first —';
    return `${GAME_NAMES[game]}\n${rows}`;
  };
  openDialog({
    title: 'Neon Dragon — High Scores',
    body: `${board('gutter')}\n\n${board('snake')}`,
    options: [],
    closeLabel: 'Back',
  });
}

function dealerPanel(ctx: GameCtx): void {
  const s = ctx.get();
  const current = carModel(s);
  const forSale = Object.values(CAR_MODELS).filter(m => m.price > 0);
  openDialog({
    title: "Big Ray's Autos",
    body: `"Every one of these beauties ran when I parked it."\n\nYou drive: ${current.name}. Trade-in credit: $${current.resale}.`,
    options: forSale.map(m => {
      const due = m.price - current.resale;
      const owned = s.car === m.id;
      return {
        label: `${m.name}`,
        detail: owned ? 'yours' : `$${due} after trade`,
        disabled: owned || s.cash < due,
        onSelect: () => {
          if (ctx.apply(buyCar(ctx.get(), m.id))) dealerPanel(ctx);
        },
      };
    }),
    closeLabel: 'Just looking.',
  });
}

function atmPanel(ctx: GameCtx): void {
  const s = ctx.get();
  const amounts = [20, 100];
  const opts = [
    ...amounts.map(a => ({
      label: `Deposit $${a}`,
      disabled: s.cash < a,
      onSelect: () => { ctx.apply(deposit(ctx.get(), a)); atmPanel(ctx); },
    })),
    {
      label: 'Deposit everything',
      disabled: s.cash <= 0,
      onSelect: () => { ctx.apply(deposit(ctx.get(), ctx.get().cash)); atmPanel(ctx); },
    },
    ...amounts.map(a => ({
      label: `Withdraw $${a}`,
      disabled: s.savings < a,
      onSelect: () => { ctx.apply(withdraw(ctx.get(), a)); atmPanel(ctx); },
    })),
    {
      label: 'Withdraw everything',
      disabled: s.savings <= 0,
      onSelect: () => { ctx.apply(withdraw(ctx.get(), ctx.get().savings)); atmPanel(ctx); },
    },
    {
      label: s.home === 'loft' ? 'Skyline Loft — owned' : `Buy the Skyline Loft`,
      detail: s.home === 'loft' ? 'home sweet home' : `$${HOMES.loft.price.toLocaleString()} down`,
      disabled: s.home === 'loft',
      onSelect: () => {
        const loft = HOMES.loft;
        openDialog({
          title: 'First Federal — Real Estate',
          body: `${loft.name}\n\nA proper place: big windows, a real couch, an actual view.\n\n$${loft.price.toLocaleString()} down, in cash.`,
          options: [
            {
              label: `Buy — $${loft.price.toLocaleString()}`,
              disabled: ctx.get().cash < loft.price,
              onSelect: () => { if (ctx.apply(buyHome(ctx.get(), 'loft'))) closeDialog(); },
            },
          ],
          closeLabel: 'Maybe later',
        });
      },
    },
  ];
  openDialog({
    title: 'First Federal — ATM',
    body: `Cash on hand: $${s.cash.toLocaleString()}\nSavings: $${s.savings.toLocaleString()}  (${(DAILY_INTEREST * 100).toFixed(1)}%/night)`,
    options: opts,
    closeLabel: 'Take card',
  });
}

function recordsPanel(ctx: GameCtx): void {
  const s = ctx.get();
  openDialog({
    title: 'Spin City Records',
    body: '"Vinyl\'s coming back, man. It never left. Flip through the crates."',
    options: [...RECORDS, ...UPGRADES].map(good => {
      const has = owns(s, good.id);
      const label = good.kind === 'record' ? `${good.name} — ${good.by}` : good.name;
      return {
        label,
        detail: has ? 'owned' : `$${good.price}`,
        disabled: has || s.cash < good.price,
        onSelect: () => {
          openDialog({
            title: good.kind === 'record' ? `${good.name}` : good.name,
            body: `${good.by ? good.by + '\n\n' : ''}${good.blurb}\n\n$${good.price}`,
            options: [
              {
                label: `Buy — $${good.price}`,
                disabled: s.cash < good.price,
                onSelect: () => {
                  if (ctx.apply(buyGood(ctx.get(), good.id))) recordsPanel(ctx);
                },
              },
              { label: 'Put it back', onSelect: () => recordsPanel(ctx) },
            ],
            closeLabel: null,
          });
        },
      };
    }),
    closeLabel: 'Head out',
  });
}

/** The home stereo. Wired to the audio radio via ctx.playStation. */
function mirrorPanel(ctx: GameCtx): void {
  const s = ctx.get();
  openDialog({
    title: `Mirror — ${s.look.name}`,
    body: 'Not bad. Not bad at all.',
    options: [
      { label: 'Next shirt color', onSelect: () => { ctx.apply(cycleShirt(ctx.get())); mirrorPanel(ctx); } },
      { label: 'Next hair color', onSelect: () => { ctx.apply(cycleHair(ctx.get())); mirrorPanel(ctx); } },
      { label: 'Next skin tone', onSelect: () => { ctx.apply(cycleSkin(ctx.get())); mirrorPanel(ctx); } },
      {
        label: 'Change your name',
        onSelect: () => {
          const name = ctx.promptName?.(s.look.name);
          if (name != null) { ctx.apply(setName(ctx.get(), name)); mirrorPanel(ctx); }
        },
      },
    ],
    closeLabel: 'Looking good',
  });
}

function stereoPanel(ctx: GameCtx): void {
  const s = ctx.get();
  if (!hasStereo(s)) {
    openDialog({
      title: 'Empty shelf',
      body: 'A dusty rectangle where a stereo should be.\nSpin City Records sells a Component Stereo.',
      options: [],
      closeLabel: 'Someday',
    });
    return;
  }
  const records = ownedRecords(s);
  if (records.length === 0) {
    openDialog({
      title: 'Component Stereo',
      body: 'Powered up, warm, and waiting. You don\'t own any records yet.',
      options: [],
      closeLabel: 'Hmm',
    });
    return;
  }
  openDialog({
    title: 'Component Stereo',
    body: 'Pick something to spin.',
    options: [
      ...records.map(r => ({
        label: r.name,
        detail: r.by,
        onSelect: () => {
          ctx.playStation?.(r.mood ?? 0);
          toast(`♪ Now spinning: ${r.name}`);
          closeDialog();
        },
      })),
      { label: 'Turn it off', onSelect: () => { ctx.stopStation?.(); closeDialog(); } },
    ],
    closeLabel: 'Leave it playing',
  });
}

let tvChannel = 0; // persists across the session, like the car radio

function tvPanel(ctx: GameCtx): void {
  const p = nowPlaying(tvChannel, ctx.get());
  openDialog({
    title: `📺 Ch ${tvChannel + 1} — ${p.channel}`,
    body: `▓▒░  ${p.title}  ░▒▓\n\n${p.body}`,
    options: [
      { label: 'Flip the channel', detail: `${CHANNELS} channels, all snow`, onSelect: () => { tvChannel = (tvChannel + 1) % CHANNELS; tvPanel(ctx); } },
    ],
    closeLabel: 'Turn it off',
  });
}

function newsPanel(ctx: GameCtx): void {
  const e = dailyEdition(ctx.get());
  const rule = '─'.repeat(30);
  const lines = [
    `        ${e.masthead}`,
    `${e.date}${' '.repeat(Math.max(1, 28 - e.date.length))}${e.price}`,
    rule,
    `» ${e.lead} «`,
    '',
    e.story,
    '',
    e.forecast,
    rule,
    e.community,
    '',
    e.tip,
    '',
    e.horoscope,
  ];
  if (e.y2k) { lines.push(rule, e.y2k); }
  openDialog({
    title: 'CITY HERALD — 50¢',
    body: lines.join('\n'),
    options: [],
    closeLabel: 'Fold it up',
  });
}

function journalPanel(ctx: GameCtx): void {
  const s = ctx.get();
  const obj = storyObjective(s);
  const favors = activeFavorObjectives(s);
  const parts: string[] = [];
  parts.push('The Lost Pressing');
  parts.push(obj ? (s.storyStage > 3 ? obj : `  Current: ${obj}`) : '  Not begun — get to know Marcus.');
  if (favors.length) {
    parts.push('');
    parts.push('Favors');
    parts.push(...favors.map(f => `  ${f}`));
  }
  openDialog({
    title: 'Journal',
    body: parts.join('\n'),
    options: [],
    closeLabel: 'Close',
  });
}

function goalsPanel(ctx: GameCtx): void {
  const s = ctx.get();
  const p = progress(s);
  const lines = ASPIRATIONS.map(a => {
    const done = isDone(s, a.id);
    return `${done ? '☑' : '☐'} ${a.title} — ${done ? 'done' : a.hint}`;
  }).join('\n');
  openDialog({
    title: `Life Goals — ${p.done}/${p.total}`,
    body: `${lines}\n\n${s.wonAt ? 'Every goal met. This is your city now.' : 'A life takes shape one box at a time.'}`,
    options: [],
    closeLabel: 'Back',
  });
}

function payphonePanel(ctx: GameCtx): void {
  const s = ctx.get();
  if (s.gig) {
    const left = gigTimeLeft(s) ?? 0;
    openDialog({
      title: 'Payphone',
      body: `Current job: get to ${s.gig.destName} for $${s.gig.pay}.\n${left > 0 ? `About ${left} minutes left.` : 'You are late. Move.'}`,
      options: [
        {
          label: 'Drop the job',
          onSelect: () => {
            ctx.apply(abandonGig(ctx.get()));
            closeDialog();
          },
        },
      ],
      closeLabel: 'Hang up',
    });
    return;
  }
  const gigs = availableGigs(s);
  openDialog({
    title: 'Payphone — Odd Jobs',
    body: 'The receiver smells like every quarter ever spent. Three notes are taped inside.',
    options: gigs.map(gig => ({
      label: `${gig.destName} run — $${gig.pay}`,
      detail: `${gig.window}min`,
      onSelect: () => {
        openDialog({
          title: gig.giver,
          body: gig.brief,
          options: [
            {
              label: `Take it — $${gig.pay}, ${gig.window} minutes`,
              onSelect: () => {
                ctx.apply(acceptGig(ctx.get(), gig));
                closeDialog();
              },
            },
          ],
          closeLabel: 'Not interested',
        });
      },
    })),
    closeLabel: 'Hang up',
  });
}

function benchPanel(ctx: GameCtx): void {
  openDialog({
    title: 'Park bench',
    body: 'Pigeons negotiate over half a pretzel.',
    options: [
      {
        label: 'Sit a while',
        detail: '30 min',
        onSelect: () => {
          closeDialog();
          ctx.apply(rest(ctx.get(), 30, 8, 'The pigeons accept you as one of their own.'));
        },
      },
    ],
  });
}

export { toast };
