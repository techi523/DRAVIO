from typing import List
from .base import BaseISPAdapter, ISPPackage, ActivationResponse, UsageResponse

class MockSOAPAdapter(BaseISPAdapter):
    """
    Mock implementation of a SOAP-based ISP adapter.
    In production, this would use 'zeep' to called WSDL-defined services.
    """
    def __init__(self, wsdl_url: str):
        self.wsdl_url = wsdl_url

    async def list_packages(self) -> List[ISPPackage]:
        return [
            ISPPackage(
                external_package_id="SOAP_10GB",
                name="Legacy 10GB SOAP Plan",
                data_amount_mb=10240,
                validity_hours=720,
                price_amount=15.0,
                price_currency="USD",
                available=True
            )
        ]

    async def activate_data(self, customer_id: str, package_id: str, reference: str) -> ActivationResponse:
        return ActivationResponse(
            success=True,
            activation_id=f"soap_act_{reference}",
            activated_at="2026-03-19T13:00:00Z"
        )

    async def check_usage(self, activation_id: str) -> UsageResponse:
        return UsageResponse(
            activation_id=activation_id,
            bytes_used=1024 * 1024 * 100, # 100MB
            bytes_remaining=1024 * 1024 * 9900,
            session_active=True
        )

    async def deactivate_data(self, activation_id: str) -> bool:
        return True

    async def refund_data(self, activation_id: str) -> bool:
        return True
