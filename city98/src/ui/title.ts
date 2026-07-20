import { SHIRT_COLORS, HAIR_COLORS, SKIN_COLORS } from '../core/appearance';
import type { SlotSummary } from '../core/saves';

export interface NewGameChoice {
  name: string;
  shirt: number;
  hair: number;
  skin: number;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const homeName = (h: string) => (h === 'loft' ? 'Skyline Loft' : 'Maple Court');

/** The CITY 98 title screen: pick one of three save slots. */
export function showTitle(
  slots: SlotSummary[],
  onContinue: (slot: number) => void,
  onNewGame: (slot: number, c: NewGameChoice) => void,
  onDelete: (slot: number) => void,
): void {
  const data = slots.map(s => ({ ...s }));
  const overlay = document.createElement('div');
  overlay.id = 'title-overlay';
  overlay.innerHTML = `
    <div class="win title-win">
      <div class="win-title"><span class="win-title-text">CITY98.EXE</span><span></span></div>
      <div class="win-body title-body">
        <div class="title-logo">CITY <span>98</span></div>
        <div class="title-tag">a life, one day at a time</div>
        <div id="title-menu"></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', e => e.stopPropagation());
  const menu = overlay.querySelector<HTMLElement>('#title-menu')!;

  const button = (label: string, cls = '') => {
    const b = document.createElement('button');
    b.className = `win-btn title-btn ${cls}`;
    b.innerHTML = `<span class="lbl">${label}</span>`;
    return b;
  };

  function showMenu(): void {
    menu.innerHTML = '';
    for (const s of data) {
      const row = document.createElement('div');
      row.className = 'slot-row';
      if (s.empty) {
        const nw = button(`Slot ${s.slot} · <span class="slot-sub">empty — start a new life</span>`);
        nw.addEventListener('click', () => showCreate(s.slot));
        row.appendChild(nw);
      } else {
        const cont = button(`Slot ${s.slot} · <b>${escape(s.name)}</b> <span class="slot-sub">Day ${s.day} · $${s.cash.toLocaleString()} · ${homeName(s.home)}</span>`);
        cont.addEventListener('click', () => { overlay.remove(); onContinue(s.slot); });
        const del = document.createElement('button');
        del.className = 'win-btn slot-del';
        del.innerHTML = '<span class="lbl">✕</span>';
        del.title = `Delete slot ${s.slot}`;
        del.addEventListener('click', () => confirmDelete(s.slot));
        row.append(cont, del);
      }
      menu.appendChild(row);
    }
  }

  function confirmDelete(slot: number): void {
    menu.innerHTML = '';
    const s = data[slot - 1];
    const msg = document.createElement('div');
    msg.className = 'title-tag';
    msg.textContent = `Erase ${s.name}'s life in slot ${slot}? This can't be undone.`;
    menu.appendChild(msg);
    const yes = button('Erase it', 'primary');
    yes.addEventListener('click', () => {
      onDelete(slot);
      data[slot - 1] = { slot, empty: true, name: '', day: 0, cash: 0, home: 'studio' };
      showMenu();
    });
    const no = button('Keep it');
    no.addEventListener('click', showMenu);
    menu.append(yes, no);
  }

  function showCreate(slot: number): void {
    menu.innerHTML = '';
    const choice: NewGameChoice = { name: 'Sam', shirt: 1, hair: 0, skin: 0 };

    const nameWrap = document.createElement('div');
    nameWrap.className = 'title-field';
    nameWrap.innerHTML = `<label>Name</label><input id="ng-name" maxlength="16" value="Sam" spellcheck="false" />`;
    menu.appendChild(nameWrap);
    const nameInput = nameWrap.querySelector<HTMLInputElement>('#ng-name')!;
    nameInput.addEventListener('input', () => { choice.name = nameInput.value; });

    const swatchRow = (label: string, colors: number[], key: 'shirt' | 'hair' | 'skin') => {
      const row = document.createElement('div');
      row.className = 'title-field';
      row.innerHTML = `<label>${label}</label><div class="swatches"></div>`;
      const holder = row.querySelector<HTMLElement>('.swatches')!;
      colors.forEach((c, i) => {
        const sw = document.createElement('button');
        sw.className = 'swatch' + (choice[key] === i ? ' sel' : '');
        sw.style.background = hex(c);
        sw.addEventListener('click', () => {
          choice[key] = i;
          holder.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
          sw.classList.add('sel');
        });
        holder.appendChild(sw);
      });
      menu.appendChild(row);
    };
    swatchRow('Shirt', SHIRT_COLORS, 'shirt');
    swatchRow('Hair', HAIR_COLORS, 'hair');
    swatchRow('Skin', SKIN_COLORS, 'skin');

    const start = button(`Start life in slot ${slot}`, 'primary');
    start.addEventListener('click', () => {
      choice.name = (nameInput.value.trim() || 'Sam').slice(0, 16);
      overlay.remove();
      onNewGame(slot, choice);
    });
    menu.appendChild(start);

    const back = button('Back');
    back.addEventListener('click', showMenu);
    menu.appendChild(back);
  }

  showMenu();
}

function escape(s: string): string {
  return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!));
}
