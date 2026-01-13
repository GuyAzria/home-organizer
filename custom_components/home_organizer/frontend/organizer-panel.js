// Home Organizer Ultimate - Ver 4.16.1 (Expanded Icon Libraries & Tabs)
// License: MIT

const ICONS = {
  arrow_up: '<svg viewBox="0 0 24 24"><path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm6 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>',
  item: '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z"/></svg>',
  delete: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5 .5-.5 .5 .22 .5 .5-.22 .5-.5 .5z"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>',
  minus: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
  image: '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24"><path d="M9 9l1.5-4 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5zM19 19l-2.5-1 2.5-1 1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
  wand: '<svg viewBox="0 0 24 24"><path d="M7.5 5.6L10 7 7.5 8.4 6.1 10.9 4.7 8.4 2.2 7 4.7 5.6 6.1 3.1 7.5 5.6zm12 9.8L17 14l2.5-1.4L18.1 10.1 19.5 12.6 22 14 19.5 15.4 18.1 17.9 17 15.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-8.8 11.2l-1.4-2.5L10.4 13.2 8 14.6 10.4 16 11.8 18.5 13.2 16 15.6 14.6 13.2 13.2z"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>',
  chevron_right: '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
  chevron_down: '<svg viewBox="0 0 24 24"><path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>'
};

const ICON_LIB_ROOM = {
    "Living Room": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 14l-4-4 1.41-1.41L11 13.17V7h2v6.17l2.59-2.58L17 12l-6 6z"/></svg>',
    "Attic": '<svg viewBox="0 0 24 24"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm0 2.5L17.5 11H16v8h-2v-6H10v6H8v-8H6.5L12 5.5z"/></svg>',
    "Kids Room 1": '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-8-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm6 10H6v-6h12v6z"/></svg>',
    "Kids Room 2": '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V8h2v4zm4 4h-2v-2h2v2zm0-4h-2V8h2v4z"/></svg>',
    "Kids Room 3": '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm4 0h-2v-2h2v2zm0-4h-6v-2h6v2zm0-4h-6V7h6v2z"/></svg>',
    "Kitchen": '<svg viewBox="0 0 24 24"><path d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 12.99l1.47-1.46z"/></svg>',
    "Working Room": '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 8h-4v-2h4v2zm2-4H8V8h8v2z"/></svg>',
    "Bedroom": '<svg viewBox="0 0 24 24"><path d="M20 10V7c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2v5h1.33L4 19h1l.67-2h12.67l.66 2h1l.67-2H22v-5c0-1.1-.9-2-2-2zm-9 0H6V7h5v3zm7 0h-5V7h5v3z"/></svg>',
    "Bathroom": '<svg viewBox="0 0 24 24"><path d="M20 13V4.83C20 3.27 18.73 2 17.17 2c-.75 0-1.47.3-2 .83l-3.52 3.52c-.63-.63-1.66-.63-2.29 0l-.32.32c-.63.63-.63 1.66 0 2.29l.32.32c.63.63 1.66.63 2.29 0l3.52-3.52c.53-.53 1.25-.83 2-.83 1.56 0 2.83 1.27 2.83 2.83V13h-9.9l-2.6 2.6L12 20.08l4.08-4.08H20zM3 13c0 2.21 1.79 4 4 4h6l-6-6H3z"/></svg>',
    "Dining": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 14H4v-2h8v2zm0-4H4V8h8v4zm6 4h-4v-2h4v2zm0-4h-4V8h4v4z"/></svg>',
    "Garage": '<svg viewBox="0 0 24 24"><path d="M19 5H5c-1.1 0-2 .9-2 2v12h2v-2h14v2h2V7c0-1.1-.9-2-2-2zm-2 9H7v-2h10v2zm0-4H7V8h10v2z"/></svg>',
    "Garden": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Basement": '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 8H6v-2h8v2zm4-4H6V8h12v2z"/></svg>',
    "Laundry": '<svg viewBox="0 0 24 24"><path d="M16 4H8C6.9 4 6 4.9 6 6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-4 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4-3H8V6h8v1z"/></svg>',
    "Hallway": '<svg viewBox="0 0 24 24"><path d="M18 4H6v16h12V4zm-2 14H8V6h8v12z"/></svg>',
    "Balcony": '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    "Entrance": '<svg viewBox="0 0 24 24"><path d="M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-8-6h2v2h-2v-2z"/></svg>',
    "Guest Room": '<svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-4H6V8h12v4z"/></svg>',
    "Gym": '<svg viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22 14.86 20.57 16.29 22 18.43 19.86 19.86 21.29 21.29 19.86l-1.43-1.43 1.43-1.43L19.86 15.57z"/></svg>',
    "Library": '<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>',
    "Media Room": '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/></svg>',
    "Pantry": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v10H4v4h16v-4h-3V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v2h-6V7zm10 12H5v-2h14v2zm-2-4H7V7h10v8z"/></svg>',
    "Playroom": '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5 7h-2v2h-2v-2H9v-2h2V9h2v2h2v2z"/></svg>',
    "Sunroom": '<svg viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zM2 12c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12zm2 0c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8-8 3.58-8 8z"/></svg>',
    "Toilet": '<svg viewBox="0 0 24 24"><path d="M9 22h6v-2H9v2zm3-12c-3.31 0-6 2.69-6 6h12c0-3.31-2.69-6-6-6zm0-8C9.79 2 8 3.79 8 6s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"/></svg>',
    "Workshop": '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    "Staircase": '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H5v-4h5v-4h5V5h4v12h-5z"/></svg>',
    "Roof": '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    "Patio": '<svg viewBox="0 0 24 24"><path d="M12 2L2 12h2v8h16v-8h2L12 2zm0 4l6 6H6l6-6zm4 12H8v-6h8v6z"/></svg>',
    "Nursery": '<svg viewBox="0 0 24 24"><path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5 7h-2v2h-2v-2H9v-2h2V9h2v2h2v2z"/></svg>',
    "Mudroom": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-4h16V4H4v2z"/></svg>',
    "Man Cave": '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14H5v-2h7v2zm0-4H5v-2h7v2zm7 4h-5v-6h5v6zm0-8H5V5h14v4z"/></svg>',
    "Lounge": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-3c0-1.1-.9-2-2-2h-3.5C12.5 13 11 11.5 11 9.5V6H8v3.5c0 2 1.5 3.5 3.5 3.5H15v2H5v-2h1c.55 0 1-.45 1-1V9c0-1.1-.9-2-2-2H3v10c0 .55.45 1 1 1z"/></svg>',
    "Loft": '<svg viewBox="0 0 24 24"><path d="M12 3L2 12h3v8h14v-8h3L12 3zm0 2.5L17.5 11H6.5L12 5.5zM10 16v-4h4v4h-4z"/></svg>',
    "Home Theater": '<svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/></svg>',
    "Greenhouse": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Foyer": '<svg viewBox="0 0 24 24"><path d="M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-8-6h2v2h-2v-2z"/></svg>',
    "Deck": '<svg viewBox="0 0 24 24"><path d="M12 2L2 12h2v8h16v-8h2L12 2zm0 4l6 6H6l6-6zm4 12H8v-6h8v6z"/></svg>',
    "Corridor": '<svg viewBox="0 0 24 24"><path d="M18 4H6v16h12V4zm-2 14H8V6h8v12z"/></svg>',
    "Cellar": '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 8H6v-2h8v2zm4-4H6V8h12v2z"/></svg>'
};

const ICON_LIB_LOCATION = {
    "Fridge": '<svg viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 7H8V4h8v5zm0 11H8v-9h8v9z"/></svg>',
    "Cabinet": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 10H6v-2h6v2zm0-4H6V6h6v2zm6 4h-4v-2h4v2zm0-4h-4V6h4v2z"/></svg>',
    "Kitchen Cabinet": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-4h16V4H4v2z"/></svg>',
    "Drawer": '<svg viewBox="0 0 24 24"><path d="M20 6H4c-1.1 0-2 .9-2 2v11H0v3h24v-3h-2V8c0-1.1-.9-2-2-2zm0 4H4V8h16v2zm0 5H4v-2h16v2z"/></svg>',
    "Shelf": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-4h16V4H4v2z"/></svg>',
    "Box": '<svg viewBox="0 0 24 24"><path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/></svg>',
    "Bag": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Basket": '<svg viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11L12 2zm0 3.84l2.31 3.78H9.69L12 5.84zM4 13h16v8H4v-8zm2 2v4h12v-4H6z"/></svg>',
    "Bin": '<svg viewBox="0 0 24 24"><path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4zM6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"/></svg>',
    "Container": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 18H6V4h12v16z"/></svg>',
    "Cupboard": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 10H6v-2h6v2zm0-4H6V6h6v2zm6 4h-4v-2h4v2zm0-4h-4V6h4v2z"/></svg>',
    "Desk": '<svg viewBox="0 0 24 24"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 8h-4v-2h4v2zm2-4H8V8h8v2z"/></svg>',
    "Freezer": '<svg viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 7H8V4h8v5zm0 11H8v-9h8v9z"/></svg>',
    "Hamper": '<svg viewBox="0 0 24 24"><path d="M4 13h16v8H4v-8zm2 2v4h12v-4H6zM12 2l-5.5 9h11L12 2zm0 3.84l2.31 3.78H9.69L12 5.84z"/></svg>',
    "Hook": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v4h2V7c0-1.66 1.34-3 3-3s3 1.34 3 3v5c0 1.66-1.34 3-3 3H9v2h3c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5z"/></svg>',
    "Jar": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Locker": '<svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 16H8v-2h4v2zm0-4H8v-2h4v2zm0-4H8V8h4v2z"/></svg>',
    "Rack": '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>',
    "Safe": '<svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
    "Suitcase": '<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.11-.89-2-2-2H9c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM9 4h6v2H9V4zm11 15H4V8h16v11z"/></svg>',
    "Table": '<svg viewBox="0 0 24 24"><path d="M22 7H2v2h2v9h2v-9h12v9h2V9h2V7z"/></svg>',
    "Trunk": '<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.11-.89-2-2-2H9c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM9 4h6v2H9V4zm11 15H4V8h16v11z"/></svg>',
    "Wardrobe": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v10H4v4h16v-4h-3V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v2h-6V7zm10 12H5v-2h14v2zm-2-4H7V7h10v8z"/></svg>',
    "Workbench": '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    "Wall Unit": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-4h16V4H4v2z"/></svg>',
    "Vanity": '<svg viewBox="0 0 24 24"><path d="M20 13V4.83C20 3.27 18.73 2 17.17 2c-.75 0-1.47.3-2 .83l-3.52 3.52c-.63-.63-1.66-.63-2.29 0l-.32.32c-.63.63-.63 1.66 0 2.29l.32.32c.63.63 1.66.63 2.29 0l3.52-3.52c.53-.53 1.25-.83 2-.83 1.56 0 2.83 1.27 2.83 2.83V13h-9.9l-2.6 2.6L12 20.08l4.08-4.08H20zM3 13c0 2.21 1.79 4 4 4h6l-6-6H3z"/></svg>',
    "Under Bed": '<svg viewBox="0 0 24 24"><path d="M20 10V7c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v3c-1.1 0-2 .9-2 2v5h1.33L4 19h1l.67-2h12.67l.66 2h1l.67-2H22v-5c0-1.1-.9-2-2-2zm-9 0H6V7h5v3zm7 0h-5V7h5v3z"/></svg>',
    "Tool Box": '<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.11-.89-2-2-2H9c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM9 4h6v2H9V4zm11 15H4V8h16v11z"/></svg>',
    "Storage Unit": '<svg viewBox="0 0 24 24"><path d="M20 18H4v-2h16v2zm0-5H4v-2h16v2zm0-5H4V6h16v2z"/></svg>',
    "Spice Rack": '<svg viewBox="0 0 24 24"><path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"/></svg>',
    "Sink": '<svg viewBox="0 0 24 24"><path d="M20 13V4.83C20 3.27 18.73 2 17.17 2c-.75 0-1.47.3-2 .83l-3.52 3.52c-.63-.63-1.66-.63-2.29 0l-.32.32c-.63.63-.63 1.66 0 2.29l.32.32c.63.63 1.66.63 2.29 0l3.52-3.52c.53-.53 1.25-.83 2-.83 1.56 0 2.83 1.27 2.83 2.83V13h-9.9l-2.6 2.6L12 20.08l4.08-4.08H20zM3 13c0 2.21 1.79 4 4 4h6l-6-6H3z"/></svg>',
    "Pantry Shelf": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v10H4v4h16v-4h-3V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v2h-6V7zm10 12H5v-2h14v2zm-2-4H7V7h10v8z"/></svg>',
    "Medicine Cabinet": '<svg viewBox="0 0 24 24"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-4c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/></svg>',
    "Makeup Organizer": '<svg viewBox="0 0 24 24"><path d="M20 6H4c-1.1 0-2 .9-2 2v11H0v3h24v-3h-2V8c0-1.1-.9-2-2-2zm0 4H4V8h16v2zm0 5H4v-2h16v2z"/></svg>',
    "Jewelry Box": '<svg viewBox="0 0 24 24"><path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/></svg>',
    "Filing Cabinet": '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 10H6v-2h6v2zm0-4H6V6h6v2zm6 4h-4v-2h4v2zm0-4h-4V6h4v2z"/></svg>',
    "Display Case": '<svg viewBox="0 0 24 24"><path d="M4 18h16v-2H4v2zm0-4h16v-2H4v2zm0-4h16V8H4v2zm0-4h16V4H4v2z"/></svg>',
    "Countertop": '<svg viewBox="0 0 24 24"><path d="M22 7H2v2h2v9h2v-9h12v9h2V9h2V7z"/></svg>',
    "Cart": '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    "Bookcase": '<svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>'
};

const ICON_LIB_ITEM = {
    "Milk": '<svg viewBox="0 0 24 24"><path d="M18 2h-8L7 5v17h10V5L18 2zm-4 10h-2V8h2v4z"/></svg>',
    "Flour": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Perfume": '<svg viewBox="0 0 24 24"><path d="M12 8c2.21 0 4 1.79 4 4v7h-8v-7c0-2.21 1.79-4 4-4zm0-2c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>',
    "Cream": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Apple": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Bread": '<svg viewBox="0 0 24 24"><path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/></svg>',
    "Butter": '<svg viewBox="0 0 24 24"><path d="M21 4H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 14H5V6h14v12z"/></svg>',
    "Cake": '<svg viewBox="0 0 24 24"><path d="M12 6c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-9 14v2h18v-2H3zm16-4c.55 0 1 .45 1 1v1H4v-1c0-.55.45-1 1-1h14z"/></svg>',
    "Cheese": '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>',
    "Chicken": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Coffee": '<svg viewBox="0 0 24 24"><path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 8h-2V5h2v3zm0-5h-2v1h2V3z"/></svg>',
    "Egg": '<svg viewBox="0 0 24 24"><path d="M12 2C8.69 2 6 4.69 6 8v6c0 3.31 2.69 6 6 6s6-2.69 6-6V8c0-3.31-2.69-6-6-6z"/></svg>',
    "Fish": '<svg viewBox="0 0 24 24"><path d="M21 3c-1.1 0-2 .9-2 2v2c-2.21 0-4 1.79-4 4v3c0 2.21 1.79 4 4 4v2c0 1.1.9 2 2 2h1V3h-1zM5 3c-1.1 0-2 .9-2 2v2c-2.21 0-4 1.79-4 4v3c0 2.21 1.79 4 4 4v2c0 1.1.9 2 2 2h1V3H5z"/></svg>',
    "Fruit": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Meat": '<svg viewBox="0 0 24 24"><path d="M21 3c-1.1 0-2 .9-2 2v2c-2.21 0-4 1.79-4 4v3c0 2.21 1.79 4 4 4v2c0 1.1.9 2 2 2h1V3h-1zM5 3c-1.1 0-2 .9-2 2v2c-2.21 0-4 1.79-4 4v3c0 2.21 1.79 4 4 4v2c0 1.1.9 2 2 2h1V3H5z"/></svg>',
    "Oil": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Pasta": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Rice": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Salt": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Sugar": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Tea": '<svg viewBox="0 0 24 24"><path d="M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 8h-2V5h2v3zm0-5h-2v1h2V3z"/></svg>',
    "Vegetable": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Water": '<svg viewBox="0 0 24 24"><path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm1-11h-2v3H8v2h3v3h2v-3h3v-2h-3V7z"/></svg>',
    "Wine": '<svg viewBox="0 0 24 24"><path d="M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm10 5H8V5h8v3z"/></svg>',
    "Soap": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Shampoo": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Toothpaste": '<svg viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 7H8V4h8v5zm0 11H8v-9h8v9z"/></svg>',
    "Towel": '<svg viewBox="0 0 24 24"><path d="M19 6h-3c0-2.21-1.79-4-4-4S8 3.79 8 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm5 14H7V8h10v10z"/></svg>',
    "Battery": '<svg viewBox="0 0 24 24"><path d="M16 6h-1V4h-6v2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4z"/></svg>',
    "Bulb": '<svg viewBox="0 0 24 24"><path d="M12 2C7.03 2 3 6.03 3 11c0 3.31 1.69 6.24 4.28 8h9.44C19.31 17.24 21 14.31 21 11c0-4.97-4.03-9-9-9zm-1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>',
    "Cable": '<svg viewBox="0 0 24 24"><path d="M20 6h-3V4c0-1.11-.89-2-2-2H9c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zM9 4h6v2H9V4zm11 15H4V8h16v11z"/></svg>',
    "Charger": '<svg viewBox="0 0 24 24"><path d="M16 6h-1V4h-6v2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4z"/></svg>',
    "Drill": '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    "Hammer": '<svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    "Nail": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v10H4v4h16v-4h-3V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v2h-6V7zm10 12H5v-2h14v2zm-2-4H7V7h10v8z"/></svg>',
    "Paint": '<svg viewBox="0 0 24 24"><path d="M18 4h-1V2h-2v2H9V2H7v2H6c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H6V6h12v14z"/></svg>',
    "Paper": '<svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>',
    "Pen": '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>',
    "Phone": '<svg viewBox="0 0 24 24"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/></svg>',
    "Tape": '<svg viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v10H4v4h16v-4h-3V7c0-2.76-2.24-5-5-5zm-3 5c0-1.66 1.34-3 3-3s3 1.34 3 3v2h-6V7zm10 12H5v-2h14v2zm-2-4H7V7h10v8z"/></svg>'
};

class HomeOrganizerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.content) {
      this.currentPath = [];
      this.isEditMode = false;
      this.isSearch = false;
      this.isShopMode = false;
      this.expandedIdx = null;
      this.lastAI = "";
      this.localData = null; 
      this.pendingItem = null;
      this.useAiBg = true; 
      this.shopQuantities = {};
      this.expandedSublocs = new Set(); 
      this.subscribed = false;

      this.initUI();
    }

    if (this._hass && this._hass.connection && !this.subscribed) {
        this.subscribed = true;
        this._hass.connection.subscribeEvents((e) => this.fetchData(), 'home_organizer_db_update');
        this._hass.connection.subscribeEvents((e) => {
             if (e.data.mode === 'identify') { }
        }, 'home_organizer_ai_result');
        this.fetchData();
    }
  }

  async fetchData() {
      if (!this._hass) return;
      try {
          const data = await this._hass.callWS({
              type: 'home_organizer/get_data',
              path: this.currentPath,
              search_query: this.shadowRoot.getElementById('search-input')?.value || "",
              date_filter: "All",
              shopping_mode: this.isShopMode
          });
          this.localData = data;
          this.updateUI();
      } catch (e) {
          console.error("Fetch error", e);
      }
  }

  initUI() {
    this.content = true;
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        :host { --app-bg: #1c1c1e; --primary: #03a9f4; --accent: #4caf50; --danger: #f44336; --text: #fff; --border: #333; --warning: #ffeb3b; --icon-btn-bg: #444; }
        * { box-sizing: border-box; }
        .app-container { background: var(--app-bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; font-family: sans-serif; direction: rtl; }
        svg { width: 24px; height: 24px; fill: currentColor; }
        .top-bar { background: #242426; padding: 10px; border-bottom: 1px solid var(--border); display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-shrink: 0; height: 60px; }
        .nav-btn { background: none; border: none; color: var(--primary); cursor: pointer; padding: 8px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .nav-btn:hover { background: rgba(255,255,255,0.1); }
        .nav-btn.active { color: var(--warning); }
        .nav-btn.edit-active { color: var(--accent); } 
        .title-box { flex: 1; text-align: center; }
        .main-title { font-weight: bold; font-size: 16px; }
        .sub-title { font-size: 11px; color: #aaa; direction: ltr; }
        .content { flex: 1; padding: 15px; overflow-y: auto; }
        
        .folder-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 15px; padding: 5px; margin-bottom: 20px; }
        .folder-item { display: flex; flex-direction: column; align-items: center; cursor: pointer; text-align: center; position: relative; }
        .android-folder-icon { width: 56px; height: 56px; background: #3c4043; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #8ab4f8; margin-bottom: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); position: relative; overflow: visible; }
        
        .folder-delete-btn { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn { position: absolute; top: -5px; left: -5px; background: var(--primary); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-edit-btn svg { width: 12px; height: 12px; }
        .folder-img-btn { position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); background: #ff9800; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 10; }
        .folder-img-btn svg { width: 12px; height: 12px; }

        .item-list { display: flex; flex-direction: column; gap: 5px; }
        
        .group-separator { 
            color: #aaa; font-size: 14px; margin: 20px 0 10px 0; 
            border-bottom: 1px solid #444; padding-bottom: 4px; 
            text-transform: uppercase; font-weight: bold; 
            display: flex; justify-content: space-between; align-items: center;
            min-height: 35px;
            cursor: pointer; 
        }
        .group-separator:hover { background: rgba(255,255,255,0.05); }
        .group-separator.drag-over { border-bottom: 2px solid var(--primary); color: var(--primary); background: rgba(3, 169, 244, 0.1); }
        .oos-separator { color: var(--danger); border-color: var(--danger); }
        
        .edit-subloc-btn { background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; }
        .edit-subloc-btn:hover { color: var(--primary); }
        .delete-subloc-btn { background: none; border: none; color: var(--danger); cursor: pointer; padding: 4px; }

        .item-row { background: #2c2c2e; margin-bottom: 8px; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; border: 1px solid transparent; touch-action: pan-y; }
        .item-row.expanded { background: #3a3a3c; flex-direction: column; align-items: stretch; cursor: default; }
        .out-of-stock-frame { border: 2px solid var(--danger); }

        .item-main { display: flex; align-items: center; justify-content: space-between; width: 100%; cursor: pointer; }
        .item-left { display: flex; align-items: center; gap: 10px; }
        .item-icon { color: var(--primary); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; }
        .item-thumbnail { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: #fff; display: block; border: 1px solid #444; }

        .item-qty-ctrl { display: flex; align-items: center; gap: 10px; background: #222; padding: 4px; border-radius: 20px; }
        .qty-btn { background: #444; border: none; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        
        .add-folder-card .android-folder-icon { border: 2px dashed #4caf50; background: rgba(76, 175, 80, 0.1); color: #4caf50; }
        .add-folder-card:hover .android-folder-icon { background: rgba(76, 175, 80, 0.2); }
        .add-folder-input { width: 100%; height: 100%; border: none; background: transparent; color: white; text-align: center; font-size: 12px; padding: 5px; outline: none; }
        
        .text-add-btn { background: none; border: none; color: var(--primary); font-size: 14px; font-weight: bold; cursor: pointer; padding: 8px 0; display: flex; align-items: center; gap: 5px; opacity: 0.8; }
        .text-add-btn:hover { opacity: 1; text-decoration: underline; }
        .group-add-row { padding: 0 10px; margin-bottom: 15px; }

        .add-item-btn-row { width: 100%; margin-top: 10px; }
        .add-item-btn { width: 100%; padding: 12px; background: rgba(76, 175, 80, 0.15); border: 1px dashed #4caf50; color: #4caf50; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; transition: background 0.2s; }
        .add-item-btn:hover { background: rgba(76, 175, 80, 0.3); }

        .expanded-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid #555; display: flex; flex-direction: column; gap: 10px; }
        .detail-row { display: flex; gap: 10px; align-items: center; }
        
        .action-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid #555; color: #ccc; background: var(--icon-btn-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 8px; }
        .action-btn:hover { background: #555; color: white; }
        .btn-danger { color: #ff8a80; border-color: #d32f2f; }
        .btn-text { width: auto; padding: 0 15px; font-weight: bold; color: white; background: var(--primary); border: none; }
        .move-container { display: flex; gap: 5px; align-items: center; flex: 1; }
        .move-select { flex: 1; padding: 8px; background: #222; color: white; border: 1px solid #555; border-radius: 6px; }
        .search-box { display:none; padding:10px; background:#2a2a2a; display:flex; gap: 5px; align-items: center; }
        
        /* Modal for Icons */
        #icon-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2500; display: none; align-items: center; justify-content: center; flex-direction: column; }
        .modal-content { background: #242426; width: 90%; max-width: 400px; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 80vh; overflow-y: auto; }
        .modal-title { font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 10px; }
        
        /* Modal Tabs */
        .icon-tabs { display: flex; width: 100%; border-bottom: 1px solid #444; margin-bottom: 10px; }
        .tab-btn { flex: 1; padding: 10px; background: none; border: none; color: #888; cursor: pointer; font-weight: bold; border-bottom: 2px solid transparent; }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); }
        .tab-btn:hover { color: #ccc; }

        .icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; }
        .lib-icon { background: #333; border-radius: 8px; padding: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 5px; }
        .lib-icon:hover { background: #444; }
        .lib-icon svg { width: 30px; height: 30px; fill: #ccc; } /* Updated Size: 30px */
        .lib-icon span { font-size: 10px; color: #888; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; }
        
        .url-input-row { display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; }
        
        /* CAMERA OVERLAY STYLES */
        #camera-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; z-index: 2000; display: none; flex-direction: column; align-items: center; justify-content: center; }
        #camera-video { width: 100%; height: 80%; object-fit: cover; }
        .camera-controls { height: 20%; width: 100%; display: flex; align-items: center; justify-content: center; gap: 30px; background: rgba(0,0,0,0.5); position: absolute; bottom: 0; }
        .snap-btn { width: 70px; height: 70px; border-radius: 50%; background: white; border: 5px solid #ccc; cursor: pointer; }
        .snap-btn.white-bg-active { background: #e3f2fd; border-color: var(--primary); }
        .close-cam-btn { color: white; background: none; border: none; font-size: 16px; cursor: pointer; }
        .wb-btn { color: #aaa; background: none; border: 2px solid #555; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-direction: column; font-size: 10px; }
        .wb-btn.active { color: #333; background: white; border-color: white; }
        .wb-btn svg { width: 24px; height: 24px; margin-bottom: 2px; }
        #camera-canvas { display: none; }
        .direct-input-label { width: 40px; height: 40px; background: var(--icon-btn-bg); border-radius: 8px; border: 1px solid #555; display: flex; align-items: center; justify-content: center; position: relative; cursor: pointer; color: #ccc; }
        .hidden-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 10; }
      </style>
      
      <!-- MAIN APP UI -->
      <div class="app-container" id="app">
         <div class="top-bar">
            <div style="display:flex;gap:5px">
                <button class="nav-btn" id="btn-up">${ICONS.arrow_up}</button>
                <button class="nav-btn" id="btn-home">${ICONS.home}</button>
            </div>
            <div class="title-box">
                <div class="main-title" id="display-title">Organizer</div>
                <div class="sub-title" id="display-path">Main</div>
            </div>
            <div style="display:flex;gap:5px">
                <button class="nav-btn" id="btn-shop">${ICONS.cart}</button>
                <button class="nav-btn" id="btn-search">${ICONS.search}</button>
                <button class="nav-btn" id="btn-edit">${ICONS.edit}</button>
            </div>
        </div>
        
        <div class="search-box" id="search-box">
            <div style="position:relative; flex:1;">
                <input type="text" id="search-input" style="width:100%;padding:8px;padding-left:35px;border-radius:8px;background:#111;color:white;border:1px solid #333">
                <button class="nav-btn ai-btn" id="btn-ai-search" style="position:absolute;left:0;top:0;height:100%;background:none;border:none;">
                   ${ICONS.camera}
                </button>
            </div>
            <button class="nav-btn" id="search-close">${ICONS.close}</button>
        </div>
        
        <div class="paste-bar" id="paste-bar" style="display:none;padding:10px;background:rgba(255,235,59,0.2);color:#ffeb3b;align-items:center;justify-content:space-between"><div>${ICONS.cut} Cut: <b id="clipboard-name"></b></div><button id="btn-paste" style="background:#4caf50;color:white;border:none;padding:5px 15px;border-radius:15px">Paste</button></div>
        
        <div class="content" id="content">
            <div style="text-align:center;padding:20px;color:#888;">Loading...</div>
        </div>
      </div>
      
      <!-- ICON PICKER MODAL -->
      <div id="icon-modal" onclick="this.style.display='none'">
          <div class="modal-content" onclick="event.stopPropagation()">
              <div class="modal-title">Change Icon</div>
              
              <!-- Tabs -->
              <div class="icon-tabs" id="icon-tabs"></div>
              
              <div class="icon-grid" id="icon-lib-grid"></div>
              
              <div class="url-input-row">
                  <input type="text" id="icon-url-input" placeholder="Paste Image URL..." style="flex:1;padding:8px;background:#111;color:white;border:1px solid #444;border-radius:4px">
                  <button class="action-btn" id="btn-load-url">${ICONS.check}</button>
              </div>
              
              <div style="text-align:center; margin-top:10px;">
                  <label class="action-btn" style="width:100%; display:flex; gap:10px; justify-content:center;">
                      ${ICONS.image} Upload File
                      <input type="file" id="icon-file-upload" accept="image/*" style="display:none">
                  </label>
              </div>
              <button class="action-btn" style="width:100%;margin-top:10px;background:#444" onclick="this.closest('#icon-modal').style.display='none'">Cancel</button>
          </div>
      </div>
      
      <!-- CUSTOM IN-APP CAMERA OVERLAY -->
      <div id="camera-modal">
          <video id="camera-video" autoplay playsinline muted></video>
          <div class="camera-controls">
              <button class="close-cam-btn" id="btn-cam-switch">${ICONS.refresh}</button>
              <button class="snap-btn" id="btn-cam-snap"></button>
              <button class="wb-btn active" id="btn-cam-wb" title="Toggle AI Background Removal">${ICONS.wand}<span>AI BG</span></button>
              <button class="close-cam-btn" id="btn-cam-close" style="position:absolute;top:-50px;right:20px;background:rgba(0,0,0,0.5);border-radius:50%;width:40px;height:40px">✕</button>
          </div>
          <canvas id="camera-canvas"></canvas>
      </div>

      <div class="overlay" id="img-overlay" onclick="this.style.display='none'" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:200;justify-content:center;align-items:center"><img id="overlay-img" style="max-width:90%;max-height:90%;border-radius:8px"></div>
    `;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
         console.warn("Camera access requires HTTPS.");
    }

    this.bindEvents();
  }

  bindEvents() {
    const root = this.shadowRoot;
    const bind = (id, event, fn) => { const el = root.getElementById(id); if(el) el[event] = fn; };
    const click = (id, fn) => bind(id, 'onclick', fn);

    click('btn-up', () => this.navigate('up'));
    click('btn-home', () => { this.isShopMode = false; this.isSearch = false; this.navigate('root'); });
    click('btn-shop', () => { this.isShopMode = !this.isShopMode; if(this.isShopMode) { this.isSearch=false; this.isEditMode=false; } this.fetchData(); });
    click('btn-search', () => { this.isSearch = true; this.isShopMode = false; this.render(); });
    click('search-close', () => { this.isSearch = false; this.fetchData(); });
    bind('search-input', 'oninput', (e) => this.fetchData());
    click('btn-edit', () => { this.isEditMode = !this.isEditMode; this.isShopMode = false; this.render(); });
    
    click('btn-paste', () => this.pasteItem());
    
    // Icon Modal Bindings
    click('btn-load-url', () => {
        const url = root.getElementById('icon-url-input').value;
        if(url) this.handleUrlIcon(url);
    });
    bind('icon-file-upload', 'onchange', (e) => this.handleIconUpload(e.target));
    
    // Camera
    click('btn-ai-search', () => this.openCamera('search'));

    click('btn-cam-close', () => this.stopCamera());
    click('btn-cam-snap', () => this.snapPhoto());
    click('btn-cam-switch', () => this.switchCamera());
    click('btn-cam-wb', () => this.toggleWhiteBG());
  }
  
  toggleWhiteBG() {
      this.useAiBg = !this.useAiBg;
      const btn = this.shadowRoot.getElementById('btn-cam-wb');
      if (this.useAiBg) btn.classList.add('active'); else btn.classList.remove('active');
  }

  async openCamera(context) {
      this.cameraContext = context;
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      modal.style.display = 'flex';
      try {
          this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facingMode || "environment" } });
          video.srcObject = this.stream;
      } catch (err) {
          alert("Camera Error: " + err.message);
          modal.style.display = 'none';
      }
  }

  stopCamera() {
      const modal = this.shadowRoot.getElementById('camera-modal');
      const video = this.shadowRoot.getElementById('camera-video');
      if (this.stream) this.stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
      modal.style.display = 'none';
  }

  async switchCamera() {
      this.facingMode = (this.facingMode === "user") ? "environment" : "user";
      this.stopCamera();
      setTimeout(() => this.openCamera(this.cameraContext), 200);
  }

  snapPhoto() {
      const video = this.shadowRoot.getElementById('camera-video');
      const canvas = this.shadowRoot.getElementById('camera-canvas');
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      if (this.useAiBg) {
          let imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          let data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
              let r = data[i], g = data[i+1], b = data[i+2];
              if (r > 190 && g > 190 && b > 190) { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
          }
          context.putImageData(imageData, 0, 0);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      this.stopCamera();
      
      if (this.cameraContext === 'search') {
          this.callHA('ai_action', { mode: 'search', image_data: dataUrl });
      } else if (this.pendingItem) {
          this.callHA('update_image', { item_name: this.pendingItem, image_data: dataUrl });
          this.pendingItem = null;
      } else {
          this.tempAddImage = dataUrl;
      }
  }

  updateUI() {
    if(!this.localData) return;
    const attrs = this.localData;
    const root = this.shadowRoot;
    
    root.getElementById('display-title').innerText = attrs.path_display;
    
    root.getElementById('search-box').style.display = this.isSearch ? 'flex' : 'none';
    root.getElementById('paste-bar').style.display = attrs.clipboard ? 'flex' : 'none';
    if(attrs.clipboard) root.getElementById('clipboard-name').innerText = attrs.clipboard;
    const app = root.getElementById('app');
    if(this.isEditMode) {
        app.classList.add('edit-mode'); 
    } else {
        app.classList.remove('edit-mode');
    }
    
    // Toggle edit button color
    const editBtn = root.getElementById('btn-edit');
    if (editBtn) {
        if (this.isEditMode) editBtn.classList.add('edit-active');
        else editBtn.classList.remove('edit-active');
    }

    const content = root.getElementById('content');
    content.innerHTML = '';

    if (attrs.shopping_list && attrs.shopping_list.length > 0) {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        const grouped = {};
        attrs.shopping_list.forEach(item => {
            const loc = item.main_location || "Other";
            if(!grouped[loc]) grouped[loc] = [];
            grouped[loc].push(item);
        });
        Object.keys(grouped).sort().forEach(locName => {
            const header = document.createElement('div');
            header.className = 'group-separator';
            header.innerText = locName;
            listContainer.appendChild(header);
            grouped[locName].forEach(item => listContainer.appendChild(this.createItemRow(item, true)));
        });
        content.appendChild(listContainer);
        return;
    }

    if ((this.isSearch || (attrs.path_display && attrs.path_display.startsWith('Search'))) && attrs.items) {
        const list = document.createElement('div');
        list.className = 'item-list';
        attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
        content.appendChild(list);
        return;
    }

    // FOLDER VIEW / LOCATION VIEW
    if (attrs.depth < 2) {
        if (attrs.folders && attrs.folders.length > 0 || this.isEditMode) {
            const grid = document.createElement('div');
            grid.className = 'folder-grid';
            
            // Render existing folders
            if (attrs.folders) {
                attrs.folders.forEach(folder => {
                    const el = document.createElement('div');
                    el.className = 'folder-item';
                    
                    el.onclick = () => this.navigate('down', folder.name);
                    
                    // Folder content: Image or Icon
                    let folderContent = ICONS.folder;
                    if (folder.img) {
                        folderContent = `<img src="${folder.img}" style="width:100%;height:100%;object-fit:cover;border-radius:16px">`;
                    }

                    const deleteBtnHtml = this.isEditMode 
                        ? `<div class="folder-delete-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteFolder('${folder.name}')">✕</div>` 
                        : '';
                    
                    const editBtnHtml = this.isEditMode 
                        ? `<div class="folder-edit-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableFolderRename(this.closest('.folder-item').querySelector('.folder-label'), '${folder.name}')">${ICONS.edit}</div>` 
                        : '';
                    
                    // NEW: Icon/Image Change Button
                    const imgBtnHtml = this.isEditMode
                        ? `<div class="folder-img-btn" onclick="event.stopPropagation(); this.getRootNode().host.openIconPicker('${folder.name}')">${ICONS.image}</div>`
                        : '';

                    el.innerHTML = `
                        <div class="android-folder-icon">
                            ${folderContent}
                            ${editBtnHtml}
                            ${deleteBtnHtml}
                            ${imgBtnHtml}
                        </div>
                        <div class="folder-label">${folder.name}</div>
                    `;
                    grid.appendChild(el);
                });
            }

            // Render "Add Room/Location" button if Edit Mode is ON
            if (this.isEditMode) {
                const addBtn = document.createElement('div');
                addBtn.className = 'folder-item add-folder-card';
                addBtn.innerHTML = `
                    <div class="android-folder-icon" id="add-folder-icon">
                        ${ICONS.plus}
                    </div>
                    <div class="folder-label">Add</div>
                `;
                addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget);
                grid.appendChild(addBtn);
            }

            content.appendChild(grid);
        }
        
        if (attrs.items && attrs.items.length > 0) {
            const list = document.createElement('div');
            list.className = 'item-list';
            attrs.items.forEach(item => list.appendChild(this.createItemRow(item, false)));
            content.appendChild(list);
        }
        
        // Render "Add Item" button if Edit Mode is ON (Under list in depth < 2)
        if (this.isEditMode && attrs.depth === 1) {
             const addBtn = document.createElement('div');
             addBtn.className = 'add-item-btn-row';
             addBtn.innerHTML = `<button class="add-item-btn" onclick="this.getRootNode().host.addQuickItem()">+ הוסף</button>`;
             content.appendChild(addBtn);
        }
    } 
    // SUBLOCATION/ITEM GROUPED VIEW
    else {
        const listContainer = document.createElement('div');
        listContainer.className = 'item-list';
        
        const inStock = [], outOfStock = [];
        if (attrs.items) attrs.items.forEach(item => (item.qty === 0 ? outOfStock : inStock).push(item));

        const grouped = {};
        if (attrs.folders) attrs.folders.forEach(f => grouped[f.name] = []);
        if (!grouped["General"]) grouped["General"] = [];

        inStock.forEach(item => {
            const sub = item.sub_location || "General";
            if(!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(item);
        });

        Object.keys(grouped).sort().forEach(subName => {
            if (subName === "General" && grouped[subName].length === 0 && !this.isEditMode) return;

            const isExpanded = this.expandedSublocs.has(subName);
            const count = grouped[subName].length;
            const icon = isExpanded ? ICONS.chevron_down : ICONS.chevron_right;
            const countBadge = `<span style="font-size:12px; background:#444; padding:2px 6px; border-radius:10px; margin-left:8px;">${count}</span>`;

            const header = document.createElement('div');
            header.className = 'group-separator';
            this.setupDropTarget(header, subName);

            // Toggle Expand Logic attached to header
            header.onclick = () => this.toggleSubloc(subName);

            if (this.isEditMode && subName !== "General") {
                header.innerHTML = `
                    <div style="display:flex;align-items:center;">
                        <span style="margin-right:5px;display:flex;align-items:center">${icon}</span>
                        <span class="subloc-title">${subName}</span>
                        ${countBadge}
                    </div>
                    <div style="display:flex;gap:5px">
                        <button class="edit-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.enableSublocRename(this, '${subName}')">${ICONS.edit}</button>
                        <button class="delete-subloc-btn" onclick="event.stopPropagation(); this.getRootNode().host.deleteSubloc('${subName}')">${ICONS.delete}</button>
                    </div>`;
            } else {
                header.innerHTML = `
                    <div style="display:flex;align-items:center;">
                        <span style="margin-right:5px;display:flex;align-items:center">${icon}</span>
                        <span>${subName}</span>
                        ${countBadge}
                    </div>`;
            }
            listContainer.appendChild(header);
            
            // Only render items if expanded
            if (isExpanded) {
                grouped[subName].forEach(item => listContainer.appendChild(this.createItemRow(item, false)));

                // Add Text Button per sublocation group (replacing global bottom button)
                if (this.isEditMode) {
                     const addRow = document.createElement('div');
                     addRow.className = "group-add-row";
                     addRow.innerHTML = `<button class="text-add-btn" onclick="this.getRootNode().host.addQuickItem('${subName}')">${ICONS.plus} הוסף</button>`;
                     listContainer.appendChild(addRow);
                }
            }
        });

        if (outOfStock.length > 0) {
            const oosHeader = document.createElement('div');
            oosHeader.className = 'group-separator oos-separator';
            oosHeader.innerText = "Out of Stock";
            listContainer.appendChild(oosHeader);
            outOfStock.forEach(item => listContainer.appendChild(this.createItemRow(item, false)));
        }
        
        // NEW: Add "Add Sublocation" Square Button at the bottom of the list when in Edit Mode
        if (this.isEditMode) {
            const gridContainer = document.createElement('div');
            gridContainer.className = 'folder-grid';
            gridContainer.style.marginTop = '20px';

            const addBtn = document.createElement('div');
            addBtn.className = 'folder-item add-folder-card';
            addBtn.innerHTML = `
                <div class="android-folder-icon" id="add-subloc-icon">
                    ${ICONS.plus}
                </div>
                <div class="folder-label">Add Sub</div>
            `;
            addBtn.onclick = (e) => this.enableFolderInput(e.currentTarget);
            
            gridContainer.appendChild(addBtn);
            listContainer.appendChild(gridContainer);
        }
        
        content.appendChild(listContainer);
    }
  }
  
  toggleSubloc(name) {
      if (this.expandedSublocs.has(name)) {
          this.expandedSublocs.delete(name);
      } else {
          this.expandedSublocs.add(name);
      }
      this.render();
  }
  
  // Logic to turn the "Add Folder" card into an input
  enableFolderInput(cardEl) {
      const iconContainer = cardEl.querySelector('.android-folder-icon');
      const label = cardEl.querySelector('.folder-label');
      
      // Prevent multiple clicks
      if(iconContainer.querySelector('input')) return;
      
      iconContainer.innerHTML = `<input type="text" class="add-folder-input" placeholder="Name">`;
      const input = iconContainer.querySelector('input');
      label.innerText = "Saving...";
      
      input.focus();
      
      // Save on Enter
      input.onkeydown = (e) => {
          if (e.key === 'Enter') {
              this.saveNewFolder(input.value);
          }
      };
      
      // Save on blur if value exists, else reset
      input.onblur = () => {
          if (input.value.trim()) {
              this.saveNewFolder(input.value);
          } else {
              this.render(); // Reset UI
          }
      };
  }
  
  // Logic for inline renaming of Rooms/Locations (Folders)
  enableFolderRename(labelEl, oldName) {
      if (!labelEl || labelEl.querySelector('input')) return;
      
      const input = document.createElement('input');
      input.value = oldName;
      // styling to match dark theme grid item
      input.style.width = '100%';
      input.style.background = '#222';
      input.style.color = 'white';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.textAlign = 'center';
      input.style.fontSize = '12px';
      input.onclick = (e) => e.stopPropagation();
      
      labelEl.innerHTML = '';
      labelEl.appendChild(input);
      input.focus();
      
      let isSaving = false;
      const save = () => {
          if (isSaving) return; 
          isSaving = true;
          
          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              this.callHA('update_item_details', { 
                  original_name: oldName, 
                  new_name: newVal, 
                  new_date: "",
                  current_path: this.currentPath,
                  is_folder: true
              });
          } else {
              this.render(); 
          }
      };
      
      input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
      input.onblur = () => save();
  }

  saveNewFolder(name) {
      if(!name) return;
      this._hass.callService('home_organizer', 'add_item', { 
          item_name: name, 
          item_type: 'folder', 
          item_date: '', 
          image_data: null, 
          current_path: this.currentPath 
      });
      // UI will refresh via event listener
  }

  // Logic to add an empty item quickly
  addQuickItem(targetSubloc) {
      const tempName = "New Item " + new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
      const today = new Date().toISOString().split('T')[0];
      
      let usePath = [...this.currentPath];
      // If we are adding to a specific sublocation group (and it's not the generic root container 'General')
      if (targetSubloc && targetSubloc !== "General") {
          usePath.push(targetSubloc);
      }

      this._hass.callService('home_organizer', 'add_item', { 
          item_name: tempName, 
          item_type: 'item', 
          item_date: today, 
          image_data: null, 
          current_path: usePath
      });
  }

  setupDragSource(el, itemName) {
      el.draggable = true;
      el.ondragstart = (e) => { e.dataTransfer.setData("text/plain", itemName); e.dataTransfer.effectAllowed = "move"; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');
      // Touch drag omitted for brevity
  }

  setupDropTarget(el, subName) {
      el.dataset.subloc = subName;
      el.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drag-over'); };
      el.ondragleave = () => el.classList.remove('drag-over');
      el.ondrop = (e) => { 
          e.preventDefault(); 
          el.classList.remove('drag-over'); 
          const itemName = e.dataTransfer.getData("text/plain");
          this.handleDropAction(subName, itemName); 
      };
  }

  async handleDropAction(targetSubloc, itemName) {
      if (!itemName) return;
      let targetPath = [...this.currentPath];
      if (targetSubloc !== "General") targetPath.push(targetSubloc);
      try {
          await this.callHA('clipboard_action', {action: 'cut', item_name: itemName});
          await this.callHA('paste_item', {target_path: targetPath});
      } catch (err) { console.error("Drop failed:", err); }
  }

  triggerCameraEdit(itemName) {
      this.pendingItem = itemName;
      this.openCamera('update');
  }
  
  adjustShopQty(name, delta) {
      if (this.shopQuantities[name] === undefined) {
          this.shopQuantities[name] = 0; // Default to 0 as requested
      }
      this.shopQuantities[name] = Math.max(0, this.shopQuantities[name] + delta);
      this.render();
  }

  createItemRow(item, isShopMode) {
     const div = document.createElement('div');
     const oosClass = (item.qty === 0) ? 'out-of-stock-frame' : '';
     div.className = `item-row ${this.expandedIdx === item.name ? 'expanded' : ''} ${oosClass}`;
     this.setupDragSource(div, item.name);
     
     let controls = '';
     if (isShopMode) {
         // Default to 0 if undefined
         const localQty = (this.shopQuantities[item.name] !== undefined) ? this.shopQuantities[item.name] : 0;
         // Disable style if qty is 0
         const checkStyle = (localQty === 0) 
            ? "background:#555;color:#888;cursor:not-allowed;width:40px;height:40px;margin-left:8px;" 
            : "background:var(--accent);width:40px;height:40px;margin-left:8px;";
         const checkDisabled = (localQty === 0) ? "disabled" : "";

         // Changed button logic to update local quantity only, submit via checkmark
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.name}', -1)">${ICONS.minus}</button><span class="qty-val" style="margin:0 8px">${localQty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.adjustShopQty('${item.name}', 1)">${ICONS.plus}</button><button class="qty-btn" style="${checkStyle}" ${checkDisabled} title="Complete" onclick="event.stopPropagation();this.getRootNode().host.submitShopStock('${item.name}')">${ICONS.check}</button>`;
     } else {
         controls = `<button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', 1)">${ICONS.plus}</button><span class="qty-val">${item.qty}</span><button class="qty-btn" onclick="event.stopPropagation();this.getRootNode().host.updateQty('${item.name}', -1)">${ICONS.minus}</button>`;
     }

     const subText = isShopMode ? `${item.main_location} > ${item.sub_location || ''}` : `${item.date || ''}`;
     
     // ITEM ICON UPDATE: Show thumbnail if image exists
     let iconHtml = `<span class="item-icon">${ICONS.item}</span>`;
     if (item.img) {
         iconHtml = `<img src="${item.img}" class="item-thumbnail" alt="${item.name}" onclick="event.stopPropagation(); this.getRootNode().host.showImg('${item.img}')">`;
     }

     div.innerHTML = `
        <div class="item-main" onclick="this.getRootNode().host.toggleRow('${item.name}')">
            <div class="item-left">
                ${iconHtml}
                <div>
                    <div>${item.name}</div>
                    <div class="sub-title">${subText}</div>
                </div>
            </div>
            <div class="item-qty-ctrl">${controls}</div>
        </div>
     `;
     
     if (this.expandedIdx === item.name) {
         const details = document.createElement('div');
         details.className = 'expanded-details';
         
         let dropdownOptions = `<option value="">-- Move to... --</option>`;
         dropdownOptions += `<option value="General">General (Root)</option>`;
         // Location dropdown logic (Level 1)
         let roomOptions = `<option value="">-- Change Room --</option>`;
         if(this.localData.hierarchy) {
             Object.keys(this.localData.hierarchy).forEach(room => {
                 roomOptions += `<option value="${room}">${room}</option>`;
             });
         }
         
         // Sublocation dropdown (Current Room)
         if(this.localData.folders) {
             this.localData.folders.forEach(f => {
                 dropdownOptions += `<option value="${f.name}">${f.name}</option>`;
             });
         }

         details.innerHTML = `
            <div class="detail-row">
                <input type="text" id="name-${item.name}" value="${item.name}" style="flex:1;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <input type="date" id="date-${item.name}" value="${item.date}" style="width:110px;padding:8px;background:#222;color:white;border:1px solid #444;border-radius:4px">
                <button class="action-btn btn-text" onclick="this.getRootNode().host.saveDetails('${item.name}', '${item.name}')">Save</button>
            </div>
            <div class="detail-row" style="justify-content:space-between; margin-top:10px;">
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn" title="Take Photo" onclick="this.getRootNode().host.triggerCameraEdit('${item.name}')">${ICONS.camera}</button>
                    <label class="action-btn" title="Upload Image">
                        ${ICONS.image}
                        <input type="file" accept="image/*" style="display:none" onchange="this.getRootNode().host.handleUpdateImage(this, '${item.name}')">
                    </label>
                 </div>
                 <div style="display:flex;gap:10px;">
                    <button class="action-btn btn-danger" title="Delete" onclick="this.getRootNode().host.del('${item.name}')">${ICONS.delete}</button>
                 </div>
            </div>
            
            <!-- Move Controls -->
            <div class="detail-row" style="margin-top:10px; border-top:1px solid #444; padding-top:10px; flex-direction:column; gap:8px;">
                <div class="move-container" style="width:100%">
                    <span style="font-size:12px;color:#aaa;width:60px">Move to:</span>
                    <select class="move-select" id="room-select-${item.name}" onchange="this.getRootNode().host.updateLocationDropdown('${item.name}', this.value)">
                        ${roomOptions}
                    </select>
                </div>
                <!-- Location Dropdown (Initially hidden/empty) -->
                <div class="move-container" style="width:100%; display:none;" id="loc-container-${item.name}">
                    <span style="font-size:12px;color:#aaa;width:60px">Loc:</span>
                    <select class="move-select" id="loc-select-${item.name}" onchange="this.getRootNode().host.updateSublocDropdown('${item.name}', this.value)">
                        <option value="">-- Select --</option>
                    </select>
                </div>
                <!-- Sublocation Dropdown (Initially hidden/empty) -->
                <div class="move-container" style="width:100%; display:none;" id="subloc-container-${item.name}">
                    <span style="font-size:12px;color:#aaa;width:60px">Sub:</span>
                    <select class="move-select" id="target-subloc-${item.name}" onchange="this.getRootNode().host.handleMoveToPath('${item.name}')">
                        <option value="">-- Select --</option>
                    </select>
                </div>
            </div>
         `;
         div.appendChild(details);
     }
     return div;
  }
  
  enableSublocRename(btn, oldName) {
      const header = btn.closest('.group-separator');
      // Prevent multiple inputs
      if (header.querySelector('input')) return; 
      
      const titleSpan = header.querySelector('.subloc-title') || header.querySelector('span');
      if(!titleSpan) return;

      const input = document.createElement('input');
      input.value = oldName;
      input.className = 'rename-input'; 
      input.style.background = '#222';
      input.style.color = 'white';
      input.style.border = '1px solid var(--primary)';
      input.style.borderRadius = '4px';
      input.style.padding = '4px';
      input.style.fontSize = '14px';
      input.style.width = '200px'; 
      
      // Stop click propagation
      input.onclick = (e) => e.stopPropagation();

      titleSpan.replaceWith(input);
      input.focus();

      let isSaving = false;

      const save = () => {
          if (isSaving) return; // Prevent double firing
          isSaving = true;

          const newVal = input.value.trim();
          if (newVal && newVal !== oldName) {
              // Optimistic update: Show new name immediately
              const newSpan = document.createElement('span');
              newSpan.className = 'subloc-title';
              newSpan.innerText = newVal;
              newSpan.style.opacity = '0.7'; // Visual cue for pending save
              input.replaceWith(newSpan);

              this.callHA('update_item_details', { 
                  original_name: oldName, 
                  new_name: newVal, 
                  new_date: "",
                  current_path: this.currentPath,
                  is_folder: true
              }).catch(err => {
                  console.error("Rename failed", err);
                  // Revert if failed
                  newSpan.innerText = oldName;
                  newSpan.style.opacity = '1';
                  alert("Failed to rename");
              });
          } else {
              // Revert to old text if no change or empty
              const originalSpan = document.createElement('span');
              originalSpan.className = 'subloc-title';
              originalSpan.innerText = oldName;
              input.replaceWith(originalSpan);
          }
      };

      input.onkeydown = (e) => {
          if (e.key === 'Enter') {
              input.blur(); // Triggers onblur -> save
          }
      };
      
      input.onblur = () => save();
  }

  handleFile(e) { }
  handleUpdateImage(input, name) {
    const file = input.files[0]; if (!file) return;
    this.compressImage(file, (dataUrl) => {
        this.callHA('update_image', { item_name: name, image_data: dataUrl });
    });
    input.value = '';
  }

  // --- NEW ICON PICKER LOGIC ---
  openIconPicker(folderName) {
      this.pendingFolderIcon = folderName;
      const modal = this.shadowRoot.getElementById('icon-modal');
      const grid = this.shadowRoot.getElementById('icon-lib-grid');
      const tabs = this.shadowRoot.getElementById('icon-tabs');
      
      // Clear previous
      grid.innerHTML = '';
      tabs.innerHTML = '';

      const libs = [
          {name: "Rooms", data: ICON_LIB_ROOM},
          {name: "Locations", data: ICON_LIB_LOCATION},
          {name: "Items", data: ICON_LIB_ITEM}
      ];

      // Default active lib (or remembered state could go here)
      let activeLib = ICON_LIB_ROOM;

      const renderGrid = (lib) => {
          grid.innerHTML = '';
          Object.keys(lib).forEach(key => {
              const div = document.createElement('div');
              div.className = 'lib-icon';
              div.innerHTML = `${lib[key]}<span>${key}</span>`;
              div.onclick = () => this.selectLibraryIcon(lib[key]);
              grid.appendChild(div);
          });
      };

      libs.forEach(l => {
          const btn = document.createElement('button');
          btn.className = 'tab-btn';
          btn.innerText = l.name;
          if (l.data === activeLib) btn.classList.add('active');
          
          btn.onclick = () => {
              tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              activeLib = l.data;
              renderGrid(activeLib);
          };
          tabs.appendChild(btn);
      });

      renderGrid(activeLib);
      modal.style.display = 'flex';
  }

  selectLibraryIcon(svgHtml) {
      // Close modal immediately for better UX
      const modal = this.shadowRoot.getElementById('icon-modal');
      if (modal) modal.style.display = 'none';

      // Robust SVG string construction
      let source = svgHtml;
      
      // 1. Ensure xmlns
      if (!source.includes('xmlns')) {
          source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      
      // 2. Ensure dimensions
      if (!source.includes('width=')) {
          source = source.replace('<svg', '<svg width="200" height="200"');
      }
      
      // 3. Ensure Color (Light Blue)
      if (!source.includes('fill=')) {
          source = source.replace('<svg', '<svg fill="#4fc3f7" style="fill:#4fc3f7;"');
      }

      const img = new Image();
      const blob = new Blob([source], {type: 'image/svg+xml;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, 200, 200);
          const dataUrl = canvas.toDataURL('image/png');
          
          if(this.pendingFolderIcon) {
              const markerName = `[Folder] ${this.pendingFolderIcon}`;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          URL.revokeObjectURL(url);
      };
      
      img.onerror = (e) => {
          console.error("Failed to render SVG to Image", e);
          alert("Error converting icon.");
          URL.revokeObjectURL(url);
      };
      
      img.src = url;
  }

  handleUrlIcon(url) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          try {
              const dataUrl = canvas.toDataURL('image/jpeg');
              if(this.pendingFolderIcon) {
                  const markerName = `[Folder] ${this.pendingFolderIcon}`;
                  this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
              }
              this.shadowRoot.getElementById('icon-modal').style.display = 'none';
              this.shadowRoot.getElementById('icon-url-input').value = '';
          } catch(e) {
              alert("CORS prevented saving this image. Try uploading the file directly.");
          }
      };
      img.onerror = () => alert("Could not load image. Check URL or CORS permissions.");
      img.src = url;
  }

  handleIconUpload(input) {
      const file = input.files[0];
      if (!file) return;
      this.compressImage(file, (dataUrl) => {
          if(this.pendingFolderIcon) {
              const markerName = `[Folder] ${this.pendingFolderIcon}`;
              this.callHA('update_image', { item_name: markerName, image_data: dataUrl });
          }
          this.shadowRoot.getElementById('icon-modal').style.display = 'none';
      });
      input.value = '';
  }
  // --- END ICON PICKER LOGIC ---

  compressImage(file, callback) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const MAX = 1024;
              let w = img.width, h = img.height;
              if (w > h) { if (w > MAX) { h *= MAX/w; w = MAX; } } else { if (h > MAX) { w *= MAX/h; h = MAX; } }
              canvas.width = w; canvas.height = h;
              ctx.drawImage(img, 0, 0, w, h);
              callback(canvas.toDataURL('image/jpeg', 0.5));
          };
          img.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }

  pasteItem() { this.callHA('paste_item', { target_path: this.currentPath }); }
  saveDetails(idx, oldName) { const nEl = this.shadowRoot.getElementById(`name-${idx}`); const dEl = this.shadowRoot.getElementById(`date-${idx}`); if(nEl && dEl) { this.callHA('update_item_details', { original_name: oldName, new_name: nEl.value, new_date: dEl.value }); this.expandedIdx = null; } }
  cut(name) { this.callHA('clipboard_action', {action: 'cut', item_name: name}); }
  del(name) { this._hass.callService('home_organizer', 'delete_item', { item_name: name, current_path: this.currentPath, is_folder: false }); }
  
  showImg(src) { 
      const ov = this.shadowRoot.getElementById('overlay-img');
      const ovc = this.shadowRoot.getElementById('img-overlay');
      if(ov && ovc) { ov.src = src; ovc.style.display = 'flex'; }
  }

  callHA(service, data) { return this._hass.callService('home_organizer', service, data); }
}

if (!customElements.get('home-organizer-panel')) {
    customElements.define('home-organizer-panel', HomeOrganizerPanel);
}
