package gt.com.aguapura.application.ports;

public interface FelProviderPort {
    String providerCode();
    boolean validateCredentials(String credentialSecretRef, String environment, String establishmentCode);
}
