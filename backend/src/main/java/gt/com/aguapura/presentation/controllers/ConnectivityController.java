package gt.com.aguapura.presentation.controllers;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/connectivity")
public class ConnectivityController {

    @GetMapping
    public ResponseEntity<Map<String, Object>> connectivity() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(Map.of("status", "ONLINE", "serverTime", Instant.now().toString()));
    }
}
