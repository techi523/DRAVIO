from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import List, Optional

class ISPPackage(BaseModel):
    external_package_id: str
    name: str
    data_amount_mb: int
    validity_hours: int
    price_amount: float
    price_currency: str
    available: bool

class ActivationResponse(BaseModel):
    success: bool
    activation_id: Optional[str] = None
    activated_at: Optional[str] = None
    current_ip: Optional[str] = None
    error: Optional[str] = None

class UsageResponse(BaseModel):
    activation_id: str
    bytes_used: int
    bytes_remaining: int
    session_active: bool

class BaseISPAdapter(ABC):
    @abstractmethod
    async def list_packages(self) -> List[ISPPackage]:
        pass

    @abstractmethod
    async def activate_data(self, customer_id: str, package_id: str, reference: str) -> ActivationResponse:
        pass

    @abstractmethod
    async def check_usage(self, activation_id: str) -> UsageResponse:
        pass

    @abstractmethod
    async def deactivate_data(self, activation_id: str) -> bool:
        pass

    @abstractmethod
    async def refund_data(self, activation_id: str) -> bool:
        pass
