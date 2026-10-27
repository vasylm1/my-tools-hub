// Work out what a decoded QR code contains, so the tool can explain it. Pure functions.

function unescapeWifi(s) { return s.replace(/\\([\;,:"])/g, '$1'); }

/** Parse "WIFI:T:WPA;S:name;P:password;H:true;;" into fields. */
export function parseWifi(text) {
  const body = text.replace(/^WIFI:/i, '');
  const parts = body.split(/(?<!\\);/).filter(Boolean);
  const fields = {};
  for (const part of parts) {
    const i = part.indexOf(':');
    if (i > 0) fields[part.slice(0, i).toUpperCase()] = unescapeWifi(part.slice(i + 1));
  }
  return { ssid: fields.S || '', password: fields.P || '', security: fields.T || 'nopass', hidden: /^true$/i.test(fields.H || '') };
}

/** @returns {{ kind: 'url'|'wifi'|'vcard'|'email'|'phone'|'sms'|'location'|'calendar'|'text', url?: string, wifi?: object }} */
export function classifyQrText(input) {
  const text = String(input ?? '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(text)) return { kind: 'url', url: text };
  if (/^WIFI:/i.test(text)) return { kind: 'wifi', wifi: parseWifi(text) };
  if (/^BEGIN:VCARD/i.test(text)) return { kind: 'vcard' };
  if (/^BEGIN:V(CALENDAR|EVENT)/i.test(text)) return { kind: 'calendar' };
  if (/^mailto:/i.test(text) || /^MATMSG:/i.test(text)) return { kind: 'email' };
  if (/^tel:/i.test(text)) return { kind: 'phone' };
  if (/^smsto?:/i.test(text)) return { kind: 'sms' };
  if (/^geo:/i.test(text)) return { kind: 'location' };
  return { kind: 'text' };
}
