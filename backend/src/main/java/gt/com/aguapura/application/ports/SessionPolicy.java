package gt.com.aguapura.application.ports;

import java.time.Duration;

public interface SessionPolicy {
    Duration refreshTokenDuration();
}
