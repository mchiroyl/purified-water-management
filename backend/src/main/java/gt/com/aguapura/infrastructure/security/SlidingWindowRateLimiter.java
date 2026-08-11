package gt.com.aguapura.infrastructure.security;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class SlidingWindowRateLimiter {

    private final Map<String, ArrayDeque<Instant>> attempts = new HashMap<>();

    public synchronized boolean tryAcquire(String key, int limit, Duration window, Instant now) {
        var queue = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        Instant threshold = now.minus(window);
        while (!queue.isEmpty() && !queue.peekFirst().isAfter(threshold)) {
            queue.removeFirst();
        }
        if (queue.size() >= limit) {
            return false;
        }
        queue.addLast(now);
        if (attempts.size() > 10_000) {
            attempts.entrySet().removeIf(entry -> entry.getValue().isEmpty()
                    || !entry.getValue().peekLast().isAfter(threshold));
        }
        return true;
    }
}
