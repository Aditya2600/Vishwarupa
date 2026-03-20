import asyncio
from app.services.heygen_client import HeyGenClient

def check():
    client = HeyGenClient()
    res = client.list_voices()
    voices = res.get('data', {}).get('voices', [])
    
    langs = {'Bengali': 0, 'Malayalam': 0, 'Punjabi': 0}
    
    for v in voices:
        s = str(v).lower()
        if 'bengali' in s or 'bn-in' in s:
            langs['Bengali'] += 1
        if 'malayalam' in s or 'ml-in' in s:
            langs['Malayalam'] += 1
        if 'punjabi' in s or 'pa-in' in s:
            langs['Punjabi'] += 1
            
    print(langs)

if __name__ == '__main__':
    check()
