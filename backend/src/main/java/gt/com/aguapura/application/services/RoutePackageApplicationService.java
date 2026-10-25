package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.sync.RoutePackageResponse;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.CustomerRoutePort;
import gt.com.aguapura.application.ports.InventoryPort;
import gt.com.aguapura.application.ports.PricingPort;
import gt.com.aguapura.application.ports.ProductCatalogPersistencePort;
import gt.com.aguapura.application.ports.RouteLoadPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class RoutePackageApplicationService {
    private final CompanyConfigurationPersistencePort companyConfigPort;
    private final CustomerRoutePort customerRoutePort;
    private final ProductCatalogPersistencePort productPort;
    private final PricingPort pricingPort;
    private final RouteLoadPort routeLoadPort;
    private final InventoryPort inventoryPort;

    public RoutePackageApplicationService(CompanyConfigurationPersistencePort companyConfigPort,
                                          CustomerRoutePort customerRoutePort,
                                          ProductCatalogPersistencePort productPort,
                                          PricingPort pricingPort,
                                          RouteLoadPort routeLoadPort,
                                          InventoryPort inventoryPort) {
        this.companyConfigPort = companyConfigPort;
        this.customerRoutePort = customerRoutePort;
        this.productPort = productPort;
        this.pricingPort = pricingPort;
        this.routeLoadPort = routeLoadPort;
        this.inventoryPort = inventoryPort;
    }

    @Transactional(readOnly = true)
    public RoutePackageResponse buildPackage(UUID routeId, UUID userId, String username, List<String> roles, UUID deviceId) {
        Instant now = Instant.now();
        String nowIso = now.toString();

        // 1. Company Configuration
        var companyData = companyConfigPort.find().orElse(null);
        RoutePackageResponse.CompanyConfigurationSnapshot companyConfigSnapshot;
        ZoneId zone = ZoneId.of("America/Guatemala");
        if (companyData != null) {
            if (companyData.timezone() != null && !companyData.timezone().isBlank()) {
                try {
                    zone = ZoneId.of(companyData.timezone());
                } catch (Exception ignored) {}
            }
            Map<String, String> contact = new HashMap<>();
            if (companyData.address() != null) contact.put("address", companyData.address());
            if (companyData.phone() != null) contact.put("phone", companyData.phone());
            if (companyData.whatsapp() != null) contact.put("whatsapp", companyData.whatsapp());
            if (companyData.email() != null) contact.put("email", companyData.email());

            companyConfigSnapshot = new RoutePackageResponse.CompanyConfigurationSnapshot(
                    companyData.id() != null ? companyData.id().toString() : UUID.randomUUID().toString(),
                    companyData.commercialName() != null ? companyData.commercialName() : "Agua Pura",
                    companyData.legalName() != null ? companyData.legalName() : "Agua Pura",
                    companyData.taxId() != null ? companyData.taxId() : "CF",
                    contact,
                    companyData.logoFileId() != null ? companyData.logoFileId().toString() : null,
                    companyData.currencyCode() != null ? companyData.currencyCode() : "GTQ",
                    companyData.timezone() != null ? companyData.timezone() : "America/Guatemala",
                    companyData.receiptPrefix() != null ? companyData.receiptPrefix() : "REC-",
                    (int) companyData.version(),
                    nowIso
            );
        } else {
            companyConfigSnapshot = new RoutePackageResponse.CompanyConfigurationSnapshot(
                    UUID.randomUUID().toString(), "Agua Pura", "Agua Pura", "CF",
                    Map.of(), null, "GTQ", "America/Guatemala", "REC-", 1, nowIso
            );
        }

        // 2. User Context
        var userContextSnapshot = new RoutePackageResponse.UserContextSnapshot(
                userId.toString(),
                username,
                roles,
                deviceId.toString(),
                nowIso
        );

        // 3. Find Route and Route Run/Load
        LocalDate businessDate = LocalDate.now(zone);
        List<CustomerRoutePort.RouteView> allRoutes = customerRoutePort.findRoutes(Optional.empty());
        var matchedRoute = allRoutes.stream().filter(r -> r.id().equals(routeId)).findFirst().orElse(null);

        String routeRunId;
        String sellerId = matchedRoute != null && matchedRoute.sellerId() != null ? matchedRoute.sellerId().toString() : userId.toString();
        String vehicleId = matchedRoute != null && matchedRoute.vehicleId() != null ? matchedRoute.vehicleId().toString() : null;

        // Route Loads for this route
        List<RouteLoadPort.LoadView> allLoads = routeLoadPort.findLoads(Optional.empty());
        var routeLoadsForRoute = allLoads.stream()
                .filter(l -> l.routeId().equals(routeId))
                .filter(l -> businessDate.equals(l.plannedDate()))
                .toList();

        var initialLoad = routeLoadsForRoute.stream()
                .filter(l -> "INITIAL".equalsIgnoreCase(l.loadType()))
                .findFirst().orElse(null);

        if (initialLoad != null) {
            routeRunId = initialLoad.id().toString();
        } else if (!routeLoadsForRoute.isEmpty()) {
            routeRunId = routeLoadsForRoute.get(0).id().toString();
        } else {
            routeRunId = routeId.toString(); // Fallback identifier
        }

        String packageVersion = businessDate.toString().replace("-", "") + "-" + now.getEpochSecond();
        String expiresAt = businessDate.plusDays(1).atStartOfDay(zone).toInstant().toString();

        var routePackageSnapshot = new RoutePackageResponse.RoutePackageSnapshot(
                routeRunId,
                routeId.toString(),
                sellerId,
                vehicleId,
                "ACTIVE",
                businessDate.toString(),
                packageVersion,
                nowIso,
                expiresAt
        );

        // 4. Metadata
        var metadataSnapshot = new RoutePackageResponse.MetadataSnapshot(
                "route-package",
                Map.of("routeId", routeId.toString(), "packageVersion", packageVersion, "businessDate", businessDate.toString()),
                nowIso
        );

        // 5. Customers for this route
        List<CustomerRoutePort.CustomerView> allCustomers = customerRoutePort.findCustomers(Optional.empty());
        List<RoutePackageResponse.CustomerSnapshot> customerSnapshots = allCustomers.stream()
                .filter(c -> routeId.equals(c.routeId()))
                .filter(c -> !"INACTIVE".equalsIgnoreCase(c.status()))
                .map(c -> new RoutePackageResponse.CustomerSnapshot(
                        c.id().toString(),
                        routeRunId,
                        c.code() != null ? c.code() : "",
                        c.name(),
                        c.phone() != null ? c.phone() : "",
                        c.customerType() != null ? c.customerType() : "REGULAR",
                        c.status() != null ? c.status() : "ACTIVE",
                        c.creditAllowed(),
                        c.creditLimit() != null ? c.creditLimit().toPlainString() : "0.00",
                        c.addressReference(),
                        c.phone(),
                        c.whatsapp(),
                        c.confirmedLatitude() != null ? c.confirmedLatitude().toPlainString() : null,
                        c.confirmedLongitude() != null ? c.confirmedLongitude().toPlainString() : null,
                        nowIso
                ))
                .toList();

        // 6. Products & Presentations
        List<ProductCatalogPersistencePort.CatalogProduct> allProducts = productPort.findAll();
        List<RoutePackageResponse.ProductSnapshot> productSnapshots = new ArrayList<>();
        List<RoutePackageResponse.PresentationSnapshot> presentationSnapshots = new ArrayList<>();

        for (var prod : allProducts) {
            if (prod.active()) {
                productSnapshots.add(new RoutePackageResponse.ProductSnapshot(
                        prod.id().toString(),
                        prod.code(),
                        prod.name(),
                        prod.baseUnitCode(),
                        true,
                        1,
                        prod.controlsInventory(),
                        1
                ));
                if (prod.presentations() != null) {
                    for (var pres : prod.presentations()) {
                        if (pres.active()) {
                            presentationSnapshots.add(new RoutePackageResponse.PresentationSnapshot(
                                    pres.id().toString(),
                                    prod.id().toString(),
                                    pres.code(),
                                    pres.name(),
                                    pres.conversionFactor() != null ? pres.conversionFactor().toPlainString() : "1",
                                    true,
                                    1
                            ));
                        }
                    }
                }
            }
        }

        // 7. Pricing (PriceVersions, PriceTiers, SpecialPrices)
        List<PricingPort.PriceListView> priceLists = pricingPort.findPriceLists();
        List<RoutePackageResponse.PriceVersionSnapshot> priceVersionSnapshots = new ArrayList<>();
        List<RoutePackageResponse.PriceTierSnapshot> priceTierSnapshots = new ArrayList<>();

        for (var pl : priceLists) {
            if ("ACTIVE".equalsIgnoreCase(pl.status()) && pl.versions() != null) {
                for (var v : pl.versions()) {
                    if ("ACTIVE".equalsIgnoreCase(v.status())) {
                        String vId = v.id().toString();
                        priceVersionSnapshots.add(new RoutePackageResponse.PriceVersionSnapshot(
                                vId,
                                pl.id().toString(),
                                v.versionNumber(),
                                v.validFrom() != null ? v.validFrom().toString() : nowIso,
                                v.validTo() != null ? v.validTo().toString() : null,
                                "ACTIVE"
                        ));
                        if (v.tiers() != null) {
                            for (var t : v.tiers()) {
                                priceTierSnapshots.add(new RoutePackageResponse.PriceTierSnapshot(
                                        t.id().toString(),
                                        vId,
                                        t.presentationId().toString(),
                                        t.minimumBaseUnits() != null ? t.minimumBaseUnits().toPlainString() : "1",
                                        t.maximumBaseUnits() != null ? t.maximumBaseUnits().toPlainString() : null,
                                        t.unitPrice() != null ? t.unitPrice().toPlainString() : "0.00"
                                ));
                            }
                        }
                    }
                }
            }
        }

        // Special prices for route customers
        Set<UUID> routeCustomerIds = new HashSet<>();
        customerSnapshots.forEach(c -> routeCustomerIds.add(UUID.fromString(c.id())));

        List<PricingPort.SpecialPriceView> allSpecialPrices = pricingPort.findSpecialPrices();
        List<RoutePackageResponse.SpecialPriceSnapshot> specialPriceSnapshots = allSpecialPrices.stream()
                .filter(sp -> routeCustomerIds.contains(sp.customerId()))
                .filter(sp -> "ACTIVE".equalsIgnoreCase(sp.status()))
                .map(sp -> new RoutePackageResponse.SpecialPriceSnapshot(
                        sp.id().toString(),
                        sp.customerId().toString(),
                        sp.presentationId().toString(),
                        sp.unitPrice().toPlainString(),
                        sp.validFrom() != null ? sp.validFrom().toString() : nowIso,
                        sp.validTo() != null ? sp.validTo().toString() : null,
                        "ACTIVE"
                ))
                .toList();

        // 8. Route Loads & Route Load Items
        List<RoutePackageResponse.RouteLoadSnapshot> routeLoadSnapshots = new ArrayList<>();
        List<RoutePackageResponse.RouteLoadItemSnapshot> routeLoadItemSnapshots = new ArrayList<>();

        for (var load : routeLoadsForRoute) {
            String lId = load.id().toString();
            routeLoadSnapshots.add(new RoutePackageResponse.RouteLoadSnapshot(
                    lId,
                    routeRunId,
                    load.status(),
                    load.sellerReceivedAt() != null ? load.sellerReceivedAt().toString() : null,
                    "1"
            ));
            if (load.items() != null) {
                for (var it : load.items()) {
                    routeLoadItemSnapshots.add(new RoutePackageResponse.RouteLoadItemSnapshot(
                            it.id().toString(),
                            lId,
                            it.productId().toString(),
                            it.quantityBaseUnits() != null ? it.quantityBaseUnits().toPlainString() : "0",
                            it.quantityBaseUnits() != null ? it.quantityBaseUnits().toPlainString() : "0"
                    ));
                }
            }
        }

        // 9. Route Inventory
        List<RoutePackageResponse.RouteInventoryRecord> routeInventoryRecords = new ArrayList<>();
        Optional<UUID> targetLocationOpt = routeLoadPort.findActiveRouteLocation(routeId);
        if (targetLocationOpt.isPresent()) {
            UUID targetLocId = targetLocationOpt.get();
            var locations = inventoryPort.findLocations(Optional.empty());
            var matchedLoc = locations.stream().filter(l -> l.id().equals(targetLocId)).findFirst().orElse(null);
            if (matchedLoc != null && matchedLoc.balances() != null) {
                for (var b : matchedLoc.balances()) {
                    routeInventoryRecords.add(new RoutePackageResponse.RouteInventoryRecord(
                            targetLocId + ":" + b.productId(),
                            routeRunId,
                            b.productId().toString(),
                            b.quantityBaseUnits() != null ? b.quantityBaseUnits().toPlainString() : "0",
                            "0",
                            (int) b.version(),
                            b.updatedAt() != null ? b.updatedAt().toString() : nowIso
                    ));
                }
            }
        }

        return new RoutePackageResponse(
                metadataSnapshot,
                userContextSnapshot,
                companyConfigSnapshot,
                routePackageSnapshot,
                customerSnapshots,
                productSnapshots,
                presentationSnapshots,
                priceVersionSnapshots,
                priceTierSnapshots,
                specialPriceSnapshots,
                routeLoadSnapshots,
                routeLoadItemSnapshots,
                routeInventoryRecords
        );
    }
}
