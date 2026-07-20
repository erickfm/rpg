export interface MenuOption {
  label: string;
  detail?: string;
  disabled?: boolean;
  hotkey?: string;
  icon?: string; // emoji shown in the white icon square, original-style
  onSelect: () => void;
}

export interface MenuSpec {
  title: string;
  body?: string | HTMLElement; // preformatted text or a live element
  options: MenuOption[];
  onClose?: () => void; // called when the menu closes
  locked?: boolean; // no leaving mid-fight
  /** Label for the auto-appended close option; null if an option already closes it. */
  leaveLabel?: string | null;
}

let overlay: HTMLElement;
let current: MenuSpec | null = null;
let currentOptions: MenuOption[] = [];

export function initMenu(parent: HTMLElement): void {
  overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  overlay.hidden = true;
  parent.appendChild(overlay);
  document.addEventListener('keydown', onKey);
}

export function isMenuOpen(): boolean {
  return current !== null;
}

export function closeMenu(): void {
  const closing = current;
  current = null;
  currentOptions = [];
  overlay.hidden = true;
  overlay.innerHTML = '';
  closing?.onClose?.();
}

export function openMenu(spec: MenuSpec): void {
  current = spec;
  overlay.hidden = false;
  overlay.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'menu-card';

  const title = document.createElement('h2');
  title.textContent = spec.title;
  card.appendChild(title);

  if (spec.body) {
    if (typeof spec.body === 'string') {
      const body = document.createElement('pre');
      body.className = 'menu-body';
      body.textContent = spec.body;
      card.appendChild(body);
    } else {
      spec.body.classList.add('menu-body');
      card.appendChild(spec.body);
    }
  }

  currentOptions = [...spec.options];
  if (!spec.locked && spec.leaveLabel !== null) {
    currentOptions.push({ label: spec.leaveLabel ?? 'Leave', icon: '➡', onSelect: closeMenu });
  }

  currentOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'menu-option';
    btn.disabled = !!opt.disabled;
    btn.innerHTML = `<span class="icon-box"></span><span class="label"></span><span class="detail"></span>`;
    btn.querySelector<HTMLElement>('.icon-box')!.textContent = opt.icon ?? '▶';
    btn.querySelector<HTMLElement>('.label')!.textContent = opt.label;
    btn.querySelector<HTMLElement>('.detail')!.textContent = opt.detail ?? '';
    btn.addEventListener('click', () => select(opt));
    card.appendChild(btn);
  });

  overlay.appendChild(card);
}

function select(opt: MenuOption): void {
  if (opt.disabled) return;
  opt.onSelect();
}

function onKey(e: KeyboardEvent): void {
  if (!current) return;
  if (e.key === 'Escape') {
    if (!current.locked) closeMenu();
    return;
  }
  const k = e.key.toLowerCase();
  const byHotkey = currentOptions.find(o => o.hotkey?.toLowerCase() === k);
  if (byHotkey) {
    select(byHotkey);
    return;
  }
  const idx = Number.parseInt(e.key, 10) - 1;
  const numbered = currentOptions.filter(o => !o.hotkey);
  if (idx >= 0 && idx < numbered.length) select(numbered[idx]);
}
