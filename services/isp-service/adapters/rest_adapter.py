import httpx
from typing import List
from .base import BaseISPAdapter, ISPPackage, ActivationResponse, UsageResponse

class MockRESTAdapter(BaseISPAdapter):
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key

    async def list_packages(self) -> List[ISPPackage]:
        # Mock implementation for MVP
        return [
            ISPPackage(
                external_package_id="MOCK_5GB",
                name="Mock 5GB Plan",
                data_amount_mb=5120,
                validity_hours=168,
                price_amount=5.0,
                price_currency="USD",
                available=True
            )
        ]

    async def activate_data(self, customer_id: str, package_id: str, reference: str) -> ActivationResponse:
        return ActivationResponse(
            success=True,
            activation_id=f"act_{reference}",
            activated_at="2026-03-19T12:00:00Z",
            current_ip="1.2.3.4"
        )

    async def check_usage(self, activation_id: str) -> UsageResponse:
        return UsageResponse(
            activation_id=activation_id,
            bytes_used=1024 * 1024 * 500, # 500MB
            bytes_remaining=1024 * 1024 * 4620,
            session_active=True
        )

    async def deactivate_data(self, activation_id: str) -> bool:
        return True

    async def refund_data(self, activation_id: str) -> bool:
        return True
