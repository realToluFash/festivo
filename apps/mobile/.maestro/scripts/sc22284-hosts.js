/* global http, output, API_URL, COUNT */
// sc-22284: somebody else saves output.event with COUNT hosts, as Edit details would, while the sheet is open.
const names = [
  'Adebayo Oluwaseun Fasugba-Ogunleye',
  'Maria Fernanda de los Santos Gutierrez',
  'Jean-Baptiste Delacroix-Montgomery',
  'Oluwatoyin Adesewa Abimbola Okonkwo',
  'Ana Beatriz Conceição Albuquerque',
  'Chukwuemeka Ikechukwu Nwachukwu',
];
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${output.token}` };
const read = http.get(`${API_URL}/api/events/${output.event}`, { headers: auth });
const tag = read.headers.etag ?? read.headers.ETag ?? read.headers.Etag;
const saved = http.request(`${API_URL}/api/events/${output.event}`, {
  method: 'PATCH',
  headers: { ...auth, 'If-Match': Array.isArray(tag) ? tag[0] : tag },
  body: JSON.stringify({ hosts: names.slice(0, Number(COUNT)) }),
});
if (!saved.ok) throw new Error(`hosts not saved: ${saved.status} ${saved.body}`);
