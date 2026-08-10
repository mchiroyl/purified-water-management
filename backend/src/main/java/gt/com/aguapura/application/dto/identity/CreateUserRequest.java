package gt.com.aguapura.application.dto.identity;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record CreateUserRequest(
        @NotBlank @Size(min = 3, max = 80) @Pattern(regexp = "[A-Za-z0-9._-]+") String username,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 12, max = 128) String password,
        @NotEmpty Set<@NotBlank String> roles,
        @Size(max = 40) String sellerCode,
        @Size(max = 150) String sellerDisplayName
) {}
