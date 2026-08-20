import re
import json

def extract_json_from_text(text: str) -> dict:
    """JSON'u metinden ayıklar."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            raise ValueError("JSON parse edilemedi.")
    raise ValueError("Geçerli bir JSON bloğu bulunamadı.")