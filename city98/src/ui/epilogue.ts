import type { Epilogue } from '../core/epilogue';

/** The "you made it" screen, shown once when every life goal is complete. */
export function showEpilogue(e: Epilogue, onKeepPlaying: () => void): void {
  const overlay = document.createElement('div');
  overlay.id = 'epilogue-overlay';
  const rows = e.lines.map(l => {
    const [label, val] = l.split(' — ');
    return `<div class="epi-row"><span class="epi-k">${label}</span><span class="epi-v">${val ?? ''}</span></div>`;
  }).join('');
  overlay.innerHTML = `
    <div class="win epi-win">
      <div class="win-title"><span class="win-title-text">CITY98.EXE</span><span></span></div>
      <div class="win-body epi-body">
        <div class="epi-badge">★ YOU MADE IT ★</div>
        <div class="epi-title">${e.title}</div>
        <div class="epi-rows">${rows}</div>
        <p class="epi-closing">${e.closing}</p>
        <button class="win-btn title-btn primary" id="epi-keep"><span class="lbl">Keep living in the city</span></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('keydown', ev => ev.stopPropagation());
  overlay.querySelector('#epi-keep')!.addEventListener('click', () => {
    overlay.remove();
    onKeepPlaying();
  });
}
