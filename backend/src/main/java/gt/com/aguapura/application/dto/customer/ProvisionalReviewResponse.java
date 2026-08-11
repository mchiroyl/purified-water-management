package gt.com.aguapura.application.dto.customer;

import gt.com.aguapura.application.dto.route.CustomerResponse;

import java.util.List;

public record ProvisionalReviewResponse(CustomerResponse customer, List<DuplicateCandidateResponse> duplicateCandidates) {
}
