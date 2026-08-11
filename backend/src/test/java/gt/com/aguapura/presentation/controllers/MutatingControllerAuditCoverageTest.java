package gt.com.aguapura.presentation.controllers;

import gt.com.aguapura.application.services.AuditApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class MutatingControllerAuditCoverageTest {

    @Test
    void sensitiveCatalogRouteAndTransferMutationsReceiveAuditAndPrincipalContext() {
        for (Class<?> controller : Set.of(ProductCatalogController.class, RouteController.class, PaymentController.class)) {
            assertThat(Arrays.stream(controller.getConstructors())
                    .flatMap(constructor -> Arrays.stream(constructor.getParameterTypes())))
                    .as(controller.getSimpleName() + " debe depender de auditoria")
                    .contains(AuditApplicationService.class);
        }
        assertMutationsCarryJwt(ProductCatalogController.class, Set.of(
                "create", "setActive", "updateConversion", "setPresentationActive"));
        assertMutationsCarryJwt(RouteController.class, Set.of("create", "assign", "createVehicle"));
        assertMutationsCarryJwt(PaymentController.class, Set.of("decide"));
    }

    private void assertMutationsCarryJwt(Class<?> controller, Set<String> names) {
        for (Method method : controller.getDeclaredMethods()) {
            if (names.contains(method.getName())) {
                assertThat(method.getParameterTypes())
                        .as(controller.getSimpleName() + "." + method.getName())
                        .contains(Jwt.class);
            }
        }
    }
}
