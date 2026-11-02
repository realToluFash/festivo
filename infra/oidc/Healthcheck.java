import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

class Healthcheck {
    public static void main(String[] args) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:8080/google/.well-known/openid-configuration")).build();
        var status = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        System.exit(status == 200 ? 0 : 1);
    }
}
