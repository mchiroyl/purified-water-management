package gt.com.aguapura.application.ports;

public interface OpaqueTokenPort {
    String newOpaqueToken();
    String sha256(String rawToken);
}
