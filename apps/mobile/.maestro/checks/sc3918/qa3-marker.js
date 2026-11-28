/* global http, output, MARK, MARKER_URL -- tells the tester's API watcher to stop or start the api */
var r = http.get(MARKER_URL + '/qa3marker-' + MARK + '-' + Date.now());
output.mark = r.status;
