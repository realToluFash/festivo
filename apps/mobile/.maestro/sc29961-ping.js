/* global http, HELPER_URL -- sc-29961: tells the batch harness a long wait is still alive */
http.get(HELPER_URL + '/running');
