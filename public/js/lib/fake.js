// Locale-aware fake data. Small curated lists; values are random combinations, not real people.

export const LOCALES = {
  en: {
    label: 'English (US/UK)',
    first: ['James', 'Emma', 'Oliver', 'Sophia', 'Liam', 'Ava', 'Noah', 'Mia', 'Lucas', 'Charlotte', 'Henry', 'Amelia', 'Jack', 'Grace', 'Daniel', 'Ella', 'Samuel', 'Chloe', 'Ethan', 'Lily'],
    last: ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davies', 'Evans', 'Thomas', 'Roberts', 'Walker', 'Wright', 'Hall', 'Green', 'Baker', 'Clarke', 'Turner', 'Hughes', 'Carter', 'Mitchell', 'Cooper'],
    cities: ['London', 'Manchester', 'New York', 'Chicago', 'Boston', 'Seattle', 'Austin', 'Leeds', 'Bristol', 'Denver'],
    country: 'United States',
    streets: ['High Street', 'Station Road', 'Park Avenue', 'Church Lane', 'Maple Drive', 'Oak Street', 'Elm Road', 'Mill Lane'],
    phone: () => `+1 ${rnd(200, 989)}-${rnd(200, 989)}-${rnd(1000, 9999)}`,
    postal: () => `${rnd(10000, 99999)}`,
    addr: (n, s, c, p) => `${n} ${s}, ${c} ${p}`,
  },
  pl: {
    label: 'Polski',
    first: ['Jan', 'Anna', 'Piotr', 'Katarzyna', 'Michał', 'Agnieszka', 'Paweł', 'Magdalena', 'Tomasz', 'Joanna', 'Łukasz', 'Ewa', 'Marcin', 'Zofia', 'Krzysztof', 'Monika', 'Bartosz', 'Natalia', 'Wojciech', 'Julia'],
    last: ['Nowak', 'Kowalski', 'Wiśniewski', 'Wójcik', 'Kowalczyk', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski', 'Pawłowski', 'Michalski', 'Król'],
    cities: ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Lublin', 'Katowice', 'Białystok'],
    country: 'Polska',
    streets: ['ul. Długa', 'ul. Słoneczna', 'ul. Polna', 'ul. Leśna', 'ul. Kwiatowa', 'ul. Ogrodowa', 'ul. Lipowa', 'ul. Szkolna'],
    phone: () => `+48 ${rnd(500, 889)} ${rnd(100, 999)} ${rnd(100, 999)}`,
    postal: () => `${rnd(10, 99)}-${rnd(100, 999)}`,
    addr: (n, s, c, p) => `${s} ${n}, ${p} ${c}`,
  },
  de: {
    label: 'Deutsch',
    first: ['Lukas', 'Anna', 'Felix', 'Marie', 'Jonas', 'Sophie', 'Leon', 'Laura', 'Paul', 'Lena', 'Maximilian', 'Hannah', 'Tim', 'Julia', 'Jan', 'Katharina', 'Niklas', 'Lea', 'Moritz', 'Clara'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger'],
    cities: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dresden', 'Bremen'],
    country: 'Deutschland',
    streets: ['Hauptstraße', 'Bahnhofstraße', 'Gartenstraße', 'Schulstraße', 'Dorfstraße', 'Bergstraße', 'Lindenweg', 'Waldstraße'],
    phone: () => `+49 ${rnd(150, 179)} ${rnd(1000000, 9999999)}`,
    postal: () => `${rnd(10000, 99999)}`,
    addr: (n, s, c, p) => `${s} ${n}, ${p} ${c}`,
  },
  uk: {
    label: 'Українська',
    first: ['Олександр', 'Марія', 'Андрій', 'Олена', 'Дмитро', 'Наталія', 'Іван', 'Оксана', 'Сергій', 'Ірина', 'Максим', 'Софія', 'Тарас', 'Катерина', 'Богдан', 'Юлія', 'Назар', 'Анастасія', 'Роман', 'Вікторія'],
    last: ['Шевченко', 'Коваленко', 'Бондаренко', 'Бойко', 'Ткаченко', 'Кравченко', 'Ковальчук', 'Олійник', 'Шевчук', 'Мельник', 'Мороз', 'Лисенко', 'Петренко', 'Гриценко', 'Савченко', 'Руденко', 'Марченко', 'Гончар', 'Павленко', 'Кузьменко'],
    cities: ['Київ', 'Львів', 'Харків', 'Одеса', 'Дніпро', 'Вінниця', 'Полтава', 'Чернівці', 'Івано-Франківськ', 'Луцьк'],
    country: 'Україна',
    streets: ['вул. Шевченка', 'вул. Гагаріна', 'вул. Лесі Українки', 'вул. Центральна', 'вул. Садова', 'вул. Незалежності', 'вул. Франка', 'вул. Миру'],
    phone: () => `+380 ${rnd(50, 99)} ${rnd(100, 999)} ${rnd(10, 99)} ${rnd(10, 99)}`,
    postal: () => `${rnd(10000, 99999)}`,
    addr: (n, s, c, p) => `${s}, ${n}, ${c}, ${p}`,
  },
};

const COMPANY_A = ['Nova', 'Apex', 'Blue', 'Sunrise', 'Vertex', 'Northwind', 'Luma', 'Cobalt', 'Orbit', 'Evergreen', 'Atlas', 'Pioneer', 'Bright', 'Summit', 'Harbor'];
const COMPANY_B = ['Systems', 'Labs', 'Group', 'Solutions', 'Logistics', 'Studio', 'Partners', 'Works', 'Digital', 'Industries', 'Consulting', 'Energy'];
const JOBS = ['Product Manager', 'Software Engineer', 'Marketing Specialist', 'Sales Manager', 'Data Analyst', 'Designer', 'Accountant', 'Project Coordinator', 'HR Business Partner', 'Customer Success Manager', 'Operations Lead', 'Graphic Designer'];
const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', 'ł': 'l', 'ß': 'ss' };

function rnd(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + (buf[0] % range);
}
const pick = (arr) => arr[rnd(0, arr.length - 1)];

export const ascii = (s) => [...s.toLowerCase()].map((c) => TRANSLIT[c] ?? c).join('').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

export const FIELDS = {
  name: 'Name', email: 'Email', phone: 'Phone', company: 'Company', address: 'Address', city: 'City', country: 'Country', job: 'Job title', date: 'Date', uuid: 'UUID',
};

export function generateRows(localeId, fieldIds, count) {
  const L = LOCALES[localeId] || LOCALES.en;
  const domains = ['example.com', 'example.org', 'example.net'];
  const rows = [];
  for (let i = 0; i < count; i++) {
    const first = pick(L.first);
    const last = pick(L.last);
    const company = `${pick(COMPANY_A)} ${pick(COMPANY_B)}`;
    const city = pick(L.cities);
    const record = {
      name: `${first} ${last}`,
      email: `${ascii(first)}.${ascii(last)}${rnd(1, 99)}@${pick(domains)}`,
      phone: L.phone(),
      company,
      address: L.addr(rnd(1, 140), pick(L.streets), city, L.postal()),
      city,
      country: L.country,
      job: pick(JOBS),
      date: new Date(Date.UTC(rnd(1960, 2005), rnd(0, 11), rnd(1, 28))).toISOString().slice(0, 10),
      uuid: crypto.randomUUID(),
    };
    rows.push(fieldIds.map((f) => record[f]));
  }
  return rows;
}
