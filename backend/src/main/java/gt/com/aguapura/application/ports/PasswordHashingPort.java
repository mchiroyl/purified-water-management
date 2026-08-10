package gt.com.aguapura.application.ports;

public interface PasswordHashingPort {
    String encode(String rawPassword);
}
