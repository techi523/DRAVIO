from fastapi import FastAPI, HTTPException, Body, Request, Header
from typing import List
import hmac
import hashlib
import json
import os
from adapters.production_adapter import ProductionAdapter
from adapters.base import ISPPackage, ActivationResponse, UsageResponse

app = FastAPI(title="DRAVIO ISP Integration Service")

# Registry of adapters using env config
ADAPTERS = {
    "isp_001": ProductionAdapter(
        base_url=os.environ.get("ISP_001_BASE_URL", "https://api.upstream-isp.com"), 
        api_key=os.environ.get("ISP_001_API_KEY", "prod_key")
    )
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
async def isp_usage_webhook(
    isp_id: str, 
    request: Request,
    x_isp_signature: str = Header(None)
):
    body = await request.body()
    secret = os.environ.get(f"ISP_{isp_id.upper()}_SECRET", "default_secret").encode('utf-8')
    
    if not x_isp_signature:
        raise HTTPException(status_code=401, detail="MISSING_SIGNATURE")
        
    expected_signature = hmac.new(secret, body, hashlib.sha256).hexdigest()
    
    if not hmac.compare_digest(expected_signature, x_isp_signature):
        raise HTTPException(status_code=403, detail="INVALID_SIGNATURE")

    try:
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="INVALID_JSON")

    print(f"Received secure usage webhook from {isp_id}: {payload}")
    return {"status": "received"}


