import json
import os
import urllib.request

def test():
    with open(".env") as f:
        for line in f:
            if line.startswith("GEMINI_API_KEY="):
                api_key = line.strip().split("=", 1)[1]
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": "Reply with a simple JSON object: {\"ok\": true}"}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        print(resp.read().decode())
    except Exception as e:
        print("Error:", e)
        if hasattr(e, 'read'):
            print(e.read().decode())

test()
