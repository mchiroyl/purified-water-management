package gt.com.aguapura.application.ports;

public interface PasswordVerificationPort {
    boolean matches(String rawPassword, String encodedPassword);
}
