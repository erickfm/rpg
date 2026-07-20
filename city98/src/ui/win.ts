/** Win95-flavored dialog windows, keyboard-driven so the pointer stays locked. */

export interface DialogOption {
  label: string;
  detail?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface DialogSpec {
  title: string;
  body?: string;
  options: DialogOption[];
  closeLabel?: string | null; // null = no auto close row
}

let overlay: HTMLElement;
let current: DialogSpec | null = null;
let currentOptions: DialogOption[] = [];

export function initDialogs(parent: HTMLElement): void {
  overlay = document.createElement('div');
  overlay.id = 'dlg-overlay';
  overlay.hidden = true;
  parent.appendChild(overlay);
  document.addEventListener('keydown', onKey);
}

export function isDialogOpen(): boolean {
  return current !== null;
}

export function closeDialog(): void {
  current = null;
  currentOptions = [];
  overlay.hidden = true;
  overlay.innerHTML = '';
}

export function openDialog(spec: DialogSpec): void {
  current = spec;
  overlay.hidden = false;
  overlay.innerHTML = '';

  const win = document.createElement('div');
  win.className = 'win';

  const bar = document.createElement('div');
  bar.className = 'win-title';
  bar.innerHTML = `<span class="win-title-text"></span><button class="win-x">✕</button>`;
  bar.querySelector('.win-title-text')!.textContent = spec.title;
  bar.querySelector('.win-x')!.addEventListener('click', closeDialog);
  win.appendChild(bar);

  const body = document.createElement('div');
  body.className = 'win-body';
  if (spec.body) {
    const text = document.createElement('div');
    text.className = 'win-text';
    text.textContent = spec.body;
    body.appendChild(text);
  }

  currentOptions = [...spec.options];
  if (spec.closeLabel !== null) {
    currentOptions.push({ label: spec.closeLabel ?? 'Leave', onSelect: closeDialog });
  }
  currentOptions.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'win-btn';
    btn.disabled = !!opt.disabled;
    btn.innerHTML = `<span class="key">${i + 1}</span><span class="lbl"></span><span class="det"></span>`;
    btn.querySelector('.lbl')!.textContent = opt.label;
    btn.querySelector('.det')!.textContent = opt.detail ?? '';
    btn.addEventListener('click', () => {
      if (!opt.disabled) opt.onSelect();
    });
    body.appendChild(btn);
  });

  win.appendChild(body);
  overlay.appendChild(win);
}

function onKey(e: KeyboardEvent): void {
  if (!current) return;
  if (e.key === 'Escape') {
    closeDialog();
    return;
  }
  const idx = Number.parseInt(e.key, 10) - 1;
  if (idx >= 0 && idx < currentOptions.length) {
    const opt = currentOptions[idx];
    if (!opt.disabled) opt.onSelect();
  }
}
