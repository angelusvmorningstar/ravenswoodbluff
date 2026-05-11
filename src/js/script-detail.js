import characters from '../data/characters.json';

const TEAMS = [
  { id: 'townsfolk',  label: 'Townsfolk' },
  { id: 'outsider',   label: 'Outsiders' },
  { id: 'minion',     label: 'Minions' },
  { id: 'demon',      label: 'Demons' },
  { id: 'traveller',  label: 'Travellers' },
  { id: 'fabled',     label: 'Fabled' },
];

const scriptModules = import.meta.glob('../data/scripts/*.json');
const charById = new Map(characters.map(c => [c.id, c]));

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function init() {
  const root = document.getElementById('script-char-root');
  if (!root) return;

  const slug   = root.dataset.slug;
  const loader = scriptModules[`../data/scripts/${slug}.json`];
  if (!loader) {
    root.hidden = true;
    return;
  }

  const { default: script } = await loader();
  const ids   = script.filter(x => typeof x === 'string');
  const chars = ids.map(id => charById.get(id)).filter(Boolean);

  const teamOrder = Object.fromEntries(TEAMS.map((t, i) => [t.id, i]));
  chars.sort((a, b) => teamOrder[a.team] - teamOrder[b.team]);

  let html = '<div class="script-char-grid">';
  let currentTeam = null;

  for (const c of chars) {
    if (c.team !== currentTeam) {
      const label = TEAMS.find(t => t.id === c.team)?.label ?? c.team;
      html += `<p class="script-team-heading">${escapeHtml(label)}</p>`;
      currentTeam = c.team;
    }
    html += `<div class="script-char-tile">
      <img class="script-char-tile__icon"
           src="/${c.iconPath}"
           alt="${escapeHtml(c.name)}"
           width="64" height="64"
           loading="lazy">
      <span class="script-char-tile__name">${escapeHtml(c.name)}</span>
    </div>`;
  }

  html += '</div>';
  root.innerHTML = html;
}

init();
