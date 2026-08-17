package gt.com.aguapura.presentation.controllers;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/units-of-measure")
public class UnitOfMeasureController {
    private final JdbcClient jdbc;

    public UnitOfMeasureController(JdbcClient jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public List<UnitResponse> findActive() {
        return jdbc.sql("SELECT code,name,decimal_places FROM unit_of_measure WHERE active ORDER BY code")
                .query((rs, row) -> new UnitResponse(rs.getString("code"), rs.getString("name"), rs.getInt("decimal_places"))).list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMINISTRADOR','BODEGA')")
    public UnitResponse create(@Valid @RequestBody CreateUnitRequest request) {
        String code = request.code().trim().toUpperCase();
        jdbc.sql("INSERT INTO unit_of_measure(id,code,name,decimal_places) VALUES (:id,:code,:name,:decimalPlaces) ON CONFLICT (code) DO UPDATE SET active=true,name=EXCLUDED.name,decimal_places=EXCLUDED.decimal_places")
                .params(java.util.Map.of("id", UUID.randomUUID(), "code", code, "name", request.name().trim(), "decimalPlaces", request.decimalPlaces())).update();
        return new UnitResponse(code, request.name().trim(), request.decimalPlaces());
    }

    public record CreateUnitRequest(@NotBlank @Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
                                    @NotBlank @Size(max = 80) String name, int decimalPlaces) {}
    public record UnitResponse(String code, String name, int decimalPlaces) {}
}
