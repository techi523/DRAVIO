import httpx
from datetime import datetime, timedelta
import uuid
from typing import List, Optional
from .base import BaseISPAdapter, ISPPackage, ActivationResponse, UsageResponse

class ProductionAdapter(BaseISPAdapter):
    """
    Real implementation of a REST-based ISP adapter hitting a configured downstream.
    """
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    async def list_packages(self) -> List[ISPPackage]:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/v1/packages",
                    headers=self.headers,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json().get("packages", [])
                
                return [
                    ISPPackage(
                        external_package_id=p["id"],
                        name=p["name"],
                        data_amount_mb=p.get("data_amount_mb", 1000),
                        validity_hours=p.get("validity_hours", 24),
                        price_amount=p.get("price_amount", 5.0),
                        price_currency=p.get("price_currency", "USD"),
                        available=p.get("available", True)
                    ) for p in data
                ]
            except Exception as e:
                print(f"[ProductionAdapter] list_packages failed: {e}")
                return []

    async def activate_data(self, customer_id: str, package_id: str, reference: str) -> ActivationResponse:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1/provisioning/activate",
                    headers=self.headers,
                    json={
                        "customer_id": customer_id,
                        "package_id": package_id,
                        "reference": reference
                    },
                    timeout=15.0
                )
                response.raise_for_status()
                data = response.json()
                return ActivationResponse(
                    success=True,
                    activation_id=data.get("activation_id", str(uuid.uuid4())),
                    activated_at=datetime.utcnow().isoformat(),
                    current_ip=data.get("current_ip", "0.0.0.0")
                )
            except Exception as e:
                return ActivationResponse(
                    success=False,
                    error=f"Activation failed: {str(e)}"
                )

    async def check_usage(self, activation_id: str) -> UsageResponse:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/v1/usage/{activation_id}",
                    headers=self.headers,
                    timeout=10.0
                )
                response.raise_for_status()
                data = response.json()
                return UsageResponse(
                    activation_id=activation_id,
                    bytes_used=data.get("bytes_used", 0),
                    bytes_remaining=data.get("bytes_remaining", 0),
                    session_active=data.get("session_active", False)
                )
            except Exception as e:
                print(f"[ProductionAdapter] check_usage failed: {e}")
                return UsageResponse(activation_id=activation_id, bytes_used=0, bytes_remaining=0, session_active=False)

    async def deactivate_data(self, activation_id: str) -> bool:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1/provisioning/deactivate",
                    headers=self.headers,
                    json={"activation_id": activation_id},
                    timeout=10.0
                )
                response.raise_for_status()
                return True
            except Exception as e:
                print(f"[ProductionAdapter] deactivate_data failed: {e}")
                return False

    async def refund_data(self, activation_id: str) -> bool:
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/v1/provisioning/refund",
                    headers=self.headers,
                    json={"activation_id": activation_id},
                    timeout=10.0
                )
                response.raise_for_status()
                return True
            except Exception as e:
                print(f"[ProductionAdapter] refund_data failed: {e}")
                return False
