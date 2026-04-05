from fastapi import FastAPI, HTTPException, Body
from typing import List
from adapters.rest_adapter import MockRESTAdapter
from adapters.soap_adapter import MockSOAPAdapter
from adapters.base import ISPPackage, ActivationResponse, UsageResponse

app = FastAPI(title="DRAVIO ISP Integration Service")

# Registry of adapters
ADAPTERS = {
    "isp_001": MockRESTAdapter(base_url="https://api.mockisp.com", api_key="test_key"),
    "isp_002": MockSOAPAdapter(wsdl_url="https://soap.legacy-isp.com/v1?wsdl")
}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "isp-service"}

# Platform-to-ISP: List Packages
@app.get("/v1/isp/{isp_id}/packages", response_model=List[ISPPackage])
async def list_packages(isp_id: str):
    adapter = ADAPTERS.get(isp_id)
    if not adapter:
        raise HTTPException(status_code=404, detail="ISP_NOT_FOUND")
    return await adapter.list_packages()

# Platform-to-ISP: Activate Data
@app.post("/v1/isp/{isp_id}/activate", response_model=ActivationResponse)
async def activate_data(isp_id: str, payload: dict = Body(...)):
    adapter = ADAPTERS.get(isp_id)
    if not adapter:
        raise HTTPException(status_code=404, detail="ISP_NOT_FOUND")
    
    return await adapter.activate_data(
        customer_id=payload.get("customer_id"),
        package_id=payload.get("package_id"),
        reference=payload.get("reference")
    )

# Platform-to-ISP: Pull Usage
@app.get("/v1/isp/{isp_id}/usage/{activation_id}", response_model=UsageResponse)
async def check_usage(isp_id: str, activation_id: str):
    adapter = ADAPTERS.get(isp_id)
    if not adapter:
        raise HTTPException(status_code=404, detail="ISP_NOT_FOUND")
    return await adapter.check_usage(activation_id)

# ISP-to-Platform: Webhook usage push
@app.post("/v1/isp/webhook/{isp_id}/usage")
async def isp_usage_webhook(isp_id: str, payload: dict = Body(...)):
    # TODO: Verify HMAC signature using isp_config.webhook_secret
    # For MVP, we log and emit a Kafka event
    print(f"Received usage webhook from {isp_id}: {payload}")
    return {"status": "received"}

