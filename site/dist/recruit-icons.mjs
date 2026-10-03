/** New code-native roster icons, aligned to the existing32px ability system. */
const svg=(body,color='#edce8c')=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="skill-svg">${body}</svg>`;
const dragon=mark=>`<path d="m3 18 8-5 6 3 5-2 7 4-7 4-7-2-5 4-1-6-6 2ZM11 13 7 3l10 7 10-6-5 10M22 20l5 6-7-2"/>${mark}`;
const demon=mark=>`<path d="m8 13-4-9 9 5h6l9-5-4 9v8l-8 8-8-8ZM9 16h4m6 0h4"/>${mark}`;
export const RECRUIT_ICONS=Object.freeze({
 air:svg('<path d="m3 18 8-4 5 3 5-3 8 4-9 6h-8l-9-6Zm8-4L5 7l9 3m7 4 6-7-9 3"/><circle cx="16" cy="7" r="3"/><path d="M16 10v7"/>'),
 poisonDragon:svg(dragon('<path d="M6 26c-3 4 4 5 2 0l-1-2-1 2Z"/>'),'#b9d39c'),
 fireDragon:svg(dragon('<path d="M3 27c-3-3 1-5 2-8 1 3 5 7 1 10Z"/>'),'#efac72'),
 iceDragon:svg(dragon('<path d="M5 23v8m-4-6 8 4m-8 0 8-4"/>'),'#a9d8df'),
 fireDemon:svg(demon('<path d="M16 25c-6-3-1-5-1-9 4 4 7 7 1 9Z"/>'),'#efac72'),
 iceDemon:svg(demon('<path d="M16 18v8m-4-6 8 4m-8 0 8-4"/>'),'#a9d8df'),
 gorath:svg('<path d="m7 9 4-6h10l4 6-3 6H10L7 9ZM9 18l7-3 7 3 2 9H7l2-9ZM12 10h3m3 0h3M3 11v18M3 11l5-5 1 9-6-4"/>')
});
