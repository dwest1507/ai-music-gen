import httpx
import os

# we can use httpx since it's already installed
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
url = os.getenv("ACESTEP_API_URL")
if url:
    url = url.rstrip("/")
key = os.getenv("ACESTEP_API_KEY")

headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

task_id = "6269fef0-fa79-4d45-a479-1853b006e7e4"

payload = {"task_id_list": [task_id]}

response = httpx.post(
    f"{url}/query_result", headers=headers, json=payload, timeout=30.0
)
print(response.json())
