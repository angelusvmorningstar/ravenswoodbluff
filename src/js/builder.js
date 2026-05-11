import characters from '../data/characters.json';
import nightFirstData from '../data/night-first.json';
import nightOtherData from '../data/night-other.json';
import officialScripts from '../data/official-scripts.json';
import myScripts from '../data/my-scripts.json';
import { BROCADE_GROUPS, BROCADES, DEFAULT_BROCADE } from './brocade-manifest.js';
import { getPaperSize, setPaperSize } from './paper-preference.js';
import carousel from '/data/sleeves/donor-boxes/carousel-v1.json';
import { analyseScript } from './analyser.js';

const OFFICIAL_FINGERPRINTS = officialScripts.map(s => ({
  name: s.name,
  fingerprint: [...s.characters].sort().join('|'),
}));

function matchOfficialScript() {
  const fp = [...selection].sort().join('|');
  return OFFICIAL_FINGERPRINTS.find(s => s.fingerprint === fp)?.name ?? null;
}

const scriptModules = import.meta.glob('../data/scripts/*.json');

const TEAMS = [
  { id: 'townsfolk', label: 'Townsfolk' },
  { id: 'outsider',  label: 'Outsiders' },
  { id: 'minion',    label: 'Minions' },
  { id: 'demon',     label: 'Demons' },
  { id: 'traveller', label: 'Travellers' },
  { id: 'fabled',    label: 'Fabled' },
  // { id: 'loric', label: 'Loric' }, // hidden — restore to re-enable
];

const PANEL_ID = 'builder-roster-panel';
const charById      = new Map(characters.map(c => [c.id, c]));
const charByStripped = new Map(characters.map(c => [c.id.replace(/-/g, ''), c.id]));

function normaliseCharId(raw) {
  if (charById.has(raw)) return raw;
  const hyphenated = raw.replace(/_/g, '-');
  if (charById.has(hyphenated)) return hyphenated;
  return charByStripped.get(raw.replace(/[-_]/g, '')) ?? null;
}

const TITLE_MODES = {
  plain:  { family: "'MedievalSharp', serif", size: '30pt', backSize: '52pt', weight: 400, textured: false },
  ornate: { family: "'Gothicus', serif",       size: '48pt', backSize: '76pt', weight: 400, textured: true  },
};

let activeTeam = 'townsfolk';
const selection = new Set();
let scriptName = '';
let scriptAuthor = 'Angelus Morningstar';
const designState = {
  brocade: DEFAULT_BROCADE,
  titleMode: 'ornate',
  iconSet: 'alt',
  logo: '',
};

function iconFor(char) {
  return designState.iconSet === 'official' && char.iconPathOfficial
    ? char.iconPathOfficial
    : char.iconPath;
}

// Set in init(); module-level so toggleTile can call updateBalance without params
let balanceChips = null;
let balanceWarning = null;
let officialNotice = null;
let printBtnRef = null;
let downloadBtnRef = null;
let sheetPanelRef = null;
let blockedOverlayRef = null;
let blockedOverlayTitleRef = null;
let blockedReason = null;
let blurbPanelRef = null;
let sleevePanelRef = null;
let tileGridRef = null;
let currentHighlights = new Set();
let currentNoticeIds  = new Set();  // characters with any active finding
let openDropCharId    = null;        // char ID whose tile drop is open
let openDropEl        = null;        // reference to the open .builder-tile-drop element
let noticesByCharId   = new Map();   // charId → Finding[]
let stripRef          = null;        // .builder-strip element
let openStripRuleId   = null;        // rule_id of expanded strip item
let errorBannerRef    = null;        // .builder-error-banner element

let sleeveModulesCache = null;
let sleeveDownloading = false;
let sleeveThemes = [];
let sleevePaperSize = localStorage.getItem('rvb-paper-size') === 'Letter' ? 'Letter' : 'A4';
let sheetPaperSize = getPaperSize();
let pageStyleTag = null;

function showBlurb(text) {
  if (!blurbPanelRef) return;
  if (!text) {
    blurbPanelRef.hidden = true;
    return;
  }
  blurbPanelRef.querySelector('.builder-blurb__text').textContent = text;
  blurbPanelRef.hidden = false;
}

function applyOfficialBlock() {
  if (!officialNotice || !printBtnRef || !downloadBtnRef) return;
  blockedReason = matchOfficialScript();
  const sleeveDownloadBtn = document.getElementById('sleeve-builder-download-btn');
  if (blockedReason) {
    officialNotice.hidden = false;
    officialNotice.textContent =
      `This roster matches the official ${blockedReason} script. Printing and download are disabled out of respect for The Pandemonium Institute. If you would like a printed copy, please buy one from the TPI store.`;
    printBtnRef.disabled = true;
    downloadBtnRef.disabled = true;
    if (sleeveDownloadBtn) sleeveDownloadBtn.disabled = true;
    if (sheetPanelRef) sheetPanelRef.classList.add('builder-sheet-panel--blocked');
    if (blockedOverlayRef) blockedOverlayRef.hidden = false;
    if (blockedOverlayTitleRef) blockedOverlayTitleRef.textContent = blockedReason;
  } else {
    officialNotice.hidden = true;
    officialNotice.textContent = '';
    printBtnRef.disabled = false;
    downloadBtnRef.disabled = false;
    if (sleeveDownloadBtn) sleeveDownloadBtn.disabled = false;
    if (sheetPanelRef) sheetPanelRef.classList.remove('builder-sheet-panel--blocked');
    if (blockedOverlayRef) blockedOverlayRef.hidden = true;
    if (blockedOverlayTitleRef) blockedOverlayTitleRef.textContent = '';
  }
}

function tabId(teamId) {
  return `builder-tab-${teamId}`;
}

function updateBalance() {
  if (!balanceChips) return;

  const counts = Object.fromEntries(TEAMS.map(t => [t.id, 0]));
  for (const id of selection) {
    const char = charById.get(id);
    if (char) counts[char.team]++;
  }

  for (const t of TEAMS) {
    const chip  = balanceChips.querySelector(`.balance-chip[data-team="${t.id}"]`);
    const count = balanceChips.querySelector(`[data-count="${t.id}"]`);
    if (count) count.textContent = counts[t.id];
    if (chip) chip.classList.toggle('balance-chip--empty', counts[t.id] === 0);
  }

  balanceWarning.textContent = counts.demon === 0 ? 'No Demon selected.' : '';
  applyOfficialBlock();
  renderPrintSheet();
  renderNightSheet();
  updateAnalysis();
}

function renderTile(char) {
  const selected = selection.has(char.id);
  return `<div
    class="builder-tile${selected ? ' builder-tile--selected' : ''}"
    role="checkbox"
    aria-checked="${selected}"
    tabindex="0"
    data-id="${char.id}"
  >
    <img
      class="builder-tile__icon"
      src="/${iconFor(char)}"
      alt="${char.name} icon"
      draggable="false"
      width="32"
      height="32">
    <span class="builder-tile__name">${char.name}</span>
    <button
      class="builder-tile__notice-btn"
      type="button"
      tabindex="-1"
      aria-label="Show analysis notes for ${escapeHtml(char.name)}"
    >†</button>
  </div>`;
}

function toggleTile(tile) {
  const id = tile.dataset.id;
  const next = tile.getAttribute('aria-checked') !== 'true';
  tile.setAttribute('aria-checked', String(next));
  tile.classList.toggle('builder-tile--selected', next);
  if (next) selection.add(id);
  else selection.delete(id);
  updateBalance();
}

function bindIconFallbacks(container) {
  container.querySelectorAll('.builder-tile__icon').forEach(img => {
    img.addEventListener('error', () => { img.src = '/icons/_placeholder.png'; }, { once: true });
  });
}

function activateTeam(team, tablist, grid) {
  closeTileDrop();
  activeTeam = team;

  tablist.querySelectorAll('[role="tab"]').forEach(btn => {
    const active = btn.dataset.team === team;
    btn.setAttribute('aria-selected', String(active));
    btn.setAttribute('tabindex', active ? '0' : '-1');
    btn.classList.toggle('builder-tab--active', active);
  });

  grid.setAttribute('aria-labelledby', tabId(team));
  grid.innerHTML = characters.filter(c => c.team === team).map(renderTile).join('');
  bindIconFallbacks(grid);
  applyTileHighlights(currentHighlights);
  applyNoticeGlyphs(currentNoticeIds);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Body-text variant: escape HTML, then convert the spreadsheet's `¶` marker
// to a real line break. Whitespace around the marker is collapsed.
function escapeBody(str) {
  return escapeHtml(str).replace(/\s*¶\s*/g, '<br>');
}

function applyTileHighlights(ids) {
  currentHighlights = ids;
  if (!tileGridRef) return;
  tileGridRef.querySelectorAll('[data-id]').forEach(tile => {
    tile.classList.toggle('builder-tile--flagged', ids.has(tile.dataset.id));
  });
}

function applyNoticeGlyphs(ids) {
  currentNoticeIds = ids;
  if (!tileGridRef) return;
  tileGridRef.querySelectorAll('[data-id]').forEach(tile => {
    tile.classList.toggle('builder-tile--has-notice', ids.has(tile.dataset.id));
  });
}

function buildNoticesByCharId(errors, warnings, notices) {
  const map = new Map();
  for (const f of [...errors, ...warnings, ...notices]) {
    for (const id of (f.characters ?? [])) {
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(f);
    }
  }
  return map;
}

function closeTileDrop() {
  if (openDropEl) {
    openDropEl.remove();
    openDropEl = null;
  }
  openDropCharId = null;
}

function renderDropContent(findings) {
  return findings.map((f, i) => `
    <div class="tile-drop__finding${i > 0 ? ' tile-drop__finding--sep' : ''}">
      <p class="tile-drop__expert">${escapeHtml(f.notice_text || f.message)}</p>
      <hr class="tile-drop__rule" aria-hidden="true">
      <p class="tile-drop__learner">${escapeHtml(f.explainer_text || f.message)}</p>
    </div>
  `).join('');
}

function openTileDrop(tile, charId) {
  closeTileDrop();
  const findings = noticesByCharId.get(charId) ?? [];
  if (!findings.length) return;

  const name = tile.querySelector('.builder-tile__name')?.textContent ?? charId;
  const drop = document.createElement('div');
  drop.className = 'builder-tile-drop';
  drop.setAttribute('role', 'region');
  drop.setAttribute('aria-label', `Analysis notes for ${name}`);
  drop.innerHTML = renderDropContent(findings);

  tile.insertAdjacentElement('afterend', drop);
  openDropEl     = drop;
  openDropCharId = charId;
}

function updateOpenDrop() {
  if (!openDropCharId || !openDropEl) return;
  const findings = noticesByCharId.get(openDropCharId) ?? [];
  if (!findings.length) {
    closeTileDrop();
  } else {
    openDropEl.innerHTML = renderDropContent(findings);
  }
}

function closeStripItem() {
  if (!openStripRuleId || !stripRef) return;
  const btn = stripRef.querySelector(`[data-rule="${CSS.escape(openStripRuleId)}"]`);
  if (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.closest('.strip-item')?.querySelector('.strip-item__detail')?.remove();
  }
  openStripRuleId = null;
}

function openStripItem(btn) {
  closeStripItem();
  const ruleId   = btn.dataset.rule;
  const noticeText = btn.dataset.notice;
  const explainer  = btn.dataset.explainer;

  const detail = document.createElement('div');
  detail.className = 'strip-item__detail';
  detail.innerHTML = `
    <p class="strip-item__detail-expert">${escapeHtml(noticeText)}</p>
    <hr class="strip-item__detail-rule" aria-hidden="true">
    <p class="strip-item__detail-learner">${escapeHtml(explainer)}</p>
  `;
  btn.closest('.strip-item').appendChild(detail);
  btn.setAttribute('aria-expanded', 'true');
  openStripRuleId = ruleId;
}

function updateNoticeStrip(errors, warnings, notices) {
  if (!stripRef) return;

  const scriptFindings = [
    ...errors.filter(f => f.type === 'script'),
    ...warnings.filter(f => f.type === 'script'),
    ...notices.filter(f => f.type === 'script'),
  ];
  const charCount = [...errors, ...warnings, ...notices]
    .filter(f => f.type === 'character' || f.type === 'pair')
    .length;
  const allEmpty = !scriptFindings.length && charCount === 0;

  if (allEmpty) {
    stripRef.innerHTML = `
      <div class="strip-clean">
        <span class="strip-clean__icon" aria-hidden="true">✓</span>
        <span class="strip-clean__text">No issues detected</span>
      </div>
    `;
    openStripRuleId = null;
    return;
  }

  const severityLabel = sev => sev === 'hard_error' ? 'Error' : sev === 'soft_warning' ? 'Warning' : 'Note';
  const severityMod   = sev => sev === 'hard_error' ? 'error'  : sev === 'soft_warning' ? 'warn'    : 'note';

  const scriptItems = scriptFindings.map(f => `
    <div class="strip-item strip-item--${severityMod(f.severity)}">
      <button
        class="strip-item__toggle"
        type="button"
        aria-expanded="false"
        data-rule="${escapeHtml(f.rule_id)}"
        data-notice="${escapeHtml(f.notice_text || f.message)}"
        data-explainer="${escapeHtml(f.explainer_text || f.message).replace(/\n/g, '&#10;')}"
      >
        <span class="strip-item__badge">${severityLabel(f.severity)}</span>
        <span class="strip-item__text">${escapeHtml(f.notice_text || f.message)}</span>
        <span class="strip-item__chevron" aria-hidden="true">›</span>
      </button>
    </div>
  `).join('');

  const charBadge = charCount > 0
    ? `<div class="strip-item strip-item--char-count">
         <span class="strip-item__count">${charCount} character note${charCount !== 1 ? 's' : ''}</span>
       </div>`
    : '';

  const prevOpen = openStripRuleId;
  stripRef.innerHTML = scriptItems + charBadge;

  if (prevOpen) {
    const btn = stripRef.querySelector(`[data-rule="${CSS.escape(prevOpen)}"]`);
    if (btn) {
      openStripRuleId = null;  // reset so openStripItem doesn't try to close a stale ref
      openStripItem(btn);
    } else {
      openStripRuleId = null;
    }
  }
}

function updateErrorBanner(errors) {
  if (!errorBannerRef) return;
  if (!errors.length) {
    errorBannerRef.hidden = true;
    errorBannerRef.innerHTML = '';
    return;
  }

  const count = errors.length;
  const label = `${count} script error${count !== 1 ? 's' : ''}`;
  const MAX_LISTED = 3;
  const listed   = errors.slice(0, MAX_LISTED).map(f => `<li class="banner-list__item">${escapeHtml(f.notice_text || f.message)}</li>`);
  const overflow = count > MAX_LISTED
    ? `<span class="banner-overflow">…and ${count - MAX_LISTED} more</span>`
    : '';

  errorBannerRef.innerHTML = `
    <p class="banner-count">${label}</p>
    <ul class="banner-list">${listed.join('')}</ul>${overflow}
  `;
  errorBannerRef.hidden = false;
}

function updateAnalysis() {
  if (!tileGridRef) return;
  const { errors, warnings, notices } = analyseScript(selection, charById);

  const allIds = new Set([errors, warnings, notices].flatMap(arr => arr.flatMap(f => f.characters ?? [])));
  applyTileHighlights(allIds);
  applyNoticeGlyphs(allIds);

  noticesByCharId = buildNoticesByCharId(errors, warnings, notices);
  updateOpenDrop();
  updateNoticeStrip(errors, warnings, notices);
  updateErrorBanner(errors);
}

let printSheet     = null;
let printSheetBack = null;
let nightSheet     = null;
let nightSheetBack = null;
let sheetMode      = 'character';
const TEAM_ORDER = Object.fromEntries(TEAMS.map((t, i) => [t.id, i]));

// Canonical character order from script.bloodontheclocktower.com (release.botc.app/resources/data/roles.json).
// Characters not in this map sort to end of their team group.
const AMY_ORDER = new Map([
  // townsfolk
  ['steward',1],['knight',2],['chef',3],['noble',4],['investigator',5],
  ['washerwoman',6],['clockmaker',7],['grandmother',8],['librarian',9],['shugenja',10],
  ['pixie',11],['bounty-hunter',12],['empath',13],['high-priestess',14],['sailor',15],
  ['balloonist',16],['general',17],['preacher',18],['chambermaid',19],['village-idiot',20],
  ['snake-charmer',21],['mathematician',22],['king',23],['dreamer',24],['fortune-teller',25],
  ['cult-leader',26],['flowergirl',27],['town-crier',28],['oracle',29],['undertaker',30],
  ['innkeeper',31],['monk',32],['gambler',33],['acrobat',34],['exorcist',35],
  ['lycanthrope',36],['gossip',37],['savant',38],['alsaahir',39],['engineer',40],
  ['nightwatchman',41],['courtier',42],['seamstress',43],['philosopher',44],['huntsman',45],
  ['professor',46],['artist',47],['slayer',48],['fisherman',49],['princess',50],
  ['juggler',51],['soldier',52],['alchemist',53],['cannibal',54],['amnesiac',55],
  ['farmer',56],['minstrel',57],['ravenkeeper',58],['sage',59],['choirboy',60],
  ['banshee',61],['tea-lady',62],['mayor',63],['fool',64],['virgin',65],
  ['magician',66],['poppy-grower',67],['pacifist',68],['atheist',69],
  // outsider
  ['hermit',70],['butler',71],['goon',72],['ogre',73],['lunatic',74],
  ['drunk',75],['tinker',76],['recluse',77],['golem',78],['sweetheart',79],
  ['plague-doctor',80],['klutz',81],['moonchild',82],['saint',83],['barber',84],
  ['hatter',85],['mutant',86],['politician',87],['zealot',88],['damsel',89],
  ['snitch',90],['heretic',91],['puzzlemaster',92],
  // minion
  ['mezepheles',93],['godfather',94],['poisoner',95],['devils-advocate',96],['spy',97],
  ['harpy',98],['witch',99],['cerenovus',100],['fearmonger',101],['pit-hag',102],
  ['psychopath',103],['assassin',104],['wizard',105],['widow',106],['xaan',107],
  ['marionette',108],['wraith',109],['summoner',110],['evil-twin',111],['goblin',112],
  ['boomdandy',113],['mastermind',114],['scarlet-woman',115],['vizier',116],
  ['organ-grinder',117],['boffin',118],['baron',119],
  // demon
  ['yaggababble',120],['pukka',121],['lil-monsta',122],['no-dashii',123],['imp',124],
  ['shabaloth',125],['ojo',126],['kazali',127],['po',128],['zombuul',129],
  ['vigormortis',130],['vortox',131],['legion',132],['fang-gu',133],['lord-of-typhon',134],
  ['lleech',135],['al-hadikhia',136],['riot',137],['leviathan',138],
  // traveller
  ['thief',139],['bureaucrat',140],['barista',141],['harlot',142],['butcher',143],
  ['gunslinger',145],['matron',146],['gangster',147],['bone-collector',148],['judge',149],
  ['apprentice',150],['beggar',151],['deviant',152],['scapegoat',153],['bishop',155],['voudon',156],
  // fabled
  ['angel',157],['buddhist',158],['djinn',160],['doomsayer',161],['duchess',162],
  ['fibbin',164],['fiddler',165],['hells-librarian',166],['revolutionary',167],
  ['sentinel',168],['spirit-of-ivory',169],['toymaker',170],
  // loric
  ['bootlegger',171],['storm-catcher',178],
]);
const AMY_FALLBACK = 9999;

// Slot coordinates from the Affinity master (icon top-left, in mm).
// Order = leftmost column top→bottom, then right column top→bottom.
const SLOT_POSITIONS = {
  townsfolk: [
    { x: 22.5,  y: 26.8  }, // L1 (right column row 1 reserved for byline)
    { x: 22.5,  y: 44.8  }, // L2
    { x: 22.5,  y: 63.4  }, // L3
    { x: 22.5,  y: 82.1  }, // L4
    { x: 22.5,  y: 100.7 }, // L5
    { x: 22.5,  y: 119.3 }, // L6
    { x: 22.5,  y: 137.9 }, // L7
    { x: 115, y: 44.8  }, // R8
    { x: 115, y: 63.4  }, // R9
    { x: 115, y: 82.1  }, // R10
    { x: 115, y: 100.7 }, // R11
    { x: 115, y: 119.3 }, // R12
    { x: 115, y: 137.9 }, // R13
  ],
  outsider: [
    { x: 22.5,  y: 162.1 },
    { x: 22.5,  y: 180.8 },
    { x: 115, y: 162.1 },
    { x: 115, y: 180.8 },
  ],
  minion: [
    { x: 22.5,  y: 204.5 },
    { x: 22.5,  y: 223.1 },
    { x: 115, y: 204.5 },
    { x: 115, y: 223.1 },
  ],
  demon: [
    { x: 22.5,  y: 246.8 },
    { x: 22.5,  y: 265.4 },
    { x: 115, y: 246.8 },
    { x: 115, y: 265.4 },
  ],
};

// Letter proportional scaling: height ×(279/297), width ×(216/210). Starting point for calibration.
const SLOT_POSITIONS_LETTER = {
  townsfolk: [
    { x: 23, y: 25.2  }, // L1
    { x: 23, y: 42.1  }, // L2
    { x: 23, y: 59.6  }, // L3
    { x: 23, y: 77.1  }, // L4
    { x: 23, y: 94.7  }, // L5
    { x: 23, y: 112.2 }, // L6
    { x: 23, y: 129.5 }, // L7
    { x: 118, y: 42.1  }, // R8
    { x: 118, y: 59.6  }, // R9
    { x: 118, y: 77.1  }, // R10
    { x: 118, y: 94.7  }, // R11
    { x: 118, y: 112.2 }, // R12
    { x: 118, y: 129.5 }, // R13
  ],
  outsider: [
    { x: 23,  y: 152.3 },
    { x: 23,  y: 169.8 },
    { x: 118, y: 152.3 },
    { x: 118, y: 169.8 },
  ],
  minion: [
    { x: 23,  y: 192.1 },
    { x: 23,  y: 209.6 },
    { x: 118, y: 192.1 },
    { x: 118, y: 209.6 },
  ],
  demon: [
    { x: 23,  y: 231.8 },
    { x: 23,  y: 249.3 },
    { x: 118, y: 231.8 },
    { x: 118, y: 249.3 },
  ],
};

const SPINE_LABELS = [
  { team: 'townsfolk', label: 'Townsfolk' },
  { team: 'outsider',  label: 'Outsiders' },
  { team: 'minion',    label: 'Minions' },
  { team: 'demon',     label: 'Demons' },
];

function applyTitleMode() {
  if (!printSheet) return;
  const config = TITLE_MODES[designState.titleMode] ?? TITLE_MODES.plain;
  for (const el of [printSheet, printSheetBack]) {
    if (!el) continue;
    el.style.setProperty('--sheet-title-font', config.family);
    el.style.setProperty('--sheet-title-size', config.size);
    el.style.setProperty('--sheet-back-title-size', config.backSize);
    el.style.setProperty('--sheet-title-weight', config.weight);
    el.classList.toggle('sheet--textured', config.textured);
  }
  fitTitleSizes();
}

// Shrink-to-fit: pick the largest size in [minPt, maxPt] that doesn't overflow.
// Binary search; ~7 iterations for any sensible range.
let fontsReady = false;
function fitTextToBox(el, maxPt, minPt) {
  el.style.fontSize = `${maxPt}pt`;
  if (!isOverflowing(el)) return;
  let lo = minPt, hi = maxPt;
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = `${mid}pt`;
    if (isOverflowing(el)) hi = mid; else lo = mid;
  }
  el.style.fontSize = `${lo}pt`;
}

function isOverflowing(el) {
  return el.scrollWidth  > el.clientWidth  + 0.5 ||
         el.scrollHeight > el.clientHeight + 0.5;
}

function fitTitleSizes() {
  if (!printSheet || !fontsReady) return;
  const config = TITLE_MODES[designState.titleMode] ?? TITLE_MODES.plain;

  // Front title lives in printSheet (no .sheet--back), back title in
  // printSheetBack (permanent .sheet--back) — each is laid out independently.
  const front = printSheet.querySelector('.sheet-title');
  if (front && front.offsetParent) fitTextToBox(front, parseFloat(config.size), 16);

  const back = printSheetBack?.querySelector('.sheet-back-title');
  if (back && back.offsetParent) fitTextToBox(back, parseFloat(config.backSize), 24);
}

function renderPrintSheet() {
  if (!printSheet) return;

  // Group selected characters by team and sort each group by Amy order.
  const byTeam = { townsfolk: [], outsider: [], minion: [], demon: [] };
  for (const id of selection) {
    const c = charById.get(id);
    if (c && byTeam[c.team]) byTeam[c.team].push(c);
  }
  for (const team of Object.keys(byTeam)) {
    byTeam[team].sort((a, b) =>
      (AMY_ORDER.get(a.id) ?? AMY_FALLBACK) - (AMY_ORDER.get(b.id) ?? AMY_FALLBACK)
    );
  }

  // Place each selected character into a slot at its team's coordinates.
  const slotsHtml = [];
  const slotTable = sheetPaperSize === 'Letter' ? SLOT_POSITIONS_LETTER : SLOT_POSITIONS;
  for (const team of Object.keys(slotTable)) {
    const positions = slotTable[team];
    const chars = byTeam[team].slice(0, positions.length);
    const spread = chars.length === 2 && positions.length === 4;
    chars.forEach((c, i) => {
      const { x, y } = positions[spread ? i * 2 : i];
      slotsHtml.push(`<div class="sheet-slot" data-team="${team}" style="left:${x}mm;top:${y}mm">
        <img class="sheet-slot__icon" src="/${iconFor(c)}" alt="" aria-hidden="true">
        <p class="sheet-slot__name">${escapeHtml(c.name)}</p>
        <p class="sheet-slot__ability">${escapeBody(c.ability)}${c.setup ? ' <strong>' + escapeBody(c.setup) + '</strong>' : ''}</p>
      </div>`);
    });
  }

  const title = scriptName.trim() || 'Untitled Script';
  const byline = scriptAuthor.trim()
    ? `script by ${escapeHtml(scriptAuthor.trim())}`
    : '';

  const brocade = BROCADES.find(b => b.id === designState.brocade) ?? BROCADES[0];

  const spineHtml = SPINE_LABELS.map(s =>
    `<span class="sheet-spine-label" data-team="${s.team}">${s.label}</span>`
  ).join('');

  const html = `
    <div class="sheet-parchment" aria-hidden="true"></div>

    ${designState.logo ? `<img class="sheet-logo" src="${escapeHtml(designState.logo)}" alt="" aria-hidden="true">` : '<div class="sheet-logo" aria-hidden="true"></div>'}
    <h1 class="sheet-title">${escapeHtml(title)}</h1>
    <h1 class="sheet-back-title" aria-hidden="true">${escapeHtml(title)}</h1>
    ${designState.logo ? `<img class="sheet-back-logo" src="${escapeHtml(designState.logo)}" alt="" aria-hidden="true">` : '<div class="sheet-back-logo" aria-hidden="true"></div>'}
    <p class="sheet-byline">${byline}</p>

    ${spineHtml}

    ${slotsHtml.join('')}

    <p class="sheet-footer sheet-footer--copyright">Blood on the Clocktower &amp; all its characters<br>© Steven Medway &amp; The Pandemonium Institute</p>
    <p class="sheet-footer sheet-footer--legend">* not the<br>first night</p>
    <p class="sheet-footer sheet-footer--hosted">built at ravenswoodbluff.com</p>
  `;

  for (const el of [printSheet, printSheetBack]) {
    if (!el) continue;
    el.innerHTML = html;
    el.style.setProperty('--spine-bg', `url('/backgrounds/${brocade.file}')`);
    el.style.setProperty('--spine-color', brocade.color);
  }

  fitTitleSizes();
}

const PHASE_ICONS = {
  'Dusk':        '/icons/sheet/dusk.png',
  'Dawn':        '/icons/sheet/dawn.png',
  'Minion info': '/icons/sheet/minion-info.png',
  'Demon info':  '/icons/sheet/demon-info.png',
};

function renderPhaseRow(entry, y) {
  return `<div class="night-row night-row--phase" style="top:${y}mm">
    <div class="night-row__icon" aria-hidden="true">
      <img src="${PHASE_ICONS[entry.name] ?? ''}" alt="" aria-hidden="true"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'night-row__icon--missing'}))">
    </div>
    <p class="night-row__name night-row__name--phase">${escapeHtml(entry.name)}</p>
    <p class="night-row__effect">${escapeBody(entry.effect)}</p>
  </div>`;
}

function renderCharRow(entry, y) {
  const char = charById.get(entry.id);
  if (!char) return '';
  const teamClass = `night-row__name--${char.team}`;
  return `<div class="night-row" style="top:${y}mm">
    <div class="night-row__icon" aria-hidden="true">
      <img src="/${iconFor(char)}" alt="" aria-hidden="true"
           onerror="this.src='/icons/_placeholder.png'">
    </div>
    <p class="night-row__name ${teamClass}">${escapeHtml(char.name)}</p>
    <p class="night-row__effect">${escapeBody(entry.effect)}${entry.token ? `<span class="night-row__token">${escapeHtml(entry.token)}</span>` : ''}</p>
  </div>`;
}

function fitNightWordmark() {
  if (!nightSheet || !fontsReady) return;
  for (const el of [nightSheet, nightSheetBack]) {
    if (!el) continue;
    const wordmark = el.querySelector('.night-wordmark');
    if (!wordmark || !wordmark.offsetParent) continue;
    wordmark.style.fontSize = '';
    fitTextToBox(wordmark, 24, 8);
  }
}

function buildNightFaceHtml(data, spineLabel, title) {
  const rowsHtml = [];
  const rowStart = sheetPaperSize === 'Letter' ? 7.0 : 7.5;
  const rowStep  = sheetPaperSize === 'Letter' ? 11.3 : 12;
  let n = 0;
  for (const entry of data) {
    const visible = entry.type === 'phase' || selection.has(entry.id);
    if (!visible) continue;
    const y = rowStart + n * rowStep;
    rowsHtml.push(entry.type === 'phase'
      ? renderPhaseRow(entry, y)
      : renderCharRow(entry, y));
    n++;
  }
  return `
    <div class="night-parchment" aria-hidden="true"></div>
    <span class="night-spine-label">${escapeHtml(spineLabel)}</span>
    ${rowsHtml.join('')}
    <h1 class="night-wordmark">${escapeHtml(title)}</h1>
    <p class="sheet-footer sheet-footer--copyright">Blood on the Clocktower &amp; all its characters<br>© Steven Medway &amp; The Pandemonium Institute</p>
    <p class="sheet-footer sheet-footer--built-at">built at ravenswoodbluff.com</p>
  `;
}

function renderNightSheet() {
  if (!nightSheet) return;

  const brocade = BROCADES.find(b => b.id === designState.brocade) ?? BROCADES[0];
  const title = scriptName.trim() || 'Untitled Script';

  nightSheet.innerHTML     = buildNightFaceHtml(nightFirstData, 'First Night', title);
  nightSheetBack.innerHTML = buildNightFaceHtml(nightOtherData, 'Other Nights', title);

  for (const el of [nightSheet, nightSheetBack]) {
    if (!el) continue;
    el.style.setProperty('--spine-bg', `url('/backgrounds/${brocade.file}')`);
    el.style.setProperty('--spine-color', brocade.color);
  }

  fitNightWordmark();
}

async function loadPreset() {
  const params   = new URLSearchParams(window.location.search);
  const presetId = params.get('preset');
  if (!presetId) return null;

  const key    = `../data/scripts/${presetId}.json`;
  const loader = scriptModules[key];
  if (!loader) return null;

  try {
    const { default: script } = await loader();
    return script;
  } catch {
    return null;
  }
}

function slugify(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

function exportScript() {
  const ids = [...selection];
  const payload = [
    { id: '_meta', name: scriptName.trim(), author: scriptAuthor.trim() },
    ...ids,
  ];
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(scriptName)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildMetaPanel() {
  const panel = document.createElement('div');
  panel.className = 'builder-meta';

  const activeBrocade = BROCADES.find(b => b.id === designState.brocade) ?? BROCADES[0];

  panel.innerHTML = `
    <section class="builder-section">
      <h2 class="builder-section__heading">Script</h2>
      <div class="builder-section__body">
        <div class="builder-field">
          <label class="builder-field__label" for="builder-script-name">Name</label>
          <input
            class="builder-field__input"
            id="builder-script-name"
            type="text"
            autocomplete="off"
            placeholder="e.g. The Pale Court"
            aria-describedby="builder-script-name-error">
          <span
            class="builder-field__error"
            id="builder-script-name-error"
            role="alert"
            hidden>
            Script name is required before downloading.
          </span>
        </div>
        <div class="builder-field">
          <label class="builder-field__label" for="builder-author">Author</label>
          <input
            class="builder-field__input"
            id="builder-author"
            type="text"
            autocomplete="off"
            value="Angelus Morningstar">
        </div>
        ${myScripts.length > 0 ? `
        <div class="builder-field">
          <p class="builder-field__label" id="my-scripts-trigger-label">Load my script</p>
          <div class="my-scripts">
            <button
              type="button"
              class="my-scripts__trigger"
              id="my-scripts-trigger"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="my-scripts-popover">
              <span class="my-scripts__label">Choose…</span>
              <span class="my-scripts__chevron" aria-hidden="true">▾</span>
            </button>
            <div class="my-scripts__popover" id="my-scripts-popover" role="dialog" aria-label="My scripts" hidden>
              <ul class="my-scripts__list" role="listbox" aria-labelledby="my-scripts-trigger-label">
                ${myScripts.map(s => {
                  const colour = BROCADES.find(b => b.id === s.brocade)?.color ?? 'transparent';
                  return `<li role="presentation"><button class="my-scripts__option" type="button" data-script-id="${s.id}" role="option">
                    <span class="my-scripts__swatch" style="background-color:${colour}" aria-hidden="true"></span>
                    <span class="my-scripts__name">${escapeHtml(s.name)}</span>
                  </button></li>`;
                }).join('')}
              </ul>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    </section>

    <section class="builder-section">
      <h2 class="builder-section__heading">Sheet</h2>
      <div class="builder-section__body">
        <div class="builder-field">
          <p class="builder-field__label" id="sheet-view-label">View</p>
          <div class="segmented-stack">
            <div class="segmented" role="group" aria-labelledby="sheet-view-label">
              <button class="segmented__btn segmented__btn--active" type="button" data-sheet="character" aria-pressed="true">Character</button>
              <button class="segmented__btn" type="button" data-sheet="night" aria-pressed="false">Night</button>
              <button class="segmented__btn" type="button" data-sheet="sleeve" aria-pressed="false">Sleeve</button>
            </div>
            <div class="segmented" role="group" aria-label="Sheet face">
              <button class="segmented__btn segmented__btn--active" type="button" data-face="front" aria-pressed="true">Front</button>
              <button class="segmented__btn" type="button" data-face="back" aria-pressed="false">Back</button>
            </div>
          </div>
        </div>
        <div class="builder-field">
          <p class="builder-field__label" id="brocade-trigger-label">Spine colour</p>
          <div class="brocade">
            <button
              type="button"
              class="brocade__trigger"
              id="brocade-trigger"
              aria-haspopup="true"
              aria-expanded="false"
              aria-controls="brocade-popover">
              <span class="brocade__swatch" style="background-color:${activeBrocade.color}" aria-hidden="true"></span>
              <span class="brocade__label">${activeBrocade.label}</span>
              <span class="brocade__chevron" aria-hidden="true">▾</span>
            </button>
            <div class="brocade__popover" id="brocade-popover" role="dialog" aria-label="Choose spine colour" hidden>
              <div class="brocade-picker" role="group" aria-labelledby="brocade-trigger-label">
                ${BROCADE_GROUPS.map(group => `
                  <div class="brocade-group" role="group" aria-label="${group.label}">
                    ${group.items.map(b => `<button
                      class="brocade-swatch${b.id === designState.brocade ? ' brocade-swatch--active' : ''}"
                      type="button"
                      data-brocade="${b.id}"
                      title="${b.label}"
                      aria-label="${b.label}"
                      aria-pressed="${b.id === designState.brocade}"
                      style="background-color:${b.color}"
                    ></button>`).join('')}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="builder-field">
          <p class="builder-field__label" id="title-mode-label">Title style</p>
          <div class="segmented" role="group" aria-labelledby="title-mode-label">
            <button class="segmented__btn${designState.titleMode === 'plain'  ? ' segmented__btn--active' : ''}" type="button" data-mode="plain"  aria-pressed="${designState.titleMode === 'plain'}">Plain</button>
            <button class="segmented__btn${designState.titleMode === 'ornate' ? ' segmented__btn--active' : ''}" type="button" data-mode="ornate" aria-pressed="${designState.titleMode === 'ornate'}">Ornate</button>
          </div>
        </div>
        <div class="builder-field">
          <p class="builder-field__label" id="icon-set-label">Icons</p>
          <div class="segmented" role="group" aria-labelledby="icon-set-label">
            <button class="segmented__btn segmented__btn--active" type="button" data-iconset="alt" aria-pressed="true">Alternative</button>
          </div>
        </div>
        <div class="builder-field">
          <p class="builder-field__label" id="body-style-label">Body</p>
          <div class="segmented" role="group" aria-labelledby="body-style-label">
            <button class="segmented__btn segmented__btn--active" type="button" data-bodyfont="Atkinson Hyperlegible" data-bodysize="8pt"   aria-pressed="true">Atkinson</button>
            <button class="segmented__btn"                       type="button" data-bodyfont="Merriweather"          data-bodysize="7.5pt" aria-pressed="false">Merri</button>
            <button class="segmented__btn"                       type="button" data-bodyfont="Libre Baskerville"     data-bodysize="7.5pt" aria-pressed="false">Bask</button>
          </div>
        </div>
        <div class="builder-field">
          <p class="builder-field__label" id="paper-size-label">Paper</p>
          <div class="segmented" role="group" aria-labelledby="paper-size-label">
            <button class="segmented__btn${sheetPaperSize === 'A4' ? ' segmented__btn--active' : ''}" type="button" data-paper="A4"     aria-pressed="${sheetPaperSize === 'A4'}">A4</button>
            <button class="segmented__btn${sheetPaperSize === 'Letter' ? ' segmented__btn--active' : ''}" type="button" data-paper="Letter" aria-pressed="${sheetPaperSize === 'Letter'}">Letter</button>
          </div>
        </div>
        <button class="builder-btn" id="builder-logo-btn" type="button">
          Load Script Logo
        </button>
        <input class="builder-meta__file-input" id="builder-logo-input" type="file" accept="image/*" aria-hidden="true" tabindex="-1">
      </div>
    </section>

    <section class="builder-section">
      <h2 class="builder-section__heading">Actions</h2>
      <div class="builder-section__body">
        <p class="builder-notice" id="builder-official-notice" role="status" hidden></p>
        <div class="builder-actions">
          <button class="builder-btn" id="builder-load-btn" type="button">Load JSON</button>
          <input class="builder-meta__file-input" id="builder-file-input" type="file" accept=".json" aria-hidden="true" tabindex="-1">
          <button class="builder-btn builder-btn--primary" id="builder-download-btn" type="button">Download JSON</button>
          <button class="builder-btn" id="builder-sort-btn" type="button">Sort</button>
          <button class="builder-btn" id="builder-print-btn" type="button">Print</button>
        </div>
      </div>
    </section>
  `;
  return panel;
}

function buildBalanceIndicator() {
  const el = document.createElement('div');
  el.className = 'builder-balance';
  el.setAttribute('aria-label', 'Selection balance');
  const chips = TEAMS.map(t => `<span class="balance-chip balance-chip--empty" data-team="${t.id}">
    <span class="balance-chip__label">${t.label}</span>
    <span class="balance-chip__count" data-count="${t.id}">0</span>
  </span>`).join('');
  el.innerHTML = `
    <div class="builder-balance__chips" aria-live="off">${chips}</div>
    <p class="builder-balance__warning" aria-live="polite"></p>
  `;
  return el;
}

// ── Sleeve helpers ────────────────────────────────────────────────────────────

function findSleeveTheme(brocadeId) {
  if (!sleeveThemes.length) return null;
  return sleeveThemes.find(t => Array.isArray(t.brocadeKeys) && t.brocadeKeys.includes(brocadeId))
    ?? sleeveThemes[0];
}

async function loadSleeveModules() {
  if (sleeveModulesCache) return sleeveModulesCache;
  const [{ generateSleeveNet }, { composeThemedSleeve }] = await Promise.all([
    import('/js/sleeve/geometry.js'),
    import('/js/sleeve/composition.js'),
  ]);
  sleeveModulesCache = { generateSleeveNet, composeThemedSleeve };
  return sleeveModulesCache;
}

function buildSleeveSvg({ generateSleeveNet, composeThemedSleeve }) {
  const theme = findSleeveTheme(designState.brocade);
  if (!theme) return null;
  try {
    const { svg, dieline } = generateSleeveNet({
      donorBox: carousel,
      paperSize: sleevePaperSize,
      shaved: true,
    });
    const title = scriptName.trim() || 'Untitled Script';
    const brocade = BROCADES.find(b => b.id === designState.brocade);
    const spineColor = brocade?.color ?? '#1a0e05';
    const brocadeFile = brocade?.file ?? 'navy-blue.png';
    composeThemedSleeve({ svg, dieline, theme, title, titleMode: designState.titleMode, spineColor, brocadeFile, logoHref: designState.logo });
    return svg;
  } catch (err) {
    console.error('Sleeve SVG build failed:', err);
    return null;
  }
}

async function renderSleevePanelPreview() {
  const container = document.getElementById('sleeve-builder-preview');
  if (!container) return;
  try {
    const { generateSleeveNet, composeThemedSleeve } = await loadSleeveModules();
    const svg = buildSleeveSvg({ generateSleeveNet, composeThemedSleeve });
    if (svg) {
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
      container.replaceChildren(svg);
    } else {
      container.replaceChildren();
    }
  } catch (err) {
    console.error('Sleeve preview failed:', err);
  }
}

async function handleSleeveDownload() {
  if (sleeveDownloading || blockedReason) return;
  const btn = document.getElementById('sleeve-builder-download-btn');
  const statusEl = document.getElementById('sleeve-builder-download-status');
  sleeveDownloading = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
  if (statusEl) statusEl.textContent = '';

  try {
    const { generateSleeveNet, composeThemedSleeve } = await loadSleeveModules();
    const { exportSleeveAsPdf } = await import('/js/sleeve/pdf-adapter.js');
    const svg = buildSleeveSvg({ generateSleeveNet, composeThemedSleeve });
    if (!svg) throw new Error('Sleeve SVG generation failed.');
    const bytes = await exportSleeveAsPdf({ svgElement: svg, paperSize: sleevePaperSize });
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = makeSleeveFileName(sleevePaperSize);
    a.click();
    URL.revokeObjectURL(url);
    if (statusEl) statusEl.textContent = 'Sleeve PDF ready.';
  } catch (err) {
    console.error('Sleeve download failed:', err);
    if (statusEl) statusEl.textContent = 'Export failed — see console for details.';
  } finally {
    sleeveDownloading = false;
    if (btn) { btn.disabled = !!blockedReason; btn.textContent = 'Download sleeve PDF'; }
  }
}

function makeSleeveFileName(size) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `sleeve-${size.toLowerCase()}-${date}-${time}.pdf`;
}

async function init() {
  const [presetData] = await Promise.all([
    loadPreset(),
    fetch('/sleeves/themes/themes.json')
      .then(r => r.ok ? r.json() : null)
      .then(doc => {
        if (doc?.themes?.length) sleeveThemes = doc.themes.filter(t => t.status !== 'deprecated');
      })
      .catch(() => {}),
  ]);

  const root = document.getElementById('builder-root');

  // ── Left sidebar ──────────────────────────────────────────────────────────
  const sidebar = document.createElement('div');
  sidebar.className = 'builder-sidebar';
  root.appendChild(sidebar);

  // ── Right sheet panel — wire printSheet before any updateBalance() call ───
  const sheetPanel = document.createElement('div');
  sheetPanel.className = 'builder-sheet-panel';

  printSheet = document.createElement('div');
  printSheet.id = 'print-sheet';
  sheetPanel.appendChild(printSheet);

  printSheetBack = document.createElement('div');
  printSheetBack.id = 'print-sheet-back';
  printSheetBack.classList.add('sheet--back');
  sheetPanel.appendChild(printSheetBack);

  nightSheet = document.createElement('div');
  nightSheet.id = 'night-sheet';
  sheetPanel.appendChild(nightSheet);

  nightSheetBack = document.createElement('div');
  nightSheetBack.id = 'night-sheet-back';
  nightSheetBack.classList.add('night-sheet--back');
  sheetPanel.appendChild(nightSheetBack);

  const blockedOverlay = document.createElement('div');
  blockedOverlay.className = 'sheet-blocked';
  blockedOverlay.hidden = true;
  blockedOverlay.innerHTML = `
    <h2 class="sheet-blocked__title"></h2>
    <p class="sheet-blocked__body">
      This roster matches an official Blood on the Clocktower script.
      Printing and download have been disabled out of respect for The Pandemonium Institute.
      If you would like a printed copy, please buy one from the TPI store.
    </p>
  `;
  sheetPanel.appendChild(blockedOverlay);

  const sleevePanel = document.createElement('div');
  sleevePanel.id = 'sleeve-builder-panel';
  sleevePanel.className = 'sleeve-builder-panel';
  sleevePanel.innerHTML = `
    <div id="sleeve-builder-preview" class="sleeve-builder-preview" aria-label="Sleeve preview" aria-live="polite"></div>
    <div class="sleeve-builder-controls">
      <div class="sleeve-builder-paper-row">
        <p class="builder-field__label" id="sleeve-paper-label">Paper size</p>
        <div class="segmented" role="group" aria-labelledby="sleeve-paper-label">
          <button class="segmented__btn${sleevePaperSize === 'A4' ? ' segmented__btn--active' : ''}" type="button" data-sleevepaper="A4" aria-pressed="${sleevePaperSize === 'A4'}">A4</button>
          <button class="segmented__btn${sleevePaperSize === 'Letter' ? ' segmented__btn--active' : ''}" type="button" data-sleevepaper="Letter" aria-pressed="${sleevePaperSize === 'Letter'}">Letter</button>
        </div>
      </div>
      <div class="sleeve-builder-download-row">
        <button type="button" id="sleeve-builder-download-btn" class="builder-btn builder-btn--primary">Download sleeve PDF</button>
        <span id="sleeve-builder-download-status" class="sleeve-builder-download-status" aria-live="polite"></span>
      </div>
    </div>
  `;
  sheetPanel.appendChild(sleevePanel);
  sleevePanelRef = sleevePanel;

  sleevePanel.querySelector('.segmented[aria-labelledby="sleeve-paper-label"]').addEventListener('click', e => {
    const btn = e.target.closest('[data-sleevepaper]');
    if (!btn) return;
    const size = btn.dataset.sleevepaper;
    if (size === sleevePaperSize) return;
    sleevePaperSize = size;
    localStorage.setItem('rvb-paper-size', size);
    sleevePanel.querySelectorAll('[data-sleevepaper]').forEach(b => {
      const active = b.dataset.sleevepaper === size;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // Paper size affects only the downloaded PDF page dimensions; the on-screen
    // sleeve preview is identical for A4 and Letter, so no re-render here.
  });

  sleevePanel.querySelector('#sleeve-builder-download-btn').addEventListener('click', handleSleeveDownload);

  sheetPanel.addEventListener('contextmenu', e => {
    if (blockedReason) e.preventDefault();
  });

  window.addEventListener('beforeprint', e => {
    if (blockedReason) e.preventDefault();
  });

  root.appendChild(sheetPanel);

  // ── Sidebar: brand header ─────────────────────────────────────────────────
  const brand = document.createElement('div');
  brand.className = 'builder-brand';
  brand.innerHTML = `
    <a href="/" class="builder-brand__name">Ravenswood Bluff</a>
    <span class="builder-brand__tool">Script Builder</span>
  `;
  sidebar.appendChild(brand);

  // ── Sidebar: meta panel ───────────────────────────────────────────────────
  const metaPanel = buildMetaPanel();
  sidebar.appendChild(metaPanel);

  // ── Sidebar: blurb panel (shown when a named preset is active) ───────────
  const blurbEl = document.createElement('div');
  blurbEl.className = 'builder-blurb';
  blurbEl.hidden = true;
  blurbEl.setAttribute('aria-label', 'About this script');
  blurbEl.innerHTML = `
    <p class="builder-blurb__label">About this script</p>
    <p class="builder-blurb__text" aria-live="polite"></p>
  `;
  sidebar.appendChild(blurbEl);
  blurbPanelRef = blurbEl;

  // ── Sidebar: analyser experimental notice ────────────────────────────────
  const analyserNoteEl = document.createElement('p');
  analyserNoteEl.className = 'builder-analyser-note';
  analyserNoteEl.textContent = 'The script analyser is experimental. It covers many complex rules and interactions and is being actively refined — if something looks off, it\'s being worked on.';
  sidebar.appendChild(analyserNoteEl);

  // ── Sidebar: summary strip — Zone 3 ─────────────────────────────────────
  const stripEl = document.createElement('div');
  stripEl.className = 'builder-strip';
  stripEl.setAttribute('aria-label', 'Script analysis summary');
  sidebar.appendChild(stripEl);
  stripRef = stripEl;

  stripEl.addEventListener('click', e => {
    const btn = e.target.closest('.strip-item__toggle');
    if (!btn) return;
    const ruleId = btn.dataset.rule;
    if (openStripRuleId === ruleId) {
      closeStripItem();
    } else {
      openStripItem(btn);
    }
  });

  // ── Sidebar: balance indicator ────────────────────────────────────────────
  const balanceEl = buildBalanceIndicator();
  sidebar.appendChild(balanceEl);
  balanceChips   = balanceEl.querySelector('.builder-balance__chips');
  balanceWarning = balanceEl.querySelector('.builder-balance__warning');

  // ── Sidebar: tab strip ────────────────────────────────────────────────────
  const tablist = document.createElement('div');
  tablist.className = 'builder-tablist';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Filter by team');
  tablist.innerHTML = TEAMS.map(t => {
    const active = t.id === activeTeam;
    return `<button
      id="${tabId(t.id)}"
      class="builder-tab${active ? ' builder-tab--active' : ''}"
      role="tab"
      aria-selected="${active}"
      aria-controls="${PANEL_ID}"
      tabindex="${active ? '0' : '-1'}"
      data-team="${t.id}"
    >${t.label}</button>`;
  }).join('');
  sidebar.appendChild(tablist);

  // ── Sidebar: roster grid ──────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.id = PANEL_ID;
  grid.className = 'builder-roster';
  grid.setAttribute('role', 'tabpanel');
  grid.setAttribute('aria-labelledby', tabId(activeTeam));
  grid.innerHTML = characters.filter(c => c.team === activeTeam).map(renderTile).join('');
  sidebar.appendChild(grid);
  bindIconFallbacks(grid);
  tileGridRef = grid;

  // ── Sidebar: error banner — Zone 4 (sticky first-child) ──────────────────
  const bannerEl = document.createElement('div');
  bannerEl.className = 'builder-error-banner';
  bannerEl.hidden = true;
  bannerEl.setAttribute('role', 'alert');
  bannerEl.setAttribute('aria-live', 'polite');
  sidebar.insertAdjacentElement('afterbegin', bannerEl);
  errorBannerRef = bannerEl;

  const nameInput   = metaPanel.querySelector('#builder-script-name');
  const authorInput = metaPanel.querySelector('#builder-author');
  const nameError   = metaPanel.querySelector('#builder-script-name-error');

  if (scriptName) nameInput.value = scriptName;
  const loadBtn     = metaPanel.querySelector('#builder-load-btn');
  const fileInput   = metaPanel.querySelector('#builder-file-input');
  const logoBtn     = metaPanel.querySelector('#builder-logo-btn');
  const logoInput   = metaPanel.querySelector('#builder-logo-input');
  const downloadBtn = metaPanel.querySelector('#builder-download-btn');
  const printBtn    = metaPanel.querySelector('#builder-print-btn');

  printBtnRef    = printBtn;
  downloadBtnRef = downloadBtn;
  officialNotice = metaPanel.querySelector('#builder-official-notice');
  sheetPanelRef  = sheetPanel;
  blockedOverlayRef = blockedOverlay;
  blockedOverlayTitleRef = blockedOverlay.querySelector('.sheet-blocked__title');

  nameInput.addEventListener('input', () => {
    scriptName = nameInput.value;
    if (scriptName.trim()) nameError.hidden = true;
    renderPrintSheet();
    renderNightSheet();
  });

  authorInput.addEventListener('input', () => {
    scriptAuthor = authorInput.value;
    renderPrintSheet();
  });

  const titleModePicker = metaPanel.querySelector('[aria-labelledby="title-mode-label"]');
  titleModePicker.addEventListener('click', e => {
    const btn = e.target.closest('.segmented__btn');
    if (!btn || !btn.dataset.mode) return;
    designState.titleMode = btn.dataset.mode;
    titleModePicker.querySelectorAll('.segmented__btn').forEach(b => {
      const active = b.dataset.mode === designState.titleMode;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    applyTitleMode();
    if (sheetMode === 'sleeve') renderSleevePanelPreview();
  });

  const iconSetPicker = metaPanel.querySelector('[aria-labelledby="icon-set-label"]');
  iconSetPicker.addEventListener('click', e => {
    const btn = e.target.closest('.segmented__btn');
    if (!btn || !btn.dataset.iconset) return;
    designState.iconSet = btn.dataset.iconset;
    iconSetPicker.querySelectorAll('.segmented__btn').forEach(b => {
      const active = b.dataset.iconset === designState.iconSet;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    activateTeam(activeTeam, tablist, grid);
    renderPrintSheet();
    renderNightSheet();
  });

  function applyBodyVar(varName, value) {
    for (const el of [printSheet, printSheetBack, nightSheet, nightSheetBack]) {
      if (el) el.style.setProperty(varName, value);
    }
  }

  function applyBodyStyle(font, size) {
    applyBodyVar('--body-font', `'${font}'`);
    applyBodyVar('--body-size', size);
  }

  const bodyStylePicker = metaPanel.querySelector('[aria-labelledby="body-style-label"]');
  bodyStylePicker.addEventListener('click', e => {
    const btn = e.target.closest('.segmented__btn');
    if (!btn || !btn.dataset.bodyfont) return;
    bodyStylePicker.querySelectorAll('.segmented__btn').forEach(b => {
      const active = b === btn;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    applyBodyStyle(btn.dataset.bodyfont, btn.dataset.bodysize);
  });

  applyBodyStyle('Atkinson Hyperlegible', '8pt');

  function applySheetPaperSize(size) {
    const isLetter = size === 'Letter';
    const w = isLetter ? '216mm' : '210mm';
    const h = isLetter ? '279mm' : '297mm';
    for (const el of [printSheet, printSheetBack, nightSheet, nightSheetBack]) {
      if (el) {
        el.style.setProperty('--page-width', w);
        el.style.setProperty('--page-height', h);
      }
    }
    sheetPanel.classList.toggle('paper-size--letter', isLetter);
    if (pageStyleTag) pageStyleTag.remove();
    pageStyleTag = document.createElement('style');
    pageStyleTag.textContent = `@page { size: ${isLetter ? 'Letter' : 'A4'} portrait; }`;
    document.head.appendChild(pageStyleTag);
    window.addEventListener('afterprint', () => {
      pageStyleTag?.remove();
      pageStyleTag = null;
    }, { once: true });
    renderPrintSheet();
    renderNightSheet();
  }

  const paperSizePicker = metaPanel.querySelector('[aria-labelledby="paper-size-label"]');
  paperSizePicker.addEventListener('click', e => {
    const btn = e.target.closest('[data-paper]');
    if (!btn) return;
    const size = btn.dataset.paper;
    if (size === sheetPaperSize) return;
    sheetPaperSize = size;
    setPaperSize(size);
    paperSizePicker.querySelectorAll('[data-paper]').forEach(b => {
      const active = b.dataset.paper === size;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    applySheetPaperSize(size);
  });

  applySheetPaperSize(sheetPaperSize);

  loadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        loadScriptData(data, { fallbackName: file.name.replace(/\.json$/i, '') });
        showBlurb('');
      } catch { /* malformed JSON — ignore */ }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  logoBtn.addEventListener('click', () => logoInput.click());

  logoInput.addEventListener('change', () => {
    const file = logoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      designState.logo = e.target.result;
      renderPrintSheet();
      renderNightSheet();
    };
    reader.readAsDataURL(file);
    logoInput.value = '';
  });

  downloadBtn.addEventListener('click', () => {
    if (blockedReason) return;
    if (!scriptName.trim()) {
      nameError.hidden = false;
      nameInput.focus();
      return;
    }
    nameError.hidden = true;
    exportScript();
  });

  const sheetViewPicker = metaPanel.querySelector('[aria-labelledby="sheet-view-label"]');
  const sheetFacePicker = metaPanel.querySelector('[aria-label="Sheet face"]');

  function setSheetMode(mode) {
    sheetMode = mode;
    sheetPanel.classList.toggle('sheet-mode--night',  mode === 'night');
    sheetPanel.classList.toggle('sheet-mode--sleeve', mode === 'sleeve');
    sheetViewPicker.querySelectorAll('[data-sheet]').forEach(b => {
      const active = b.dataset.sheet === mode;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    sheetFacePicker.classList.toggle('builder-field--hidden', mode === 'sleeve');
    if (mode === 'sleeve') renderSleevePanelPreview();
  }

  sheetViewPicker.addEventListener('click', e => {
    const btn = e.target.closest('[data-sheet]');
    if (!btn) return;
    setSheetMode(btn.dataset.sheet);
  });

  const sortBtn = metaPanel.querySelector('#builder-sort-btn');
  sortBtn.addEventListener('click', () => {
    const sorted = [...selection].sort((a, b) => {
      const ca = charById.get(a);
      const cb = charById.get(b);
      const ta = TEAM_ORDER[ca?.team] ?? 99;
      const tb = TEAM_ORDER[cb?.team] ?? 99;
      if (ta !== tb) return ta - tb;
      return (AMY_ORDER.get(a) ?? AMY_FALLBACK) - (AMY_ORDER.get(b) ?? AMY_FALLBACK);
    });
    selection.clear();
    sorted.forEach(id => selection.add(id));
  });

  printBtn.addEventListener('click', () => {
    if (blockedReason) return;
    window.print();
  });

  function setSheetFace(face) {
    sheetPanel.classList.toggle('preview-back', face === 'back');
    sheetFacePicker.querySelectorAll('[data-face]').forEach(b => {
      const active = b.dataset.face === face;
      b.classList.toggle('segmented__btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    // The newly-visible face's title may not have been fit yet
    if (sheetMode === 'character') fitTitleSizes();
    else fitNightWordmark();
  }

  sheetFacePicker.addEventListener('click', e => {
    const btn = e.target.closest('[data-face]');
    if (!btn) return;
    setSheetFace(btn.dataset.face);
  });

  // ── Brocade popover ───────────────────────────────────────────────────────
  const brocadeTrigger = metaPanel.querySelector('#brocade-trigger');
  const brocadePopover = metaPanel.querySelector('#brocade-popover');
  const brocadeSwatch  = brocadeTrigger.querySelector('.brocade__swatch');
  const brocadeLabel   = brocadeTrigger.querySelector('.brocade__label');

  function setBrocadePopoverOpen(open) {
    brocadePopover.hidden = !open;
    brocadeTrigger.setAttribute('aria-expanded', String(open));
  }

  brocadeTrigger.addEventListener('click', e => {
    e.stopPropagation();
    setBrocadePopoverOpen(brocadePopover.hidden);
  });

  document.addEventListener('click', e => {
    if (brocadePopover.hidden) return;
    if (e.target.closest('.brocade')) return;
    setBrocadePopoverOpen(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !brocadePopover.hidden) {
      setBrocadePopoverOpen(false);
      brocadeTrigger.focus();
    }
  });

  function selectBrocade(id, { rerender = true } = {}) {
    const brocade = BROCADES.find(b => b.id === id);
    if (!brocade) return;
    designState.brocade = id;
    metaPanel.querySelectorAll('.brocade-swatch').forEach(s => {
      const active = s.dataset.brocade === id;
      s.classList.toggle('brocade-swatch--active', active);
      s.setAttribute('aria-pressed', String(active));
    });
    brocadeSwatch.style.backgroundColor = brocade.color;
    brocadeLabel.textContent = brocade.label;
    if (rerender) {
      renderPrintSheet();
      renderNightSheet();
      if (sheetMode === 'sleeve') renderSleevePanelPreview();
    }
  }

  metaPanel.addEventListener('click', e => {
    const swatch = e.target.closest('.brocade-swatch');
    if (!swatch) return;
    selectBrocade(swatch.dataset.brocade);
    setBrocadePopoverOpen(false);
  });

  function loadScriptData(data, { fallbackName = '' } = {}) {
    scriptName   = '';
    scriptAuthor = 'Angelus Morningstar';
    designState.logo   = '';
    nameInput.value   = '';
    authorInput.value = scriptAuthor;

    const meta = data.find(item => item?.id === '_meta');
    if (meta?.name)    { scriptName   = meta.name;   nameInput.value   = scriptName; }
    if (meta?.author)  { scriptAuthor = meta.author; authorInput.value = scriptAuthor; }
    if (meta?.logo)    { designState.logo   = meta.logo; }
    if (meta?.brocade) { selectBrocade(meta.brocade, { rerender: false }); }
    if (!scriptName && fallbackName) {
      scriptName = fallbackName;
      nameInput.value = scriptName;
    }

    selection.clear();
    for (const item of data) {
      const raw = typeof item === 'string' ? item : item?.id;
      if (!raw || raw === '_meta') continue;
      const id = normaliseCharId(raw);
      if (id) selection.add(id);
    }
    activateTeam(activeTeam, tablist, grid);
    updateBalance();
    renderPrintSheet();
    renderNightSheet();
    if (sheetMode === 'sleeve') renderSleevePanelPreview();
  }

  // ── My Scripts popover ────────────────────────────────────────────────────
  const myScriptsTrigger = metaPanel.querySelector('#my-scripts-trigger');
  const myScriptsPopover = metaPanel.querySelector('#my-scripts-popover');
  if (myScriptsTrigger && myScriptsPopover) {
    function setMyScriptsPopoverOpen(open) {
      myScriptsPopover.hidden = !open;
      myScriptsTrigger.setAttribute('aria-expanded', String(open));
    }

    myScriptsTrigger.addEventListener('click', e => {
      e.stopPropagation();
      setMyScriptsPopoverOpen(myScriptsPopover.hidden);
    });

    myScriptsPopover.addEventListener('click', e => {
      const btn = e.target.closest('.my-scripts__option');
      if (!btn) return;
      const entry = myScripts.find(s => s.id === btn.dataset.scriptId);
      if (!entry) return;
      const synthesised = [
        { id: '_meta', name: entry.name, logo: entry.logo, brocade: entry.brocade },
        ...entry.characters,
      ];
      loadScriptData(synthesised);
      showBlurb(entry.blurb ?? '');
      setMyScriptsPopoverOpen(false);
      myScriptsTrigger.focus();
    });

    document.addEventListener('click', e => {
      if (myScriptsPopover.hidden) return;
      if (e.target.closest('.my-scripts')) return;
      setMyScriptsPopoverOpen(false);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !myScriptsPopover.hidden) {
        setMyScriptsPopoverOpen(false);
        myScriptsTrigger.focus();
      }
    });
  }

  // Initial paint (printSheet is now wired, safe to call)
  updateBalance();
  applyTitleMode();

  // Apply URL preset (?preset=) now that DOM is wired and helpers are defined.
  if (presetData) {
    loadScriptData(presetData);
    const presetId = new URLSearchParams(window.location.search).get('preset');
    const presetEntry = myScripts.find(s => s.id === presetId);
    showBlurb(presetEntry?.blurb ?? '');
  }

  // Once @font-face files have actually loaded, do an authoritative refit —
  // the synchronous calls above will have measured against fallback metrics.
  document.fonts.ready.then(() => {
    fontsReady = true;
    fitTitleSizes();
    fitNightWordmark();
  });

  // Debug frame overlay — `d` to toggle, or `?debug` in URL to start enabled
  const allSheets = [printSheet, printSheetBack, nightSheet, nightSheetBack];
  if (new URLSearchParams(window.location.search).has('debug')) {
    allSheets.forEach(el => el?.classList.add('debug-frames'));
  }
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 'd') return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    allSheets.forEach(el => el?.classList.toggle('debug-frames'));
  });

  // ── Tab: click ────────────────────────────────────────────────────────────
  tablist.addEventListener('click', e => {
    const btn = e.target.closest('[role="tab"]');
    if (btn && btn.dataset.team !== activeTeam) {
      activateTeam(btn.dataset.team, tablist, grid);
    }
  });

  // ── Tab: roving tabindex — Left/Right arrows ──────────────────────────────
  tablist.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const idx = tabs.indexOf(document.activeElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % tabs.length
      : (idx - 1 + tabs.length) % tabs.length;
    tabs[next].focus();
    activateTeam(tabs[next].dataset.team, tablist, grid);
  });

  // ── Tile: click ───────────────────────────────────────────────────────────
  grid.addEventListener('click', e => {
    // Intercept notice-btn clicks before tile toggle
    const noticeBtn = e.target.closest('.builder-tile__notice-btn');
    if (noticeBtn) {
      e.stopPropagation();
      const tile   = noticeBtn.closest('[data-id]');
      const charId = tile?.dataset.id;
      if (!charId) return;
      if (openDropCharId === charId) {
        closeTileDrop();
      } else {
        openTileDrop(tile, charId);
      }
      return;
    }
    const tile = e.target.closest('[role="checkbox"]');
    if (tile) toggleTile(tile);
  });

  // ── Tile: Space / Enter ───────────────────────────────────────────────────
  grid.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const tile = e.target.closest('[role="checkbox"]');
    if (!tile) return;
    e.preventDefault();
    toggleTile(tile);
  });

}

init();
