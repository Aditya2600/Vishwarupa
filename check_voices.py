import requests
import json

try:
    res = requests.get("http://127.0.0.1:8000/api/meta/voices")
    data = res.json()
    voices = data.get("data", {}).get("voices", []) if isinstance(data, dict) else data
    for v in voices:
        print(f"ID: {v.get('id')}, Name: {v.get('name')}, Gender: {v.get('gender')}, Lang: {v.get('language')} / {v.get('languages')}")
except Exception as e:
    print(f"Error: {e}")
