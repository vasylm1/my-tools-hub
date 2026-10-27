import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUtmUrl, buildBatch } from '../public/js/lib/utm.js';
import { parseColor, toHex, contrastRatio, grade, level, suggestForeground } from '../public/js/lib/contrast.js';
import { classifyQrText, parseWifi } from '../public/js/lib/qr-content.js';

test('campaign links: tags are added, cleaned and never duplicated', () => {
  const out = buildUtmUrl('https://example.com/spring-sale?ref=nav&utm_source=old#pricing', { source: 'Newsletter', medium: 'Email', campaign: 'Spring Sale', content: 'header button' });
  assert.equal(out.url, 'https://example.com/spring-sale?ref=nav&utm_source=newsletter&utm_medium=email&utm_campaign=spring-sale&utm_content=header-button#pricing');
  assert.ok(out.warnings.some((w) => /already had campaign tags/.test(w)));
  const keep = buildUtmUrl('https://example.com/', { source: 'A b', medium: 'cpc', campaign: 'x' }, { lowercase: false, space: '_' });
  assert.match(keep.url, /utm_source=A_b/);
  assert.ok(keep.warnings.some((w) => /Capital letters/.test(w)));
  assert.ok(buildUtmUrl('http://example.com', { source: 'a', medium: 'email', campaign: 'c' }).warnings.some((w) => /https/.test(w)));
  assert.ok(buildUtmUrl('https://example.com', { source: 'a', medium: 'weird', campaign: 'c' }).warnings.some((w) => /not a standard one/.test(w)));
});

test('campaign links: bad input gives actionable errors', () => {
  assert.throws(() => buildUtmUrl('example.com', { source: 'a', medium: 'b', campaign: 'c' }), /http/);
  assert.throws(() => buildUtmUrl('javascript:alert(1)', { source: 'a', medium: 'b', campaign: 'c' }), /http/);
  assert.throws(() => buildUtmUrl('https://example.com', { source: 'a', medium: '', campaign: 'c' }), /source, a medium and a campaign/);
});

test('campaign links: batch builds a link per row and reports problem rows', () => {
  const csv = 'Link,Source,Medium,Campaign,Content\nhttps://example.com/a,newsletter,email,spring,hero\nnot a link,x,y,z,\nhttps://example.com/b,linkedin,social,spring,post 1\n';
  const res = buildBatch(csv, {});
  assert.equal(res.length, 3);
  assert.match(res[0].url, /utm_content=hero/);
  assert.equal(res[1].url, ''); assert.ok(res[1].error);
  assert.match(res[2].url, /utm_content=post-1/);
  assert.equal(res[2].row, 4);
  assert.throws(() => buildBatch('a,b\n1,2', {}), /header row needs/);
  assert.throws(() => buildBatch('link', {}), /header row and at least one/);
  // utm_-prefixed header names work too
  assert.match(buildBatch('url,utm_source,utm_medium,utm_campaign\nhttps://e.com,a,email,c', {})[0].url, /utm_medium=email/);
});

test('contrast: ratios match the WCAG reference values', () => {
  const white = parseColor('#fff'); const black = parseColor('#000');
  assert.equal(contrastRatio(black, white).toFixed(2), '21.00');
  assert.equal(contrastRatio(white, white).toFixed(2), '1.00');
  assert.equal(contrastRatio(parseColor('#767676'), white).toFixed(2), '4.54'); // the darkest grey that passes AA on white
  assert.equal(contrastRatio(parseColor('#777'), white).toFixed(2), '4.48');
  assert.deepEqual(grade(4.49), { normalAA: false, normalAAA: false, largeAA: true, largeAAA: false, ui: true });
  assert.equal(grade(4.5).normalAA, true);
  assert.equal(grade(4.499).normalAA, false, 'a near miss is never rounded up to a pass');
  assert.equal(level(7), 'AAA'); assert.equal(level(5), 'AA'); assert.equal(level(3.2), 'Large only'); assert.equal(level(2), 'Fail');
});

test('contrast: colour parsing, alpha and suggestions', () => {
  assert.deepEqual(parseColor('#1a6b47'), { r: 26, g: 107, b: 71, a: 1 });
  assert.deepEqual(parseColor('0f0'), { r: 0, g: 255, b: 0, a: 1 });
  assert.equal(parseColor('rgb(10, 20, 30)').b, 30);
  assert.equal(parseColor('rgba(0,0,0,50%)').a, 0.5);
  assert.equal(parseColor('#12345'), null); assert.equal(parseColor('rgb(300,0,0)'), null); assert.equal(parseColor('blue'), null);
  // 50% black on white behaves like mid grey
  assert.equal(contrastRatio(parseColor('rgba(0,0,0,0.5)'), parseColor('#fff')).toFixed(1), '4.0');
  const fix = suggestForeground(parseColor('#777777'), parseColor('#ffffff'), 4.5);
  assert.ok(contrastRatio(fix, parseColor('#ffffff')) >= 4.5);
  assert.equal(toHex(fix), '#747474');
  assert.equal(suggestForeground(parseColor('#fefefe'), parseColor('#ffffff'), 21), null);
  // the closest fix keeps the colour family
  const green = suggestForeground(parseColor('#5fbf8f'), parseColor('#ffffff'), 4.5);
  assert.ok(green.g > green.r && green.g > green.b);
});

test('QR contents are recognised', () => {
  assert.equal(classifyQrText('https://example.com/x?y=1').kind, 'url');
  assert.equal(classifyQrText('javascript:alert(1)').kind, 'text', 'only http(s) links are treated as links');
  assert.equal(classifyQrText('BEGIN:VCARD\nFN:A').kind, 'vcard');
  assert.equal(classifyQrText('mailto:a@b.co').kind, 'email');
  assert.equal(classifyQrText('tel:+15550100').kind, 'phone');
  assert.equal(classifyQrText('geo:52.2,21.0').kind, 'location');
  assert.equal(classifyQrText('hello').kind, 'text');
  assert.deepEqual(parseWifi('WIFI:T:WPA;S:Guest\u005c;Net;P:pass\u005c:word;H:true;;'), { ssid: 'Guest;Net', password: 'pass:word', security: 'WPA', hidden: true });
  assert.deepEqual(classifyQrText('WIFI:T:nopass;S:Cafe;;').wifi, { ssid: 'Cafe', password: '', security: 'nopass', hidden: false });
});
