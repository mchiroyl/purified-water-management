package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.dto.credit.CreditBalanceResponse;
import gt.com.aguapura.application.dto.credit.CreditDecisionRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentRequest;
import gt.com.aguapura.application.dto.credit.CreditPaymentResponse;
import gt.com.aguapura.application.dto.credit.CreditRoutePendingResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementEntryResponse;
import gt.com.aguapura.application.dto.credit.CreditStatementResponse;
import gt.com.aguapura.application.ports.CreditPaymentPort;
import gt.com.aguapura.application.ports.CreditPaymentVoucherPdfPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public class JdbcCreditPaymentAdapter implements CreditPaymentPort {
    private static final Set<String> VALID_METHODS = Set.of("CASH", "TRANSFER");
    private final JdbcClient jdbc;
    private final Path storageRoot;

    public JdbcCreditPaymentAdapter(JdbcClient jdbc, @Value("${app.storage.path}") String storagePath) {
        this.jdbc = jdbc;
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
    }

    @Override
    @Transactional
    public CreditPaymentResponse recordPayment(CreditPaymentRequest request, UUID actorId, UUID deviceId) {
        String method = request.paymentMethod().trim().toUpperCase();
        if (!VALID_METHODS.contains(method)) {
            throw new BusinessException("INVALID_PAYMENT_METHOD", "Método de pago no válido: " + request.paymentMethod(), ErrorCategory.VALIDATION);
        }

        String reference = request.reference() == null ? "" : request.reference().trim();
        String bank = request.bank() == null ? "" : request.bank().trim();
        String notes = request.notes() == null ? "" : request.notes().trim();

        if ("TRANSFER".equals(method) && reference.isEmpty()) {
            throw new BusinessException("REFERENCE_REQUIRED", "El número de referencia es obligatorio para transferencias.", ErrorCategory.VALIDATION);
        }

        // Bloqueo pesimista del cliente
        var customerData = jdbc.sql("""
                SELECT id, code, name, credit_allowed, credit_limit, current_balance
                FROM customer WHERE id = :id FOR UPDATE
                """)
                .param("id", request.customerId())
                .query((rs, rowNum) -> new Object[]{
                        rs.getObject("id", UUID.class),
                        rs.getString("code"),
                        rs.getString("name"),
                        rs.getBoolean("credit_allowed"),
                        rs.getBigDecimal("credit_limit"),
                        rs.getBigDecimal("current_balance")
                })
                .optional()
                .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "Cliente no encontrado.", ErrorCategory.NOT_FOUND));

        BigDecimal currentBalance = (BigDecimal) customerData[5];
        if (request.amount().compareTo(currentBalance) > 0) {
            throw new BusinessException("PAYMENT_EXCEEDS_BALANCE",
                    "El monto del abono (Q " + request.amount() + ") excede el saldo adeudado del cliente (Q " + currentBalance + ").",
                    ErrorCategory.VALIDATION);
        }

        UUID paymentId = UUID.randomUUID();
        String status = "CASH".equals(method) ? "CONFIRMED" : "PENDING_VERIFICATION";

        jdbc.sql("""
                INSERT INTO credit_payment (
                    id, customer_id, route_load_id, amount, payment_method,
                    status, reference, bank, notes, collected_by, device_id
                ) VALUES (
                    :id, :customerId, :routeLoadId, :amount, :method,
                    :status, :reference, :bank, :notes, :collectedBy, :deviceId
                )
                """)
                .param("id", paymentId)
                .param("customerId", request.customerId())
                .param("routeLoadId", request.routeLoadId())
                .param("amount", request.amount())
                .param("method", method)
                .param("status", status)
                .param("reference", reference)
                .param("bank", bank)
                .param("notes", notes)
                .param("collectedBy", actorId)
                .param("deviceId", deviceId)
                .update();

        // Si es efectivo, se aplica inmediatamente el abono a la cuenta de crédito
        if ("CONFIRMED".equals(status)) {
            BigDecimal newBalance = jdbc.sql("""
                    UPDATE customer SET current_balance = current_balance - :amount, updated_at = now()
                    WHERE id = :id RETURNING current_balance
                    """)
                    .param("amount", request.amount())
                    .param("id", request.customerId())
                    .query(BigDecimal.class)
                    .single();

            jdbc.sql("""
                    INSERT INTO credit_account_entry (
                        id, customer_id, credit_payment_id, entry_type,
                        amount, balance_after, created_by, device_id
                    ) VALUES (
                        :id, :customerId, :paymentId, 'CREDIT_PAYMENT',
                        :amount, :balanceAfter, :createdBy, :deviceId
                    )
                    """)
                    .param("id", UUID.randomUUID())
                    .param("customerId", request.customerId())
                    .param("paymentId", paymentId)
                    .param("amount", request.amount())
                    .param("balanceAfter", newBalance)
                    .param("createdBy", actorId)
                    .param("deviceId", deviceId)
                    .update();
        }

        return findById(paymentId);
    }

    @Override
    @Transactional
    public CreditPaymentResponse decidePayment(UUID paymentId, CreditDecisionRequest request, UUID deciderId) {
        String decision = request.decision().trim().toUpperCase();

        var paymentRow = jdbc.sql("""
                SELECT cp.id, cp.customer_id, cp.amount, cp.payment_method, cp.status,
                       cp.collected_by, cp.device_id
                FROM credit_payment cp WHERE cp.id = :id FOR UPDATE
                """)
                .param("id", paymentId)
                .query((rs, rowNum) -> new Object[]{
                        rs.getObject("id", UUID.class),
                        rs.getObject("customer_id", UUID.class),
                        rs.getBigDecimal("amount"),
                        rs.getString("payment_method"),
                        rs.getString("status"),
                        rs.getObject("collected_by", UUID.class),
                        rs.getObject("device_id", UUID.class)
                })
                .optional()
                .orElseThrow(() -> new BusinessException("PAYMENT_NOT_FOUND", "Abono no encontrado.", ErrorCategory.NOT_FOUND));

        String currentStatus = (String) paymentRow[4];
        if (!"PENDING_VERIFICATION".equals(currentStatus)) {
            throw new BusinessException("PAYMENT_ALREADY_DECIDED", "El abono ya fue procesado previamente.", ErrorCategory.CONFLICT);
        }

        UUID collectedBy = (UUID) paymentRow[5];
        if (deciderId.equals(collectedBy)) {
            throw new BusinessException("SELF_APPROVAL_NOT_ALLOWED", "El cobrador no puede verificar su propio abono registrado.", ErrorCategory.FORBIDDEN);
        }

        UUID customerId = (UUID) paymentRow[1];
        BigDecimal amount = (BigDecimal) paymentRow[2];
        UUID deviceId = (UUID) paymentRow[6];

        if ("APPROVE".equals(decision) || "VERIFY".equals(decision)) {
            // Verificar saldo del cliente al momento de aprobación
            var balanceRow = jdbc.sql("SELECT current_balance FROM customer WHERE id = :id FOR UPDATE")
                    .param("id", customerId)
                    .query(BigDecimal.class)
                    .single();

            if (amount.compareTo(balanceRow) > 0) {
                throw new BusinessException("PAYMENT_EXCEEDS_BALANCE",
                        "El monto del abono excede el saldo pendiente actual del cliente.", ErrorCategory.VALIDATION);
            }

            BigDecimal newBalance = jdbc.sql("""
                    UPDATE customer SET current_balance = current_balance - :amount, updated_at = now()
                    WHERE id = :id RETURNING current_balance
                    """)
                    .param("amount", amount)
                    .param("id", customerId)
                    .query(BigDecimal.class)
                    .single();

            jdbc.sql("""
                    UPDATE credit_payment
                    SET status = 'VERIFIED', verified_by = :deciderId, verified_at = now()
                    WHERE id = :id
                    """)
                    .param("deciderId", deciderId)
                    .param("id", paymentId)
                    .update();

            jdbc.sql("""
                    INSERT INTO credit_account_entry (
                        id, customer_id, credit_payment_id, entry_type,
                        amount, balance_after, created_by, device_id
                    ) VALUES (
                        :id, :customerId, :paymentId, 'CREDIT_PAYMENT',
                        :amount, :balanceAfter, :createdBy, :deviceId
                    )
                    """)
                    .param("id", UUID.randomUUID())
                    .param("customerId", customerId)
                    .param("paymentId", paymentId)
                    .param("amount", amount)
                    .param("balanceAfter", newBalance)
                    .param("createdBy", deciderId)
                    .param("deviceId", deviceId)
                    .update();
        } else if ("REJECT".equals(decision)) {
            String reason = request.rejectionReason() == null ? "" : request.rejectionReason().trim();
            if (reason.isEmpty()) {
                throw new BusinessException("REJECTION_REASON_REQUIRED", "Debe especificar el motivo del rechazo.", ErrorCategory.VALIDATION);
            }

            jdbc.sql("""
                    UPDATE credit_payment
                    SET status = 'REJECTED', verified_by = :deciderId, verified_at = now(), rejection_reason = :reason
                    WHERE id = :id
                    """)
                    .param("deciderId", deciderId)
                    .param("reason", reason)
                    .param("id", paymentId)
                    .update();
        } else {
            throw new BusinessException("INVALID_DECISION", "Decisión no válida: " + decision, ErrorCategory.VALIDATION);
        }

        return findById(paymentId);
    }

    @Override
    public CreditPaymentResponse findById(UUID paymentId) {
        return jdbc.sql("""
                SELECT cp.id, cp.customer_id, c.name as customer_name, c.code as customer_code,
                       cp.route_load_id, cp.amount, cp.payment_method, cp.status,
                       cp.reference, cp.bank, cp.rejection_reason, cp.notes,
                       cp.collected_by, u_col.username as collected_by_name,
                       cp.device_id, cp.verified_by, u_ver.username as verified_by_name,
                       cp.verified_at, cp.created_at
                FROM credit_payment cp
                JOIN customer c ON c.id = cp.customer_id
                JOIN app_user u_col ON u_col.id = cp.collected_by
                LEFT JOIN app_user u_ver ON u_ver.id = cp.verified_by
                WHERE cp.id = :id
                """)
                .param("id", paymentId)
                .query(this::mapPaymentRow)
                .optional()
                .orElseThrow(() -> new BusinessException("PAYMENT_NOT_FOUND", "Abono no encontrado.", ErrorCategory.NOT_FOUND));
    }

    @Override
    public CreditPaymentVoucherPdfPort.VoucherData loadVoucherData(UUID paymentId) {
        var payment = findById(paymentId);

        var company = jdbc.sql("""
                SELECT cc.commercial_name, cc.legal_name, cc.tax_id, cc.address,
                       cc.phone, cc.whatsapp, cc.currency_code,
                       f.content as logo_content, f.media_type as logo_media_type
                FROM company_configuration cc
                LEFT JOIN file_object f ON f.id = cc.logo_file_id AND f.status = 'ACTIVE'
                WHERE cc.singleton_key = true
                """)
                .query((rs, rowNum) -> new Object[]{
                        rs.getString("commercial_name"),
                        rs.getString("legal_name"),
                        rs.getString("tax_id"),
                        rs.getString("address"),
                        rs.getString("phone"),
                        rs.getString("whatsapp"),
                        rs.getString("currency_code"),
                        rs.getBytes("logo_content"),
                        rs.getString("logo_media_type")
                })
                .optional()
                .orElseThrow(() -> new BusinessException("COMPANY_NOT_CONFIGURED", "Configuración de empresa no encontrada.", ErrorCategory.INTERNAL));

        byte[] logoBytes = (byte[]) company[7];

        String methodDisplay = "CASH".equals(payment.paymentMethod()) ? "Efectivo" : "Transferencia bancaria";
        String voucherNum = "AB-" + payment.id().toString().substring(0, 8).toUpperCase();

        return new CreditPaymentVoucherPdfPort.VoucherData(
                voucherNum,
                payment.createdAt(),
                (String) company[0],
                (String) company[1],
                (String) company[2],
                (String) company[3],
                (String) company[4],
                (String) company[5],
                logoBytes,
                (String) company[8],
                (String) company[6],
                payment.customerName(),
                payment.customerCode(),
                payment.amount(),
                methodDisplay,
                payment.reference(),
                payment.bank(),
                payment.collectedByName(),
                payment.status(),
                payment.notes()
        );
    }

    @Override
    public CreditStatementResponse getCustomerStatement(UUID customerId) {
        var balance = getCustomerBalance(customerId);

        List<CreditStatementEntryResponse> entries = jdbc.sql("""
                SELECT cae.id, cae.entry_type, cae.amount, cae.balance_after,
                       cae.created_at, u.username as created_by_name,
                       s.document_number as sale_doc_number,
                       cp.payment_method as cp_method, cp.reference as cp_reference
                FROM credit_account_entry cae
                JOIN app_user u ON u.id = cae.created_by
                LEFT JOIN sale s ON s.id = cae.sale_id
                LEFT JOIN credit_payment cp ON cp.id = cae.credit_payment_id
                WHERE cae.customer_id = :customerId
                ORDER BY cae.created_at DESC
                """)
                .param("customerId", customerId)
                .query((rs, rowNum) -> {
                    String type = rs.getString("entry_type");
                    String docOrRef = "";
                    String description = "";

                    if ("SALE_CHARGE".equals(type)) {
                        docOrRef = rs.getString("sale_doc_number");
                        description = "Compra a crédito (Doc: " + docOrRef + ")";
                    } else if ("SALE_VOID".equals(type)) {
                        docOrRef = rs.getString("sale_doc_number");
                        description = "Anulación de venta (Doc: " + docOrRef + ")";
                    } else if ("CREDIT_PAYMENT".equals(type)) {
                        String method = rs.getString("cp_method");
                        String ref = rs.getString("cp_reference");
                        docOrRef = (ref != null && !ref.isEmpty()) ? ref : "";
                        description = "Abono (" + ("CASH".equals(method) ? "Efectivo" : "Transferencia" + (!docOrRef.isEmpty() ? " Ref: " + docOrRef : "")) + ")";
                    }

                    return new CreditStatementEntryResponse(
                            rs.getObject("id", UUID.class),
                            type,
                            rs.getBigDecimal("amount"),
                            rs.getBigDecimal("balance_after"),
                            rs.getTimestamp("created_at").toInstant(),
                            docOrRef,
                            description,
                            rs.getString("created_by_name")
                    );
                })
                .list();

        return new CreditStatementResponse(
                balance.customerId(),
                balance.customerName(),
                balance.customerCode(),
                balance.creditAllowed(),
                balance.creditLimit(),
                balance.currentBalance(),
                balance.availableCredit(),
                entries
        );
    }

    @Override
    public CreditBalanceResponse getCustomerBalance(UUID customerId) {
        return jdbc.sql("""
                SELECT id, code, name, credit_allowed, credit_limit, current_balance
                FROM customer WHERE id = :id
                """)
                .param("id", customerId)
                .query((rs, rowNum) -> {
                    BigDecimal limit = rs.getBigDecimal("credit_limit");
                    BigDecimal current = rs.getBigDecimal("current_balance");
                    BigDecimal available = limit.subtract(current);
                    if (available.compareTo(BigDecimal.ZERO) < 0) {
                        available = BigDecimal.ZERO;
                    }
                    return new CreditBalanceResponse(
                            rs.getObject("id", UUID.class),
                            rs.getString("name"),
                            rs.getString("code"),
                            rs.getBoolean("credit_allowed"),
                            limit,
                            current,
                            available
                    );
                })
                .optional()
                .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "Cliente no encontrado.", ErrorCategory.NOT_FOUND));
    }

    @Override
    public CreditRoutePendingResponse getRoutePending(UUID routeId) {
        var routeName = jdbc.sql("SELECT name FROM route WHERE id = :id")
                .param("id", routeId)
                .query((rs, rowNum) -> rs.getString("name"))
                .optional()
                .orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND", "Ruta no encontrada.", ErrorCategory.NOT_FOUND));

        List<CreditBalanceResponse> debtors = jdbc.sql("""
                SELECT DISTINCT c.id, c.code, c.name, c.credit_allowed, c.credit_limit, c.current_balance
                FROM customer c
                JOIN customer_route cr ON cr.customer_id = c.id AND cr.valid_to IS NULL
                WHERE cr.route_id = :routeId AND c.current_balance > 0
                ORDER BY c.current_balance DESC, c.name ASC
                """)
                .param("routeId", routeId)
                .query((rs, rowNum) -> {
                    BigDecimal limit = rs.getBigDecimal("credit_limit");
                    BigDecimal current = rs.getBigDecimal("current_balance");
                    BigDecimal available = limit.subtract(current);
                    if (available.compareTo(BigDecimal.ZERO) < 0) available = BigDecimal.ZERO;
                    return new CreditBalanceResponse(
                            rs.getObject("id", UUID.class),
                            rs.getString("name"),
                            rs.getString("code"),
                            rs.getBoolean("credit_allowed"),
                            limit,
                            current,
                            available
                    );
                })
                .list();

        int totalDebtors = debtors.size();
        BigDecimal totalDebt = debtors.stream()
                .map(CreditBalanceResponse::currentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new CreditRoutePendingResponse(routeId, routeName, totalDebtors, totalDebt, debtors);
    }

    @Override
    public List<CreditPaymentResponse> findPendingTransfers() {
        return jdbc.sql("""
                SELECT cp.id, cp.customer_id, c.name as customer_name, c.code as customer_code,
                       cp.route_load_id, cp.amount, cp.payment_method, cp.status,
                       cp.reference, cp.bank, cp.rejection_reason, cp.notes,
                       cp.collected_by, u_col.username as collected_by_name,
                       cp.device_id, cp.verified_by, u_ver.username as verified_by_name,
                       cp.verified_at, cp.created_at
                FROM credit_payment cp
                JOIN customer c ON c.id = cp.customer_id
                JOIN app_user u_col ON u_col.id = cp.collected_by
                LEFT JOIN app_user u_ver ON u_ver.id = cp.verified_by
                WHERE cp.payment_method = 'TRANSFER' AND cp.status = 'PENDING_VERIFICATION'
                ORDER BY cp.created_at ASC
                """)
                .query(this::mapPaymentRow)
                .list();
    }

    private CreditPaymentResponse mapPaymentRow(ResultSet rs, int rowNum) throws SQLException {
        return new CreditPaymentResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("customer_id", UUID.class),
                rs.getString("customer_name"),
                rs.getString("customer_code"),
                rs.getObject("route_load_id", UUID.class),
                rs.getBigDecimal("amount"),
                rs.getString("payment_method"),
                rs.getString("status"),
                rs.getString("reference"),
                rs.getString("bank"),
                rs.getString("rejection_reason"),
                rs.getString("notes"),
                rs.getObject("collected_by", UUID.class),
                rs.getString("collected_by_name"),
                rs.getObject("device_id", UUID.class),
                rs.getObject("verified_by", UUID.class),
                rs.getString("verified_by_name"),
                rs.getTimestamp("verified_at") == null ? null : rs.getTimestamp("verified_at").toInstant(),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
