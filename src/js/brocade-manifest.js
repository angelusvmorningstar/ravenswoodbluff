// 28 full-height (A4) brocades — grouped by hue family for the swatch picker.
// Teensyville half-height brocades are excluded; they use a different page size.

export const BROCADE_GROUPS = [
  {
    label: 'Blues',
    items: [
      { id: 'navy-blue',    label: 'Navy Blue',    file: 'navy-blue.png',    color: '#39426d' },
      { id: 'deep-indigo',  label: 'Deep Indigo',  file: 'deep-indigo.png',  color: '#414172' },
      { id: 'steel-blue',   label: 'Steel Blue',   file: 'steel-blue.png',   color: '#4a588f' },
      { id: 'royal-blue',   label: 'Royal Blue',   file: 'royal-blue.png',   color: '#4a5d9f' },
      { id: 'cerulean',     label: 'Cerulean',     file: 'cerulean.png',     color: '#3a73ae' },
    ],
  },
  {
    label: 'Purples',
    items: [
      { id: 'deep-violet',  label: 'Deep Violet',  file: 'deep-violet.png',  color: '#615498' },
      { id: 'purple',       label: 'Purple',       file: 'purple.png',       color: '#85639f' },
      { id: 'violet',       label: 'Violet',       file: 'violet.png',       color: '#765180' },
      { id: 'dark-plum',    label: 'Dark Plum',    file: 'dark-plum.png',    color: '#614e5c' },
    ],
  },
  {
    label: 'Greens & Teals',
    items: [
      { id: 'teal',         label: 'Teal',         file: 'teal.png',         color: '#34909d' },
      { id: 'deep-teal',    label: 'Deep Teal',    file: 'deep-teal.png',    color: '#356a60' },
      { id: 'jade',         label: 'Jade',         file: 'jade.png',         color: '#3f8f6f' },
      { id: 'forest-green', label: 'Forest Green', file: 'forest-green.png', color: '#3b8b65' },
      { id: 'emerald',      label: 'Emerald',       file: 'emerald.png',      color: '#308061' },
    ],
  },
  {
    label: 'Neutrals',
    items: [
      { id: 'antique-gold', label: 'Antique Gold', file: 'antique-gold.png', color: '#b8975e' },
      { id: 'warm-grey',    label: 'Warm Grey',    file: 'warm-grey.png',    color: '#736867' },
      { id: 'dusty-pink',   label: 'Dusty Pink',   file: 'dusty-pink.png',   color: '#9a6d6f' },
    ],
  },
  {
    label: 'Warm Tones',
    items: [
      { id: 'rust',         label: 'Rust',         file: 'rust.png',         color: '#985e47' },
      { id: 'burnt-amber',  label: 'Burnt Amber',  file: 'burnt-amber.png',  color: '#ab674b' },
      { id: 'warm-peach',   label: 'Warm Peach',   file: 'warm-peach.png',   color: '#c99272' },
    ],
  },
  {
    label: 'Pinks & Reds',
    items: [
      { id: 'burgundy',     label: 'Burgundy',     file: 'burgundy.png',     color: '#88494a' },
      { id: 'wine',         label: 'Wine',         file: 'wine.png',         color: '#8e4769' },
      { id: 'crimson',      label: 'Crimson',      file: 'crimson.png',      color: '#9e5d63' },
      { id: 'dusty-rose',   label: 'Dusty Rose',   file: 'dusty-rose.png',   color: '#955963' },
      { id: 'coral',        label: 'Coral',        file: 'coral.png',        color: '#dd887e' },
      { id: 'rose-pink',    label: 'Rose Pink',    file: 'rose-pink.png',    color: '#dc8591' },
      { id: 'lilac',        label: 'Lilac',        file: 'lilac.png',        color: '#c08fb4' },
    ],
  },
];

export const BROCADES = BROCADE_GROUPS.flatMap(g => g.items);
export const DEFAULT_BROCADE = 'navy-blue';
