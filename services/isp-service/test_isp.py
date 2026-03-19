import requests
import json

BASE_URL = "http://localhost:8080"

def test_isp_service():
    print("--- Testing ISP Service ---")
    
    # 1. Health check
    resp = requests.get(f"{BASE_URL}/health")
    print(f"Health: {resp.json()}")

    # 2. List packages (REST ISP)
    resp = requests.get(f"{BASE_URL}/v1/isp/isp_001/packages")
    print(f"Packages (ISP 001): {json.dumps(resp.json(), indent=2)}")

    # 3. List packages (SOAP ISP)
    resp = requests.get(f"{BASE_URL}/v1/isp/isp_002/packages")
    print(f"Packages (ISP 002): {json.dumps(resp.json(), indent=2)}")

    # 4. Activate Data
    payload = {
        "customer_id": "+254700000000",
        "package_id": "MOCK_5GB",
        "reference": "test_ref_999"
    }
    resp = requests.post(f"{BASE_URL}/v1/isp/isp_001/activate", json=payload)
    print(f"Activation: {resp.json()}")

if __name__ == "__main__":
    print("Ensure the ISP service is running on Port 8080 (hint: docker-compose up isp-service)")
    # test_isp_service() # Uncomment to run locally if requests is installed
