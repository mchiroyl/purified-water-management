package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.application.ports.PasswordVerificationPort;
import gt.com.aguapura.application.ports.PasswordHashingPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class PasswordVerificationAdapter implements PasswordVerificationPort, PasswordHashingPort {
    private final PasswordEncoder encoder;
    public PasswordVerificationAdapter(PasswordEncoder encoder) { this.encoder = encoder; }
    public boolean matches(String rawPassword, String encodedPassword) { return encoder.matches(rawPassword, encodedPassword); }
    public String encode(String rawPassword) { return encoder.encode(rawPassword); }
}
