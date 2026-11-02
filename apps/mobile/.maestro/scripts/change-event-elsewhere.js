/* global http, json, output, API_URL, WEB_URL, EMAIL, PASSWORD, EVENT_ID, ELSEWHERE_NAME, HOSTS -- what Maestro's runScript provides */
// A second session for checks/sc3595-edit.yaml, checks/sc20824-edit-latest.yaml and checks/sc22284-hosts-now-*.yaml, given API_URL and WEB_URL by the harness: signs in on the API as the same person and renames EVENT_ID, or with HOSTS gives it that many hosts, so the open form's tag is stale.
const hosts = [
  'Adebayo Oluwaseun Fasugba-Ogunleye',
  'Maria Fernanda de los Santos Gutierrez',
  'Jean-Baptiste Delacroix-Montgomery',
  'Oluwatoyin Adesewa Abimbola Okonkwo',
  'Ana Beatriz Conceição Albuquerque',
  'Chukwuemeka Ikechukwu Nwachukwu',
];
const login = http.post(`${API_URL}/api/auth/login`, {
  headers: { 'Content-Type': 'application/json', Origin: WEB_URL },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
const token = json(login.body).accessToken;
const read = http.get(`${API_URL}/api/events/${EVENT_ID}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const tag = read.headers && (read.headers.etag || read.headers.ETag || read.headers.Etag);
const changed =
  tag &&
  http.request(`${API_URL}/api/events/${EVENT_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'If-Match': Array.isArray(tag) ? tag[0] : tag,
    },
    body: JSON.stringify(
      typeof HOSTS === 'undefined'
        ? { name: ELSEWHERE_NAME }
        : { hosts: hosts.slice(0, Number(HOSTS)) },
    ),
  });
output.changed = changed ? changed.status : `no ETag on GET (${read.status})`;
